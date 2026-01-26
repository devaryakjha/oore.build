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
use tokio::sync::mpsc;

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

/// Starts the webhook processor worker.
///
/// Returns a sender for submitting jobs and a handle to the worker task.
pub fn start_webhook_processor(
    db: DbPool,
    encryption_key: Option<EncryptionKey>,
) -> (mpsc::Sender<WebhookJob>, tokio::task::JoinHandle<()>) {
    let (tx, rx) = mpsc::channel::<WebhookJob>(1000);

    let handle = tokio::spawn(async move {
        run_webhook_processor(db, encryption_key, rx).await;
    });

    (tx, handle)
}

/// Recovers unprocessed webhook events on startup.
pub async fn recover_unprocessed_events(db: &DbPool, tx: &mpsc::Sender<WebhookJob>) {
    match WebhookEventRepo::get_unprocessed(db).await {
        Ok(events) => {
            let count = events.len();
            for event in events {
                let job = WebhookJob {
                    event_id: event.id,
                    provider: event.provider,
                    event_type: event.event_type,
                };
                if tx.send(job).await.is_err() {
                    tracing::error!("Failed to queue recovered event - channel closed");
                    break;
                }
            }
            if count > 0 {
                tracing::info!("Recovered {} unprocessed webhook events", count);
            }
        }
        Err(e) => {
            tracing::error!("Failed to recover unprocessed events: {}", e);
        }
    }
}

/// Main processor loop.
async fn run_webhook_processor(
    db: DbPool,
    encryption_key: Option<EncryptionKey>,
    mut rx: mpsc::Receiver<WebhookJob>,
) {
    tracing::info!("Webhook processor started");

    while let Some(job) = rx.recv().await {
        tracing::debug!(
            "Processing webhook event {} ({} {})",
            job.event_id,
            job.provider,
            job.event_type
        );

        if let Err(e) = process_webhook_job(&db, &encryption_key, &job).await {
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

    tracing::info!("Webhook processor stopped");
}

/// Processes a single webhook job.
async fn process_webhook_job(
    db: &DbPool,
    encryption_key: &Option<EncryptionKey>,
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
        &parsed.commit_sha[..7.min(parsed.commit_sha.len())]
    );

    // TODO: Actually execute the build
    // For now, we just create the record. Build execution will be added later.

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
            return Err(e.into());
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
