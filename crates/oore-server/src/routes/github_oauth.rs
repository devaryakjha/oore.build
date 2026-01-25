//! GitHub App manifest flow endpoints.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use oore_core::db::credentials::{
    GitHubAppCredentialsRepo, GitHubAppInstallationRepo, GitHubInstallationRepoRepo, OAuthStateRepo,
};
use oore_core::oauth::github::{GitHubAppManifest, GitHubAppStatus, GitHubClient, ManifestResponse};

use crate::state::AppState;

/// Error response type.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

fn error_response(status: StatusCode, code: &str, message: &str) -> impl IntoResponse {
    (
        status,
        Json(ErrorResponse {
            error: ErrorDetail {
                code: code.to_string(),
                message: message.to_string(),
            },
        }),
    )
}

/// GET /api/github/manifest - Returns manifest JSON and redirect URL.
pub async fn get_manifest(State(state): State<AppState>) -> impl IntoResponse {
    // Check if already configured
    match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(_)) => {
            return error_response(
                StatusCode::CONFLICT,
                "ALREADY_CONFIGURED",
                "GitHub App is already configured. Use DELETE /api/github/app?force=true to remove first.",
            )
            .into_response();
        }
        Ok(None) => {}
        Err(e) => {
            tracing::error!("Failed to check GitHub credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to check existing configuration",
            )
            .into_response();
        }
    }

    // Create OAuth state
    let oauth_state = OAuthStateRepo::new_state("github", None);
    if let Err(e) = OAuthStateRepo::create(&state.db, &oauth_state).await {
        tracing::error!("Failed to create OAuth state: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to create OAuth state",
        )
        .into_response();
    }

    // Build manifest
    let manifest = GitHubAppManifest::new(&state.config.base_url_parsed, None);

    // Build creation URL
    let create_url = format!(
        "{}/setup/github/create?state={}",
        state.config.base_url.trim_end_matches('/'),
        &oauth_state.state
    );

    let response = ManifestResponse {
        manifest,
        create_url,
        state: oauth_state.state,
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// Callback query parameters.
#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: String,
}

/// POST /api/github/callback - Exchanges code for credentials.
pub async fn handle_callback(
    State(state): State<AppState>,
    Json(params): Json<CallbackQuery>,
) -> impl IntoResponse {
    // Validate state
    let oauth_state = match OAuthStateRepo::consume(&state.db, &params.state, "github").await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_STATE",
                "Invalid or expired state parameter",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to validate OAuth state: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to validate state",
            )
            .into_response();
        }
    };

    tracing::debug!("OAuth state consumed: {:?}", oauth_state);

    // Get encryption key
    let encryption_key = match state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            return error_response(StatusCode::SERVICE_UNAVAILABLE, "ENCRYPTION_NOT_CONFIGURED", msg)
                .into_response();
        }
    };

    // Create GitHub client
    let client = match GitHubClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitHub client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitHub client",
            )
            .into_response();
        }
    };

    // Exchange code for app credentials
    let app_response = match client.exchange_manifest_code(&params.code).await {
        Ok(app) => app,
        Err(e) => {
            tracing::error!("Failed to exchange manifest code: {}", e);
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "CODE_EXCHANGE_FAILED",
                &format!("Failed to exchange code: {}", e),
            )
            .into_response();
        }
    };

    // Check for existing app with same ID (idempotency)
    if let Ok(Some(existing)) = GitHubAppCredentialsRepo::get_by_app_id(&state.db, app_response.id).await {
        tracing::info!(
            "GitHub App {} already exists, returning existing",
            app_response.id
        );

        let installations_count = match GitHubAppInstallationRepo::list_by_app(&state.db, &existing.id).await {
            Ok(i) => i.len(),
            Err(_) => 0,
        };

        let status = GitHubAppStatus::from_credentials(&existing, installations_count);
        return (StatusCode::OK, Json(status)).into_response();
    }

    // Create credentials
    let credentials = match client.create_credentials(&app_response) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ENCRYPTION_ERROR",
                "Failed to encrypt credentials",
            )
            .into_response();
        }
    };

    // Deactivate any existing credentials
    if let Err(e) = GitHubAppCredentialsRepo::deactivate_all(&state.db).await {
        tracing::warn!("Failed to deactivate existing credentials: {}", e);
    }

    // Store credentials
    if let Err(e) = GitHubAppCredentialsRepo::create(&state.db, &credentials).await {
        tracing::error!("Failed to store credentials: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to store credentials",
        )
        .into_response();
    }

    tracing::info!(
        "GitHub App {} ({}) configured successfully",
        credentials.app_name,
        credentials.app_id
    );

    let status = GitHubAppStatus::from_credentials(&credentials, 0);
    (StatusCode::CREATED, Json(status)).into_response()
}

/// Query parameters for setup status.
#[derive(Debug, Deserialize)]
pub struct StatusQuery {
    pub state: String,
}

/// Setup status response for CLI polling.
#[derive(Debug, Serialize)]
pub struct SetupStatusResponse {
    /// Status: "pending", "in_progress", "completed", "failed", "expired"
    pub status: String,
    /// Human-readable message
    pub message: String,
    /// App name (only when completed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    /// App ID (only when completed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_id: Option<i64>,
    /// App slug for building installation URL (only when completed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_slug: Option<String>,
}

/// GET /api/github/setup/status - Returns setup status for CLI polling.
/// Security: The state token itself serves as authorization.
pub async fn get_setup_status(
    State(state): State<AppState>,
    Query(params): Query<StatusQuery>,
) -> impl IntoResponse {
    tracing::debug!("Status poll for state: {}...", &params.state[..8.min(params.state.len())]);

    // Look up the state
    let oauth_state = match OAuthStateRepo::get_by_state(&state.db, &params.state, "github").await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(SetupStatusResponse {
                    status: "not_found".to_string(),
                    message: "State not found or invalid".to_string(),
                    app_name: None,
                    app_id: None,
                    app_slug: None,
                }),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to query OAuth state: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(SetupStatusResponse {
                    status: "error".to_string(),
                    message: "Internal server error".to_string(),
                    app_name: None,
                    app_id: None,
                    app_slug: None,
                }),
            )
                .into_response();
        }
    };

    let now = Utc::now();

    // Determine status based on state
    let response = if oauth_state.expires_at < now {
        SetupStatusResponse {
            status: "expired".to_string(),
            message: "Setup session has expired. Please run 'oore github setup' again.".to_string(),
            app_name: None,
            app_id: None,
            app_slug: None,
        }
    } else if oauth_state.completed_at.is_some() {
        // Fetch app_slug from credentials
        let app_slug = if let Some(app_id) = oauth_state.app_id {
            GitHubAppCredentialsRepo::get_by_app_id(&state.db, app_id)
                .await
                .ok()
                .flatten()
                .map(|c| c.app_slug)
        } else {
            None
        };

        SetupStatusResponse {
            status: "completed".to_string(),
            message: "GitHub App configured successfully".to_string(),
            app_name: oauth_state.app_name,
            app_id: oauth_state.app_id,
            app_slug,
        }
    } else if oauth_state.error_message.is_some() {
        SetupStatusResponse {
            status: "failed".to_string(),
            message: oauth_state.error_message.unwrap_or_else(|| "Unknown error".to_string()),
            app_name: None,
            app_id: None,
            app_slug: None,
        }
    } else if oauth_state.consumed_at.is_some() {
        SetupStatusResponse {
            status: "in_progress".to_string(),
            message: "Processing GitHub callback...".to_string(),
            app_name: None,
            app_id: None,
            app_slug: None,
        }
    } else {
        SetupStatusResponse {
            status: "pending".to_string(),
            message: "Waiting for GitHub App creation...".to_string(),
            app_name: None,
            app_id: None,
            app_slug: None,
        }
    };

    tracing::debug!("Status response: {}", response.status);
    (StatusCode::OK, Json(response)).into_response()
}

/// GET /api/github/app - Returns current GitHub App info.
pub async fn get_app(State(state): State<AppState>) -> impl IntoResponse {
    match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(creds)) => {
            let installations_count = match GitHubAppInstallationRepo::list_by_app(&state.db, &creds.id).await {
                Ok(i) => i.len(),
                Err(_) => 0,
            };
            let status = GitHubAppStatus::from_credentials(&creds, installations_count);
            (StatusCode::OK, Json(status)).into_response()
        }
        Ok(None) => {
            (StatusCode::OK, Json(GitHubAppStatus::not_configured())).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to fetch GitHub credentials: {}", e);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response()
        }
    }
}

/// DELETE query parameters.
#[derive(Debug, Deserialize)]
pub struct DeleteQuery {
    #[serde(default)]
    pub force: bool,
}

/// DELETE /api/github/app - Removes GitHub App credentials.
pub async fn delete_app(
    State(state): State<AppState>,
    Query(params): Query<DeleteQuery>,
) -> impl IntoResponse {
    if !params.force {
        return error_response(
            StatusCode::BAD_REQUEST,
            "FORCE_REQUIRED",
            "Use ?force=true to confirm deletion",
        )
        .into_response();
    }

    match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(creds)) => {
            if let Err(e) = GitHubAppCredentialsRepo::delete(&state.db, &creds.id).await {
                tracing::error!("Failed to delete credentials: {}", e);
                return error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "Failed to delete credentials",
                )
                .into_response();
            }

            tracing::info!("GitHub App {} deleted", creds.app_id);
            (StatusCode::NO_CONTENT, ()).into_response()
        }
        Ok(None) => {
            error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No GitHub App is configured",
            )
            .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to fetch GitHub credentials: {}", e);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response()
        }
    }
}

/// Installation list response.
#[derive(Debug, Serialize)]
pub struct InstallationsResponse {
    pub installations: Vec<InstallationInfo>,
}

#[derive(Debug, Serialize)]
pub struct InstallationInfo {
    pub installation_id: i64,
    pub account_login: String,
    pub account_type: String,
    pub repository_selection: String,
    pub is_active: bool,
}

/// GET /api/github/installations - Lists installations.
pub async fn list_installations(State(state): State<AppState>) -> impl IntoResponse {
    let creds = match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No GitHub App is configured",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch GitHub credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response();
        }
    };

    match GitHubAppInstallationRepo::list_by_app(&state.db, &creds.id).await {
        Ok(installations) => {
            let infos: Vec<InstallationInfo> = installations
                .iter()
                .map(|i| InstallationInfo {
                    installation_id: i.installation_id,
                    account_login: i.account_login.clone(),
                    account_type: i.account_type.clone(),
                    repository_selection: i.repository_selection.clone(),
                    is_active: i.is_active,
                })
                .collect();

            (StatusCode::OK, Json(InstallationsResponse { installations: infos })).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list installations: {}", e);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to list installations",
            )
            .into_response()
        }
    }
}

/// Sync response.
#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub message: String,
    pub installations_synced: usize,
    pub repositories_synced: usize,
}

/// POST /api/github/sync - Syncs installations and repos from GitHub.
pub async fn sync_installations(State(state): State<AppState>) -> impl IntoResponse {
    let creds = match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No GitHub App is configured",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch GitHub credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response();
        }
    };

    // Get encryption key
    let encryption_key = match state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            return error_response(StatusCode::SERVICE_UNAVAILABLE, "ENCRYPTION_NOT_CONFIGURED", msg)
                .into_response();
        }
    };

    // Create GitHub client
    let client = match GitHubClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitHub client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitHub client",
            )
            .into_response();
        }
    };

    // Fetch installations from GitHub
    let api_installations = match client.list_installations(&creds).await {
        Ok(i) => i,
        Err(e) => {
            tracing::error!("Failed to fetch installations from GitHub: {}", e);
            return error_response(
                StatusCode::BAD_GATEWAY,
                "GITHUB_API_ERROR",
                &format!("Failed to fetch installations: {}", e),
            )
            .into_response();
        }
    };

    let mut installations_synced = 0;
    let mut repositories_synced = 0;

    for api_installation in &api_installations {
        let installation = client.to_installation_model(&creds.id, api_installation);

        // Upsert installation
        if let Err(e) = GitHubAppInstallationRepo::upsert(&state.db, &installation).await {
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

                        if let Err(e) = GitHubInstallationRepoRepo::upsert(&state.db, &repo_model).await {
                            tracing::error!("Failed to upsert repo {}: {}", repo.full_name, e);
                            continue;
                        }

                        synced_repo_ids.push(repo.id);
                        repositories_synced += 1;
                    }

                    // Clean up removed repos
                    if let Err(e) = GitHubInstallationRepoRepo::delete_not_in(
                        &state.db,
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

    let response = SyncResponse {
        message: "Sync completed".to_string(),
        installations_synced,
        repositories_synced,
    };

    (StatusCode::ACCEPTED, Json(response)).into_response()
}
