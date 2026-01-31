//! Webhook endpoint handlers for GitHub and GitLab.

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use oore_core::{
    crypto::{sha256_hex, MAX_WEBHOOK_SIZE},
    db::{
        credentials::GitHubAppCredentialsRepo,
        repository::{RepositoryRepo, WebhookEventRepo},
    },
    models::{GitProvider, RepositoryId, WebhookEvent, WebhookEventId},
    oauth::github::GitHubClient,
    webhook::{GitHubVerifier, GitLabVerifier},
};
use serde_json::json;

use crate::state::AppState;
use crate::worker::WebhookJob;

/// Get GitHub webhook secret, preferring DB credentials over env vars.
///
/// Returns None if GitHub is not configured at all.
async fn get_github_webhook_secret(state: &AppState) -> Option<String> {
    // Try database first (OAuth-configured credentials)
    match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(creds)) => {
            // Need encryption key to decrypt
            if let Some(ref encryption_key) = state.encryption_key {
                match GitHubClient::new(encryption_key.clone()) {
                    Ok(client) => match client.decrypt_webhook_secret(&creds) {
                        Ok(secret) => return Some(secret),
                        Err(e) => {
                            tracing::error!("Failed to decrypt GitHub webhook secret: {}", e);
                            return None;
                        }
                    },
                    Err(e) => {
                        tracing::error!("Failed to create GitHub client: {}", e);
                        return None;
                    }
                }
            } else {
                tracing::error!("DB credentials exist but no encryption key configured");
                return None;
            }
        }
        Ok(None) => {
            // No DB credentials, try env var fallback
        }
        Err(e) => {
            tracing::warn!("Failed to fetch GitHub credentials from DB: {}", e);
            // Continue to env var fallback
        }
    }

    // Fall back to env var ONLY if no DB credentials exist
    state
        .github_config
        .as_ref()
        .map(|c| c.webhook_secret.clone())
}

/// Handler for GitHub webhooks.
///
/// POST /api/webhooks/github
pub async fn handle_github_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    // 1. Check body size limit
    if body.len() > MAX_WEBHOOK_SIZE {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(json!({"error": "Payload too large"})),
        );
    }

    // 2. Get GitHub webhook secret (prefers DB credentials, falls back to env vars)
    let webhook_secret = match get_github_webhook_secret(&state).await {
        Some(secret) => secret,
        None => {
            tracing::warn!("GitHub webhook received but GitHub is not configured");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "GitHub integration not configured"})),
            );
        }
    };

    // 3. Extract headers
    let signature = headers
        .get("X-Hub-Signature-256")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let delivery_id = headers
        .get("X-GitHub-Delivery")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let event_type = headers
        .get("X-GitHub-Event")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    // 4. Verify signature (constant-time)
    let verifier = GitHubVerifier::new(&webhook_secret);
    if !verifier.verify(signature, &body) {
        tracing::warn!("GitHub webhook signature verification failed");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid signature"})),
        );
    }

    // 5. Compute effective delivery_id (with sha256 fallback)
    let effective_delivery_id = delivery_id.unwrap_or_else(|| format!("sha256:{}", sha256_hex(&body)));

    // 6. Check idempotency (duplicate delivery_id)
    match WebhookEventRepo::exists_by_delivery(&state.db, GitProvider::GitHub, &effective_delivery_id)
        .await
    {
        Ok(true) => {
            tracing::debug!("Duplicate GitHub webhook delivery: {}", effective_delivery_id);
            return (StatusCode::OK, Json(json!({"status": "duplicate"})));
        }
        Ok(false) => {}
        Err(e) => {
            tracing::error!("Failed to check duplicate delivery: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    // 7. Try to resolve repository from payload
    let repository_id = match resolve_github_repository(&state, &body).await {
        Ok(id) => id,
        Err(e) => {
            tracing::warn!("Could not resolve GitHub repository: {}", e);
            None
        }
    };

    // 8. Store webhook event
    let event = WebhookEvent {
        id: WebhookEventId::new(),
        repository_id,
        provider: GitProvider::GitHub,
        event_type: event_type.to_string(),
        delivery_id: effective_delivery_id,
        payload: body.to_vec(),
        processed: false,
        error_message: None,
        received_at: Utc::now(),
    };

    if let Err(e) = WebhookEventRepo::create(&state.db, &event).await {
        // Check if this is a unique constraint violation (race condition with duplicate delivery)
        let is_duplicate = match &e {
            oore_core::OoreError::Database(sqlx::Error::Database(db_err)) => {
                // SQLite error code 2067 is SQLITE_CONSTRAINT_UNIQUE
                db_err.code().map(|c| c == "2067").unwrap_or(false)
                    || db_err.message().contains("UNIQUE constraint failed")
            }
            _ => false,
        };

        if is_duplicate {
            tracing::debug!("Duplicate GitHub webhook delivery (race condition): {}", event.delivery_id);
            return (StatusCode::OK, Json(json!({"status": "duplicate"})));
        }

        tracing::error!("Failed to store webhook event: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to store event"})),
        );
    }

    // 9. Queue for async processing (non-blocking)
    let job = WebhookJob {
        event_id: event.id.clone(),
        provider: GitProvider::GitHub,
        event_type: event_type.to_string(),
    };
    if let Err(e) = state.webhook_tx.try_send(job) {
        // Event is stored in DB and will be processed on recovery, but signal backpressure
        tracing::warn!("Webhook queue full ({}), event {} will be processed on recovery", e, event.id);
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "queued_for_recovery",
                "event_id": event.id.to_string(),
                "message": "Webhook queue is full. Event stored and will be processed when capacity is available."
            })),
        );
    }

    // 10. Return 202 Accepted
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "accepted",
            "event_id": event.id.to_string()
        })),
    )
}

/// Handler for GitLab webhooks.
///
/// POST /api/webhooks/gitlab/:repo_id
pub async fn handle_gitlab_webhook(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    // 1. Check body size limit
    if body.len() > MAX_WEBHOOK_SIZE {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(json!({"error": "Payload too large"})),
        );
    }

    // 2. Check if GitLab is configured
    let gitlab_config = match &state.gitlab_config {
        Some(config) => config,
        None => {
            tracing::warn!("GitLab webhook received but GitLab is not configured");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "GitLab integration not configured"})),
            );
        }
    };

    // 3. Look up repository
    let repository_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    let repo = match RepositoryRepo::get_by_id(&state.db, &repository_id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Repository not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to fetch repository: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    // 4. Verify token (constant-time)
    let token = headers
        .get("X-Gitlab-Token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let stored_hmac = match &repo.webhook_secret_hmac {
        Some(hmac) => hmac,
        None => {
            tracing::warn!("GitLab webhook received but no secret configured for repo");
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Webhook secret not configured"})),
            );
        }
    };

    let verifier = GitLabVerifier::new(&gitlab_config.server_pepper);
    if !verifier.verify(stored_hmac, token) {
        tracing::warn!("GitLab webhook token verification failed");
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid token"})),
        );
    }

    // 4b. Verify project ID in payload matches repository's stored gitlab_project_id
    // This prevents attackers from triggering builds on other repositories
    if let Some(stored_project_id) = repo.gitlab_project_id {
        match oore_core::webhook::extract_gitlab_repo_info(&body) {
            Ok((payload_project_id, _, _)) => {
                if payload_project_id != stored_project_id {
                    tracing::warn!(
                        "GitLab webhook project ID mismatch: payload={}, stored={}",
                        payload_project_id,
                        stored_project_id
                    );
                    return (
                        StatusCode::FORBIDDEN,
                        Json(json!({"error": "Project ID mismatch"})),
                    );
                }
            }
            Err(e) => {
                tracing::warn!("Failed to extract project ID from GitLab payload: {}", e);
                // Continue without validation if we can't parse the payload
                // The webhook processor will handle invalid payloads
            }
        }
    }

    // 5. Extract headers
    let delivery_id = headers
        .get("X-Gitlab-Event-UUID")
        .and_then(|v| v.to_str().ok())
        .map(String::from)
        .unwrap_or_else(|| format!("sha256:{}", sha256_hex(&body)));

    let event_type = headers
        .get("X-Gitlab-Event")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    // 6. Check idempotency
    match WebhookEventRepo::exists_by_delivery(&state.db, GitProvider::GitLab, &delivery_id).await {
        Ok(true) => {
            tracing::debug!("Duplicate GitLab webhook delivery: {}", delivery_id);
            return (StatusCode::OK, Json(json!({"status": "duplicate"})));
        }
        Ok(false) => {}
        Err(e) => {
            tracing::error!("Failed to check duplicate delivery: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    // 7. Store webhook event
    let event = WebhookEvent {
        id: WebhookEventId::new(),
        repository_id: Some(repository_id),
        provider: GitProvider::GitLab,
        event_type: event_type.to_string(),
        delivery_id,
        payload: body.to_vec(),
        processed: false,
        error_message: None,
        received_at: Utc::now(),
    };

    if let Err(e) = WebhookEventRepo::create(&state.db, &event).await {
        // Check if this is a unique constraint violation (race condition with duplicate delivery)
        let is_duplicate = match &e {
            oore_core::OoreError::Database(sqlx::Error::Database(db_err)) => {
                // SQLite error code 2067 is SQLITE_CONSTRAINT_UNIQUE
                db_err.code().map(|c| c == "2067").unwrap_or(false)
                    || db_err.message().contains("UNIQUE constraint failed")
            }
            _ => false,
        };

        if is_duplicate {
            tracing::debug!("Duplicate GitLab webhook delivery (race condition): {}", event.delivery_id);
            return (StatusCode::OK, Json(json!({"status": "duplicate"})));
        }

        tracing::error!("Failed to store webhook event: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to store event"})),
        );
    }

    // 8. Queue for async processing
    let job = WebhookJob {
        event_id: event.id.clone(),
        provider: GitProvider::GitLab,
        event_type: event_type.to_string(),
    };
    if let Err(e) = state.webhook_tx.try_send(job) {
        // Event is stored in DB and will be processed on recovery, but signal backpressure
        tracing::warn!("Webhook queue full ({}), event {} will be processed on recovery", e, event.id);
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "queued_for_recovery",
                "event_id": event.id.to_string(),
                "message": "Webhook queue is full. Event stored and will be processed when capacity is available."
            })),
        );
    }

    // 9. Return 202 Accepted
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "accepted",
            "event_id": event.id.to_string()
        })),
    )
}

/// List webhook events.
///
/// GET /api/webhooks/events
pub async fn list_webhook_events(State(state): State<AppState>) -> impl IntoResponse {
    match WebhookEventRepo::list(&state.db, None).await {
        Ok(events) => {
            let responses: Vec<_> = events
                .into_iter()
                .map(oore_core::models::WebhookEventResponse::from)
                .collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list webhook events: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Get a webhook event by ID.
///
/// GET /api/webhooks/events/:id
pub async fn get_webhook_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let event_id = match WebhookEventId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid event ID"})),
            );
        }
    };

    match WebhookEventRepo::get_by_id(&state.db, &event_id).await {
        Ok(Some(event)) => {
            let response = oore_core::models::WebhookEventResponse::from(event);
            (StatusCode::OK, Json(json!(response)))
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Event not found"})),
        ),
        Err(e) => {
            tracing::error!("Failed to get webhook event: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Resolves a repository from a GitHub webhook payload.
async fn resolve_github_repository(
    state: &AppState,
    body: &[u8],
) -> Result<Option<RepositoryId>, oore_core::OoreError> {
    use oore_core::webhook::extract_github_repo_info;

    let (github_repo_id, owner, repo_name, _installation_id) = extract_github_repo_info(body)?;

    // Try to find by GitHub repository ID first
    if let Some(repo) = RepositoryRepo::get_by_github_repo_id(&state.db, github_repo_id).await? {
        return Ok(Some(repo.id));
    }

    // Fall back to owner/repo lookup
    if let Some(repo) =
        RepositoryRepo::get_by_full_name(&state.db, GitProvider::GitHub, &owner, &repo_name).await?
    {
        return Ok(Some(repo.id));
    }

    Ok(None)
}
