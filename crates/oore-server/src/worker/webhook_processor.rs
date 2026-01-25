//! Webhook processing worker.

use oore_core::{
    db::{repository::{BuildRepo, RepositoryRepo, WebhookEventRepo}, DbPool},
    models::{
        Build, GitProvider, TriggerType, WebhookEventId, WebhookEventType,
    },
    webhook::{parse_github_webhook, parse_gitlab_webhook},
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
) -> (mpsc::Sender<WebhookJob>, tokio::task::JoinHandle<()>) {
    let (tx, rx) = mpsc::channel::<WebhookJob>(1000);

    let handle = tokio::spawn(async move {
        run_webhook_processor(db, rx).await;
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
async fn run_webhook_processor(db: DbPool, mut rx: mpsc::Receiver<WebhookJob>) {
    tracing::info!("Webhook processor started");

    while let Some(job) = rx.recv().await {
        tracing::debug!(
            "Processing webhook event {} ({} {})",
            job.event_id,
            job.provider,
            job.event_type
        );

        if let Err(e) = process_webhook_job(&db, &job).await {
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
async fn process_webhook_job(db: &DbPool, job: &WebhookJob) -> oore_core::Result<()> {
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
