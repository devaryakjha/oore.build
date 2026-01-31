//! Webhook processing worker.

use oore_core::{
    db::{
        credentials::{GitHubAppCredentialsRepo, GitHubAppInstallationRepo, GitHubInstallationRepoRepo},
        repository::{BuildRepo, RepositoryRepo, WebhookEventRepo},
        DbPool,
    },
    models::{Build, GitProvider, TriggerType, WebhookEventId, WebhookEventType},
    oauth::{github::GitHubClient, EncryptionKey},
    webhook::{is_github_installation_event, parse_github_installation_webhook, parse_github_webhook, parse_gitlab_webhook},
};
use tokio::sync::{mpsc, watch};

use super::BuildJob;

/// A webhook processing job.
#[derive(Debug, Clone)]
pub struct WebhookJob {
    /// The ID of the webhook event to process.
    pub event_id: WebhookEventId,
    /// The provider that sent the webhook.
    pub provider: GitProvider,
    /// The type of event (e.g., "push", "pull_request").
    pub event_type: String,
}

/// Validates that a commit SHA is in the expected format.
///
/// Git commit SHAs are either:
/// - 40 hex characters (SHA-1, most common)
/// - 64 hex characters (SHA-256, for repos using SHA-256 object format)
///
/// Returns `true` if the SHA is valid, `false` otherwise.
fn is_valid_commit_sha(sha: &str) -> bool {
    let len = sha.len();
    (len == 40 || len == 64) && sha.chars().all(|c| c.is_ascii_hexdigit())
}

/// Truncates a commit SHA for display, with validation.
fn format_commit_sha(sha: &str) -> &str {
    if !is_valid_commit_sha(sha) {
        return "<invalid>";
    }
    &sha[..7.min(sha.len())]
}

/// Handle for managing the webhook processor worker.
pub struct WebhookWorkerHandle {
    /// Handle to the worker task.
    pub task_handle: tokio::task::JoinHandle<()>,
    /// Sender for the shutdown signal.
    shutdown_tx: watch::Sender<bool>,
}

impl WebhookWorkerHandle {
    /// Signals the worker to shut down gracefully and waits for it to finish.
    ///
    /// Returns `Ok(())` if the worker shut down cleanly, or `Err` if it panicked.
    pub async fn shutdown(self) -> Result<(), tokio::task::JoinError> {
        // Signal shutdown
        let _ = self.shutdown_tx.send(true);
        // Wait for the worker to finish
        self.task_handle.await
    }

    /// Checks if the worker task has finished (possibly due to panic).
    #[allow(dead_code)]
    pub fn is_finished(&self) -> bool {
        self.task_handle.is_finished()
    }
}

/// Starts the webhook processor worker.
///
/// Returns a sender for submitting jobs and a handle for managing the worker.
pub fn start_webhook_processor(
    db: DbPool,
    encryption_key: Option<EncryptionKey>,
) -> (mpsc::Sender<WebhookJob>, WebhookWorkerHandle) {
    start_webhook_processor_with_build_tx(db, encryption_key, None)
}

/// Starts the webhook processor worker with optional build job sender.
///
/// When build_tx is provided, builds are automatically queued for execution
/// after being created.
pub fn start_webhook_processor_with_build_tx(
    db: DbPool,
    encryption_key: Option<EncryptionKey>,
    build_tx: Option<mpsc::Sender<BuildJob>>,
) -> (mpsc::Sender<WebhookJob>, WebhookWorkerHandle) {
    let (tx, rx) = mpsc::channel::<WebhookJob>(1000);
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let handle = tokio::spawn(async move {
        run_webhook_processor(db, encryption_key, build_tx, rx, shutdown_rx).await;
    });

    let worker_handle = WebhookWorkerHandle {
        task_handle: handle,
        shutdown_tx,
    };

    (tx, worker_handle)
}

/// Batch size for recovering unprocessed events.
const RECOVERY_BATCH_SIZE: i64 = 100;

/// Maximum number of retries when channel is full during recovery.
const RECOVERY_MAX_RETRIES: u32 = 10;

/// Delay between retries when channel is full (100ms).
const RECOVERY_RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(100);

/// Recovers unprocessed webhook events on startup.
///
/// Uses batched loading to avoid memory issues with many unprocessed events.
/// Uses non-blocking sends with backpressure handling to prevent startup hangs.
pub async fn recover_unprocessed_events(db: &DbPool, tx: &mpsc::Sender<WebhookJob>) {
    // First, get the total count for logging
    let total_count = match WebhookEventRepo::count_unprocessed(db).await {
        Ok(count) => count,
        Err(e) => {
            tracing::error!("Failed to count unprocessed events: {}", e);
            return;
        }
    };

    if total_count == 0 {
        return;
    }

    tracing::info!("Recovering {} unprocessed webhook events...", total_count);

    let mut offset = 0i64;
    let mut recovered = 0u64;
    let mut skipped = 0u64;

    loop {
        match WebhookEventRepo::get_unprocessed_batch(db, RECOVERY_BATCH_SIZE, offset).await {
            Ok(events) => {
                if events.is_empty() {
                    break;
                }

                let batch_size = events.len();
                for event in events {
                    let job = WebhookJob {
                        event_id: event.id,
                        provider: event.provider,
                        event_type: event.event_type,
                    };

                    // Use try_send with retries to avoid blocking startup indefinitely
                    let mut sent = false;
                    for retry in 0..RECOVERY_MAX_RETRIES {
                        match tx.try_send(job.clone()) {
                            Ok(()) => {
                                sent = true;
                                recovered += 1;
                                break;
                            }
                            Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
                                // Channel full, wait briefly for worker to process some jobs
                                if retry == 0 {
                                    tracing::debug!(
                                        "Recovery queue full at {} events, waiting for worker...",
                                        recovered
                                    );
                                }
                                tokio::time::sleep(RECOVERY_RETRY_DELAY).await;
                            }
                            Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {
                                tracing::error!("Failed to queue recovered event - channel closed");
                                return;
                            }
                        }
                    }

                    if !sent {
                        // After retries, skip this event (it will be recovered on next restart)
                        skipped += 1;
                        tracing::warn!(
                            "Skipping event {} recovery - queue full after retries",
                            job.event_id
                        );
                    }
                }

                offset += batch_size as i64;

                // Log progress for large recoveries
                if recovered.is_multiple_of(500) {
                    tracing::debug!("Recovery progress: {}/{} events queued", recovered, total_count);
                }
            }
            Err(e) => {
                tracing::error!("Failed to recover unprocessed events batch at offset {}: {}", offset, e);
                break;
            }
        }
    }

    if skipped > 0 {
        tracing::warn!(
            "Recovery complete: {} queued, {} skipped (will retry on next restart)",
            recovered,
            skipped
        );
    } else {
        tracing::info!("Recovered {} unprocessed webhook events", recovered);
    }
}

/// Main processor loop.
async fn run_webhook_processor(
    db: DbPool,
    encryption_key: Option<EncryptionKey>,
    build_tx: Option<mpsc::Sender<BuildJob>>,
    mut rx: mpsc::Receiver<WebhookJob>,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    tracing::info!("Webhook processor started");

    loop {
        tokio::select! {
            // Check for shutdown signal
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    tracing::info!("Webhook processor received shutdown signal");
                    break;
                }
            }
            // Process incoming jobs
            job = rx.recv() => {
                match job {
                    Some(job) => {
                        tracing::debug!(
                            "Processing webhook event {} ({} {})",
                            job.event_id,
                            job.provider,
                            job.event_type
                        );

                        if let Err(e) = process_webhook_job(&db, &encryption_key, &build_tx, &job).await {
                            tracing::error!("Failed to process webhook {}: {}", job.event_id, e);
                            // Store error message on the event
                            if let Err(e2) = WebhookEventRepo::set_error(&db, &job.event_id, &e.to_string()).await {
                                tracing::error!("Failed to set error on webhook event: {}", e2);
                            }
                        }

                        // Mark as processed regardless of success/failure
                        if let Err(e) = WebhookEventRepo::mark_processed(&db, &job.event_id).await {
                            tracing::error!("Failed to mark webhook as processed: {}", e);
                        }
                    }
                    None => {
                        // Channel closed (all senders dropped)
                        tracing::info!("Webhook processor channel closed");
                        break;
                    }
                }
            }
        }
    }

    tracing::info!("Webhook processor stopped");
}

/// Processes a single webhook job.
async fn process_webhook_job(
    db: &DbPool,
    encryption_key: &Option<EncryptionKey>,
    build_tx: &Option<mpsc::Sender<BuildJob>>,
    job: &WebhookJob,
) -> oore_core::Result<()> {
    // Check if this is a GitHub installation event
    if job.provider == GitProvider::GitHub && is_github_installation_event(&job.event_type) {
        return process_github_installation_event(db, encryption_key, job).await;
    }

    // Get the webhook event from the database
    let event = WebhookEventRepo::get_by_id(db, &job.event_id)
        .await?
        .ok_or_else(|| oore_core::OoreError::WebhookEventNotFound(job.event_id.to_string()))?;

    // Parse the webhook payload
    let parsed = match job.provider {
        GitProvider::GitHub => parse_github_webhook(&job.event_type, &event.payload)?,
        GitProvider::GitLab => parse_gitlab_webhook(&job.event_type, &event.payload)?,
    };

    // Get repository ID from event or try to resolve it
    let repository_id = match event.repository_id {
        Some(id) => id,
        None => {
            // Try to resolve from parsed data
            let repo = match job.provider {
                GitProvider::GitHub => {
                    if let Some(github_id) = parsed.github_repository_id {
                        RepositoryRepo::get_by_github_repo_id(db, github_id).await?
                    } else {
                        RepositoryRepo::get_by_full_name(
                            db,
                            GitProvider::GitHub,
                            &parsed.repository_owner,
                            &parsed.repository_name,
                        )
                        .await?
                    }
                }
                GitProvider::GitLab => {
                    if let Some(gitlab_id) = parsed.gitlab_project_id {
                        RepositoryRepo::get_by_gitlab_project_id(db, gitlab_id).await?
                    } else {
                        RepositoryRepo::get_by_full_name(
                            db,
                            GitProvider::GitLab,
                            &parsed.repository_owner,
                            &parsed.repository_name,
                        )
                        .await?
                    }
                }
            };

            match repo {
                Some(r) => r.id,
                None => {
                    tracing::warn!(
                        "Repository not found for webhook: {}/{}",
                        parsed.repository_owner,
                        parsed.repository_name
                    );
                    return Ok(());
                }
            }
        }
    };

    // Determine if we should create a build
    let should_build = match parsed.event_type {
        WebhookEventType::Push => true,
        WebhookEventType::PullRequest | WebhookEventType::MergeRequest => {
            // Only build on opened or synchronize
            matches!(
                parsed.action.as_deref(),
                Some("opened") | Some("synchronize") | Some("open") | Some("update")
            )
        }
        // Installation events are handled separately above
        WebhookEventType::Installation | WebhookEventType::InstallationRepositories => false,
    };

    if !should_build {
        tracing::debug!(
            "Skipping build for event type {:?} action {:?}",
            parsed.event_type,
            parsed.action
        );
        return Ok(());
    }

    // Create build record
    let trigger_type = match parsed.event_type {
        WebhookEventType::Push => TriggerType::Push,
        WebhookEventType::PullRequest => TriggerType::PullRequest,
        WebhookEventType::MergeRequest => TriggerType::MergeRequest,
        // These are handled above, but we need to satisfy the match
        WebhookEventType::Installation | WebhookEventType::InstallationRepositories => {
            return Ok(());
        }
    };

    // Validate commit SHA format BEFORE creating build
    if !is_valid_commit_sha(&parsed.commit_sha) {
        tracing::warn!(
            "Webhook {} has invalid commit SHA format: '{}', skipping build creation",
            job.event_id,
            parsed.commit_sha
        );
        return Err(oore_core::OoreError::InvalidWebhookPayload(format!(
            "Invalid commit SHA format: '{}'",
            parsed.commit_sha
        )));
    }

    let build = Build::new(
        repository_id.clone(),
        Some(job.event_id.clone()),
        parsed.commit_sha.clone(),
        parsed.branch.clone(),
        trigger_type,
    );

    BuildRepo::create(db, &build).await?;

    tracing::info!(
        "Created build {} for {} on {} ({})",
        build.id,
        repository_id,
        parsed.branch,
        format_commit_sha(&parsed.commit_sha)
    );

    // Queue the build for execution
    if let Some(tx) = build_tx {
        let build_job = BuildJob {
            build_id: build.id.clone(),
        };
        if let Err(e) = tx.try_send(build_job) {
            // Build queue is full - mark the build as failed to prevent it from being lost
            tracing::error!(
                "Failed to queue build {} (queue full): {}. Marking as failed.",
                build.id,
                e
            );
            // Update build status to failure with a clear error message
            if let Err(update_err) = BuildRepo::set_error(
                db,
                &build.id,
                "Build queue full - please retry. The server is processing too many builds.",
            )
            .await
            {
                tracing::error!("Failed to set build error: {}", update_err);
            }
            if let Err(status_err) = BuildRepo::update_status(db, &build.id, oore_core::models::BuildStatus::Failure).await {
                tracing::error!("Failed to update build status: {}", status_err);
            }
        }
    }

    Ok(())
}

/// Processes a GitHub installation event (sync installations and repos).
async fn process_github_installation_event(
    db: &DbPool,
    encryption_key: &Option<EncryptionKey>,
    job: &WebhookJob,
) -> oore_core::Result<()> {
    // Get the webhook event from the database
    let event = WebhookEventRepo::get_by_id(db, &job.event_id)
        .await?
        .ok_or_else(|| oore_core::OoreError::WebhookEventNotFound(job.event_id.to_string()))?;

    // Parse the installation event
    let parsed = parse_github_installation_webhook(&job.event_type, &event.payload)?;

    tracing::info!(
        "Processing GitHub installation event: {} (action={}, installation_id={}, account={})",
        job.event_type,
        parsed.action,
        parsed.installation_id,
        parsed.account_login
    );

    // Handle deleted or suspended installations
    if parsed.action == "deleted" || parsed.action == "suspend" {
        tracing::info!(
            "Installation {} was {}, deactivating and cleaning up",
            parsed.installation_id,
            parsed.action
        );

        // Deactivate the installation
        if let Err(e) = GitHubAppInstallationRepo::deactivate(db, parsed.installation_id).await {
            tracing::error!("Failed to deactivate installation {}: {}", parsed.installation_id, e);
        }

        // For deleted installations, also remove all repos
        if parsed.action == "deleted" {
            // Get the installation record to find its ID
            if let Ok(Some(installation)) = GitHubAppInstallationRepo::get_by_installation_id(db, parsed.installation_id).await {
                // Delete all repos for this installation by passing empty list
                if let Err(e) = GitHubInstallationRepoRepo::delete_not_in(db, &installation.id, &[]).await {
                    tracing::error!("Failed to delete repos for installation {}: {}", parsed.installation_id, e);
                }
            }
        }

        return Ok(());
    }

    // Need encryption key to call GitHub API
    let encryption_key = match encryption_key {
        Some(key) => key,
        None => {
            tracing::warn!("Cannot sync installation: encryption key not configured");
            return Ok(());
        }
    };

    // Get GitHub credentials
    let creds = match GitHubAppCredentialsRepo::get_active(db).await? {
        Some(c) => c,
        None => {
            tracing::warn!("Cannot sync installation: no GitHub App credentials configured");
            return Ok(());
        }
    };

    // Create GitHub client
    let client = GitHubClient::new(encryption_key.clone())?;

    // Fetch all installations and sync them
    let api_installations = match client.list_installations(&creds).await {
        Ok(i) => i,
        Err(e) => {
            tracing::error!("Failed to fetch installations from GitHub: {}", e);
            return Err(e);
        }
    };

    let mut installations_synced = 0;
    let mut repositories_synced = 0;

    for api_installation in &api_installations {
        let installation = client.to_installation_model(&creds.id, api_installation);

        // Upsert installation
        if let Err(e) = GitHubAppInstallationRepo::upsert(db, &installation).await {
            tracing::error!(
                "Failed to upsert installation {}: {}",
                api_installation.id,
                e
            );
            continue;
        }

        installations_synced += 1;

        // For 'selected' installations, sync repositories
        if installation.repository_selection == "selected" {
            match client.list_installation_repos(&creds, api_installation.id).await {
                Ok(repos) => {
                    let mut synced_repo_ids = Vec::new();

                    for repo in &repos {
                        let repo_model = client.to_repo_model(&installation.id, repo);

                        if let Err(e) = GitHubInstallationRepoRepo::upsert(db, &repo_model).await {
                            tracing::error!("Failed to upsert repo {}: {}", repo.full_name, e);
                            continue;
                        }

                        synced_repo_ids.push(repo.id);
                        repositories_synced += 1;
                    }

                    // Clean up removed repos
                    if let Err(e) = GitHubInstallationRepoRepo::delete_not_in(
                        db,
                        &installation.id,
                        &synced_repo_ids,
                    )
                    .await
                    {
                        tracing::warn!("Failed to clean up removed repos: {}", e);
                    }
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to fetch repos for installation {}: {}",
                        api_installation.id,
                        e
                    );
                }
            }
        }
    }

    tracing::info!(
        "Installation sync complete: {} installations, {} repositories",
        installations_synced,
        repositories_synced
    );

    Ok(())
}
