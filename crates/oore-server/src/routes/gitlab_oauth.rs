//! GitLab OAuth endpoints.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use oore_core::db::credentials::{
    GitLabEnabledProject, GitLabEnabledProjectId, GitLabEnabledProjectRepo,
    GitLabOAuthAppRepo, GitLabOAuthCredentialsId, GitLabOAuthCredentialsRepo, OAuthStateRepo,
};
use oore_core::db::repository::RepositoryRepo;
use oore_core::models::{GitProvider, Repository, RepositoryId};
use oore_core::oauth::gitlab::{
    get_oauth_app_credentials, GitLabClient, GitLabCredentialsStatus, GitLabProjectInfo,
};

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

/// Connect request.
#[derive(Debug, Deserialize)]
pub struct ConnectRequest {
    #[serde(default = "default_gitlab_instance")]
    pub instance_url: String,
    #[serde(default)]
    pub replace: bool,
}

fn default_gitlab_instance() -> String {
    "https://gitlab.com".to_string()
}

/// Normalizes an instance URL by parsing and re-serializing it.
/// This ensures consistent trailing slash behavior for database lookups.
fn normalize_instance_url(url: &str) -> Result<String, String> {
    url::Url::parse(url)
        .map(|u| u.to_string())
        .map_err(|e| format!("Invalid URL: {}", e))
}

/// Connect response.
#[derive(Debug, Serialize)]
pub struct ConnectResponse {
    pub auth_url: String,
    pub instance_url: String,
    pub state: String,
}

/// POST /api/gitlab/connect - Initiates OAuth flow.
pub async fn connect(
    State(state): State<AppState>,
    Json(params): Json<ConnectRequest>,
) -> impl IntoResponse {
    // Get encryption key
    let encryption_key = match state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            return error_response(StatusCode::SERVICE_UNAVAILABLE, "ENCRYPTION_NOT_CONFIGURED", msg)
                .into_response();
        }
    };

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Validate instance URL
    let validated_url = match client.validate_instance_url(&params.instance_url) {
        Ok(v) => v,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &format!("Invalid GitLab instance URL: {}", e),
            )
            .into_response();
        }
    };

    let instance_url = validated_url.url.to_string();

    // Check if already configured
    if !params.replace
        && let Ok(Some(_)) = GitLabOAuthCredentialsRepo::get_by_instance(&state.db, &instance_url).await
    {
        return error_response(
            StatusCode::CONFLICT,
            "ALREADY_CONFIGURED",
            "GitLab credentials already exist for this instance. Use ?replace=true to overwrite.",
        )
        .into_response();
    }

    // Get OAuth app credentials for this instance
    let db_app = match GitLabOAuthAppRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(app) => app,
        Err(e) => {
            tracing::error!("Failed to fetch GitLab OAuth app: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch OAuth app",
            )
            .into_response();
        }
    };

    let (client_id, _) = match get_oauth_app_credentials(&instance_url, db_app.as_ref(), &client) {
        Ok(creds) => creds,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "NO_OAUTH_APP",
                &format!("{}", e),
            )
            .into_response();
        }
    };

    // Create OAuth state
    let oauth_state = OAuthStateRepo::new_state("gitlab", Some(instance_url.clone()));
    if let Err(e) = OAuthStateRepo::create(&state.db, &oauth_state).await {
        tracing::error!("Failed to create OAuth state: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to create OAuth state",
        )
        .into_response();
    }

    // Build redirect URI
    let redirect_uri = format!(
        "{}setup/gitlab/callback",
        state.config.base_url.trim_end_matches('/')
    );

    // Build auth URL
    let auth_url = match client.build_auth_url(&instance_url, &client_id, &redirect_uri, &oauth_state.state)
    {
        Ok(url) => url,
        Err(e) => {
            tracing::error!("Failed to build auth URL: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "URL_BUILD_ERROR",
                "Failed to build authorization URL",
            )
            .into_response();
        }
    };

    let response = ConnectResponse {
        auth_url,
        instance_url,
        state: oauth_state.state,
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// Setup request (for automated CLI flow).
#[derive(Debug, Deserialize)]
pub struct SetupRequest {
    #[serde(default = "default_gitlab_instance")]
    pub instance_url: String,
}

/// Setup response.
#[derive(Debug, Serialize)]
pub struct SetupResponse {
    pub auth_url: String,
    pub instance_url: String,
    pub state: String,
}

/// POST /api/gitlab/setup - Initiates automated setup flow (mirrors GitHub pattern).
pub async fn setup(
    State(state): State<AppState>,
    Json(params): Json<SetupRequest>,
) -> impl IntoResponse {
    // Get encryption key
    let encryption_key = match state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            return error_response(StatusCode::SERVICE_UNAVAILABLE, "ENCRYPTION_NOT_CONFIGURED", msg)
                .into_response();
        }
    };

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Validate instance URL
    let validated_url = match client.validate_instance_url(&params.instance_url) {
        Ok(v) => v,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &format!("Invalid GitLab instance URL: {}", e),
            )
            .into_response();
        }
    };

    let instance_url = validated_url.url.to_string();

    // Get OAuth app credentials for this instance
    let db_app = match GitLabOAuthAppRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(app) => app,
        Err(e) => {
            tracing::error!("Failed to fetch GitLab OAuth app: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch OAuth app",
            )
            .into_response();
        }
    };

    let (client_id, _) = match get_oauth_app_credentials(&instance_url, db_app.as_ref(), &client) {
        Ok(creds) => creds,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "NO_OAUTH_APP",
                &format!("{}", e),
            )
            .into_response();
        }
    };

    // Create OAuth state
    let oauth_state = OAuthStateRepo::new_state("gitlab", Some(instance_url.clone()));
    if let Err(e) = OAuthStateRepo::create(&state.db, &oauth_state).await {
        tracing::error!("Failed to create OAuth state: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to create OAuth state",
        )
        .into_response();
    }

    // Build redirect URI
    let redirect_uri = format!(
        "{}/setup/gitlab/callback",
        state.config.base_url.trim_end_matches('/')
    );

    // Build auth URL
    let auth_url = match client.build_auth_url(&instance_url, &client_id, &redirect_uri, &oauth_state.state)
    {
        Ok(url) => url,
        Err(e) => {
            tracing::error!("Failed to build auth URL: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "URL_BUILD_ERROR",
                "Failed to build authorization URL",
            )
            .into_response();
        }
    };

    tracing::info!("GitLab setup initiated for {}", instance_url);

    let response = SetupResponse {
        auth_url,
        instance_url,
        state: oauth_state.state,
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// Setup status query parameters.
#[derive(Debug, Deserialize)]
pub struct SetupStatusQuery {
    pub state: String,
}

/// Setup status response.
#[derive(Debug, Serialize)]
pub struct SetupStatusResponse {
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}

/// GET /api/gitlab/setup/status - Returns setup status for CLI polling.
/// This endpoint is public - the state token itself serves as authorization.
pub async fn get_setup_status(
    State(state): State<AppState>,
    Query(params): Query<SetupStatusQuery>,
) -> impl IntoResponse {
    // Look up OAuth state (non-consuming - just for status check)
    let oauth_state = match OAuthStateRepo::get_by_state(&state.db, &params.state, "gitlab").await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return (
                StatusCode::OK,
                Json(SetupStatusResponse {
                    status: "not_found".to_string(),
                    message: "Setup session not found or expired".to_string(),
                    instance_url: None,
                    username: None,
                }),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch OAuth state: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch setup status",
            )
            .into_response();
        }
    };

    // Determine status based on state fields
    let now = chrono::Utc::now();

    // Check if expired
    if oauth_state.expires_at < now {
        return (
            StatusCode::OK,
            Json(SetupStatusResponse {
                status: "expired".to_string(),
                message: "Setup session expired. Please run setup again.".to_string(),
                instance_url: None,
                username: None,
            }),
        )
            .into_response();
    }

    // Check if failed
    if let Some(ref error) = oauth_state.error_message {
        return (
            StatusCode::OK,
            Json(SetupStatusResponse {
                status: "failed".to_string(),
                message: error.clone(),
                instance_url: oauth_state.instance_url,
                username: None,
            }),
        )
            .into_response();
    }

    // Check if completed (app_id/app_name repurposed for user_id/username)
    if oauth_state.completed_at.is_some() {
        return (
            StatusCode::OK,
            Json(SetupStatusResponse {
                status: "completed".to_string(),
                message: "GitLab OAuth connected successfully".to_string(),
                instance_url: oauth_state.instance_url,
                username: oauth_state.app_name, // Repurposed for username
            }),
        )
            .into_response();
    }

    // Check if in progress (consumed but not completed)
    if oauth_state.consumed_at.is_some() {
        return (
            StatusCode::OK,
            Json(SetupStatusResponse {
                status: "in_progress".to_string(),
                message: "Processing GitLab authorization...".to_string(),
                instance_url: oauth_state.instance_url,
                username: None,
            }),
        )
            .into_response();
    }

    // Still pending
    (
        StatusCode::OK,
        Json(SetupStatusResponse {
            status: "pending".to_string(),
            message: "Waiting for GitLab authorization...".to_string(),
            instance_url: oauth_state.instance_url,
            username: None,
        }),
    )
        .into_response()
}

/// Callback request.
#[derive(Debug, Deserialize)]
pub struct CallbackRequest {
    pub code: String,
    pub state: String,
}

/// POST /api/gitlab/callback - Handles OAuth callback.
pub async fn handle_callback(
    State(state): State<AppState>,
    Json(params): Json<CallbackRequest>,
) -> impl IntoResponse {
    // Validate and consume state
    let oauth_state = match OAuthStateRepo::consume(&state.db, &params.state, "gitlab").await {
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

    // Get instance URL - must be present, was set during setup
    let instance_url = match oauth_state.instance_url {
        Some(url) => url,
        None => {
            tracing::error!("OAuth state missing instance_url for state: {}", params.state);
            let _ = OAuthStateRepo::mark_failed(&state.db, &params.state, "Internal error: missing instance URL").await;
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INVALID_STATE",
                "Setup session is corrupted. Please run 'oore gitlab setup' again.",
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

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Get OAuth app credentials
    let db_app = match GitLabOAuthAppRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(app) => app,
        Err(e) => {
            tracing::error!("Failed to fetch GitLab OAuth app: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch OAuth app",
            )
            .into_response();
        }
    };

    let (client_id, client_secret) =
        match get_oauth_app_credentials(&instance_url, db_app.as_ref(), &client) {
            Ok(creds) => creds,
            Err(e) => {
                return error_response(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "NO_OAUTH_APP",
                    &format!("{}", e),
                )
                .into_response();
            }
        };

    // Build redirect URI
    let redirect_uri = format!(
        "{}setup/gitlab/callback",
        state.config.base_url.trim_end_matches('/')
    );

    // Exchange code for tokens
    let token_response = match client
        .exchange_code(&instance_url, &client_id, &client_secret, &params.code, &redirect_uri)
        .await
    {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to exchange GitLab code: {}", e);
            // Mark state as failed for CLI polling
            let error_msg = format!("Failed to exchange code: {}", e);
            let _ = OAuthStateRepo::mark_failed(&state.db, &params.state, &error_msg).await;
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "CODE_EXCHANGE_FAILED",
                &error_msg,
            )
            .into_response();
        }
    };

    // Get user info
    let user = match client.get_user(&instance_url, &token_response.access_token).await {
        Ok(u) => u,
        Err(e) => {
            tracing::error!("Failed to get GitLab user info: {}", e);
            // Mark state as failed for CLI polling
            let error_msg = format!("Failed to get user info: {}", e);
            let _ = OAuthStateRepo::mark_failed(&state.db, &params.state, &error_msg).await;
            return error_response(
                StatusCode::BAD_GATEWAY,
                "GITLAB_API_ERROR",
                &error_msg,
            )
            .into_response();
        }
    };

    // Create credentials
    let credentials = match client.create_credentials(&instance_url, &token_response, &user) {
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

    // Deactivate existing credentials for this instance
    if let Err(e) = GitLabOAuthCredentialsRepo::deactivate_by_instance(&state.db, &instance_url).await {
        tracing::warn!("Failed to deactivate existing credentials: {}", e);
    }

    // Store credentials
    if let Err(e) = GitLabOAuthCredentialsRepo::create(&state.db, &credentials).await {
        tracing::error!("Failed to store credentials: {}", e);
        // Mark state as failed for CLI polling
        let _ = OAuthStateRepo::mark_failed(&state.db, &params.state, "Failed to store credentials").await;
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to store credentials",
        )
        .into_response();
    }

    tracing::info!(
        "GitLab OAuth connected for {} (user: {})",
        instance_url,
        user.username
    );

    // Mark state as completed for CLI polling (reuse app_id/app_name for user_id/username)
    match OAuthStateRepo::mark_completed(&state.db, &params.state, user.id, &user.username).await {
        Ok(true) => tracing::info!("OAuth state marked as completed for user: {}", user.username),
        Ok(false) => tracing::warn!("Failed to mark OAuth state as completed (no rows updated)"),
        Err(e) => tracing::error!("Failed to mark OAuth state as completed: {}", e),
    }

    let status = GitLabCredentialsStatus::from_credentials(&credentials, &client, 0);
    (StatusCode::CREATED, Json(status)).into_response()
}

/// GET /api/gitlab/credentials - Returns current credentials.
pub async fn list_credentials(State(state): State<AppState>) -> impl IntoResponse {
    // Get encryption key for token status check
    let client = match state.require_encryption_key() {
        Ok(key) => GitLabClient::new(key.clone()).ok(),
        Err(_) => None,
    };

    match GitLabOAuthCredentialsRepo::list_active(&state.db).await {
        Ok(creds_list) => {
            let mut statuses = Vec::new();

            for creds in &creds_list {
                let projects_count =
                    match GitLabEnabledProjectRepo::list_by_credential(&state.db, &creds.id).await {
                        Ok(p) => p.len(),
                        Err(_) => 0,
                    };

                if let Some(ref c) = client {
                    statuses.push(GitLabCredentialsStatus::from_credentials(creds, c, projects_count));
                } else {
                    statuses.push(GitLabCredentialsStatus {
                        id: creds.id.to_string(),
                        configured: true,
                        instance_url: Some(creds.instance_url.clone()),
                        username: Some(creds.username.clone()),
                        user_id: Some(creds.user_id),
                        token_expires_at: creds.token_expires_at.map(|t| t.to_rfc3339()),
                        needs_refresh: false,
                        enabled_projects_count: projects_count,
                    });
                }
            }

            (StatusCode::OK, Json(statuses)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list GitLab credentials: {}", e);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to list credentials",
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

/// DELETE /api/gitlab/credentials/{id} - Removes credentials.
///
/// This also cleans up:
/// - All enabled projects associated with the credentials
/// - Webhooks on GitLab (best effort)
/// - Associated repository entries (deactivated)
pub async fn delete_credentials(
    State(state): State<AppState>,
    Path(id): Path<String>,
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

    let creds_id = match GitLabOAuthCredentialsId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return error_response(StatusCode::BAD_REQUEST, "INVALID_ID", "Invalid credentials ID")
                .into_response();
        }
    };

    let creds = match GitLabOAuthCredentialsRepo::get_by_id(&state.db, &creds_id).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Credentials not found")
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response();
        }
    };

    // Clean up enabled projects and webhooks before deleting credentials
    let enabled_projects = match GitLabEnabledProjectRepo::deactivate_by_credential(&state.db, &creds_id).await {
        Ok(projects) => projects,
        Err(e) => {
            tracing::warn!("Failed to deactivate enabled projects: {}", e);
            vec![]
        }
    };

    // Try to delete webhooks from GitLab (best effort)
    if !enabled_projects.is_empty()
        && let Ok(key) = state.require_encryption_key()
        && let Ok(client) = GitLabClient::new(key.clone())
        && let Ok(access_token) = client.decrypt_access_token(&creds)
    {
        for project in &enabled_projects {
            if let Some(webhook_id) = project.webhook_id
                && let Err(e) = client
                    .delete_webhook(&creds.instance_url, &access_token, project.project_id, webhook_id)
                    .await
            {
                tracing::warn!(
                    "Failed to delete webhook {} for project {}: {}",
                    webhook_id,
                    project.project_id,
                    e
                );
            }

            // Deactivate associated repository
            if let Err(e) = RepositoryRepo::deactivate(&state.db, &project.repository_id).await {
                tracing::warn!("Failed to deactivate repository {}: {}", project.repository_id, e);
            }
        }
    }

    // Delete the credentials
    if let Err(e) = GitLabOAuthCredentialsRepo::delete(&state.db, &creds_id).await {
        tracing::error!("Failed to delete credentials: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to delete credentials",
        )
        .into_response();
    }

    tracing::info!(
        "GitLab credentials {} deleted (cleaned up {} enabled projects)",
        id,
        enabled_projects.len()
    );
    (StatusCode::NO_CONTENT, ()).into_response()
}

/// Projects query parameters.
#[derive(Debug, Deserialize)]
pub struct ProjectsQuery {
    #[serde(default = "default_gitlab_instance")]
    pub instance_url: String,
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_per_page")]
    pub per_page: u32,
}

fn default_page() -> u32 {
    1
}

fn default_per_page() -> u32 {
    20
}

/// GET /api/gitlab/projects - Lists accessible projects.
pub async fn list_projects(
    State(state): State<AppState>,
    Query(params): Query<ProjectsQuery>,
) -> impl IntoResponse {
    // Normalize instance URL for consistent database lookup
    let instance_url = match normalize_instance_url(&params.instance_url) {
        Ok(url) => url,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &e,
            )
            .into_response();
        }
    };

    // Get credentials for instance
    let creds = match GitLabOAuthCredentialsRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No credentials for this GitLab instance",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch credentials: {}", e);
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

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Decrypt access token
    let access_token = match client.decrypt_access_token(&creds) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to decrypt access token: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DECRYPTION_ERROR",
                "Failed to decrypt access token",
            )
            .into_response();
        }
    };

    // Get enabled project IDs
    let enabled_project_ids: Vec<i64> =
        match GitLabEnabledProjectRepo::list_by_credential(&state.db, &creds.id).await {
            Ok(projects) => projects.iter().map(|p| p.project_id).collect(),
            Err(_) => vec![],
        };

    // Fetch projects from GitLab
    match client
        .list_projects(&creds.instance_url, &access_token, params.page, params.per_page)
        .await
    {
        Ok(projects) => {
            let project_infos: Vec<GitLabProjectInfo> = projects
                .iter()
                .map(|p| {
                    let ci_enabled = enabled_project_ids.contains(&p.id);
                    GitLabProjectInfo::from_api_project(p, ci_enabled)
                })
                .collect();

            (StatusCode::OK, Json(project_infos)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to fetch projects from GitLab: {}", e);
            error_response(
                StatusCode::BAD_GATEWAY,
                "GITLAB_API_ERROR",
                &format!("Failed to fetch projects: {}", e),
            )
            .into_response()
        }
    }
}

/// Enable project request.
#[derive(Debug, Deserialize)]
pub struct EnableProjectRequest {
    #[serde(default = "default_gitlab_instance")]
    pub instance_url: String,
}

/// PUT /api/gitlab/projects/{id}/enabled - Enables CI for a project.
pub async fn enable_project(
    State(state): State<AppState>,
    Path(project_id): Path<i64>,
    Json(params): Json<EnableProjectRequest>,
) -> impl IntoResponse {
    // Normalize instance URL for consistent database lookup
    let instance_url = match normalize_instance_url(&params.instance_url) {
        Ok(url) => url,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &e,
            )
            .into_response();
        }
    };

    // Get credentials
    let creds = match GitLabOAuthCredentialsRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No credentials for this GitLab instance",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response();
        }
    };

    // Check if already enabled
    if let Ok(Some(_)) =
        GitLabEnabledProjectRepo::get_by_project_id(&state.db, &creds.id, project_id).await
    {
        return error_response(
            StatusCode::CONFLICT,
            "ALREADY_ENABLED",
            "Project is already enabled for CI",
        )
        .into_response();
    }

    // Get encryption key
    let encryption_key = match state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            return error_response(StatusCode::SERVICE_UNAVAILABLE, "ENCRYPTION_NOT_CONFIGURED", msg)
                .into_response();
        }
    };

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Decrypt access token
    let access_token = match client.decrypt_access_token(&creds) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to decrypt access token: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DECRYPTION_ERROR",
                "Failed to decrypt access token",
            )
            .into_response();
        }
    };

    // Fetch project info
    let project = match client.get_project(&creds.instance_url, &access_token, project_id).await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to fetch project {}: {}", project_id, e);
            return error_response(
                StatusCode::BAD_GATEWAY,
                "GITLAB_API_ERROR",
                &format!("Failed to fetch project: {}", e),
            )
            .into_response();
        }
    };

    // Create repository entry
    let (owner, repo_name) = match project.path_with_namespace.split_once('/') {
        Some((o, r)) => (o.to_string(), r.to_string()),
        None => (project.path_with_namespace.clone(), project.path.clone()),
    };

    let repo_id = RepositoryId::new();

    // Generate webhook token - must use server_pepper for HMAC to match verification
    let gitlab_config = match &state.gitlab_config {
        Some(config) => config,
        None => {
            return error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                "GITLAB_NOT_CONFIGURED",
                "GitLab integration not configured (GITLAB_SERVER_PEPPER required)",
            )
            .into_response();
        }
    };

    let webhook_token = OAuthStateRepo::generate_state();
    let webhook_token_hmac = oore_core::crypto::compute_gitlab_token_hmac(
        &gitlab_config.server_pepper,
        &webhook_token,
    );

    let repository = Repository {
        id: repo_id.clone(),
        name: project.name.clone(),
        provider: GitProvider::GitLab,
        owner: owner.clone(),
        repo_name: repo_name.clone(),
        clone_url: project.http_url_to_repo.clone(),
        default_branch: project.default_branch.clone().unwrap_or_else(|| "main".to_string()),
        webhook_secret_hmac: Some(webhook_token_hmac.clone()),
        is_active: true,
        github_repository_id: None,
        github_installation_id: None,
        gitlab_project_id: Some(project_id),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Store repository
    if let Err(e) = RepositoryRepo::create(&state.db, &repository).await {
        tracing::error!("Failed to create repository: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to create repository",
        )
        .into_response();
    }

    // Create webhook on GitLab
    let webhook_url = format!(
        "{}api/webhooks/gitlab/{}",
        state.config.base_url.trim_end_matches('/'),
        repo_id
    );

    let webhook = match client
        .create_webhook(&creds.instance_url, &access_token, project_id, &webhook_url, &webhook_token)
        .await
    {
        Ok(w) => w,
        Err(e) => {
            tracing::error!("Failed to create webhook: {}", e);
            // Clean up repository
            let _ = RepositoryRepo::delete(&state.db, &repo_id).await;
            return error_response(
                StatusCode::BAD_GATEWAY,
                "GITLAB_API_ERROR",
                &format!("Failed to create webhook: {}", e),
            )
            .into_response();
        }
    };

    // Create enabled project entry
    let enabled_project = GitLabEnabledProject {
        id: GitLabEnabledProjectId::new(),
        gitlab_credential_id: creds.id.clone(),
        repository_id: repo_id.clone(),
        project_id,
        webhook_id: Some(webhook.id),
        webhook_token_hmac: Some(webhook_token_hmac),
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    if let Err(e) = GitLabEnabledProjectRepo::create(&state.db, &enabled_project).await {
        tracing::error!("Failed to create enabled project: {}", e);
        // Clean up
        let _ = RepositoryRepo::delete(&state.db, &repo_id).await;
        let _ = client
            .delete_webhook(&creds.instance_url, &access_token, project_id, webhook.id)
            .await;
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to enable project",
        )
        .into_response();
    }

    tracing::info!("Enabled CI for GitLab project {} ({})", project_id, project.name);

    let info = GitLabProjectInfo::from_api_project(&project, true);
    (StatusCode::CREATED, Json(info)).into_response()
}

/// DELETE /api/gitlab/projects/{id}/enabled - Disables CI for a project.
pub async fn disable_project(
    State(state): State<AppState>,
    Path(project_id): Path<i64>,
    Query(params): Query<EnableProjectRequest>,
) -> impl IntoResponse {
    // Normalize instance URL for consistent database lookup
    let instance_url = match normalize_instance_url(&params.instance_url) {
        Ok(url) => url,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &e,
            )
            .into_response();
        }
    };

    // Get credentials
    let creds = match GitLabOAuthCredentialsRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No credentials for this GitLab instance",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch credentials: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch credentials",
            )
            .into_response();
        }
    };

    // Get enabled project
    let enabled_project = match GitLabEnabledProjectRepo::get_by_project_id(&state.db, &creds.id, project_id)
        .await
    {
        Ok(Some(p)) => p,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_ENABLED",
                "Project is not enabled for CI",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch enabled project: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch project",
            )
            .into_response();
        }
    };

    // Get encryption key and client - try to delete webhook from GitLab
    if let Ok(key) = state.require_encryption_key()
        && let Ok(client) = GitLabClient::new(key.clone())
        && let Ok(access_token) = client.decrypt_access_token(&creds)
        && let Some(webhook_id) = enabled_project.webhook_id
        && let Err(e) = client
            .delete_webhook(&creds.instance_url, &access_token, project_id, webhook_id)
            .await
    {
        tracing::warn!("Failed to delete webhook: {}", e);
    }

    // Deactivate enabled project
    if let Err(e) = GitLabEnabledProjectRepo::deactivate(&state.db, &enabled_project.id).await {
        tracing::error!("Failed to deactivate project: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to disable project",
        )
        .into_response();
    }

    tracing::info!("Disabled CI for GitLab project {}", project_id);
    (StatusCode::NO_CONTENT, ()).into_response()
}

/// POST /api/gitlab/refresh - Refreshes OAuth token.
pub async fn refresh_token(
    State(state): State<AppState>,
    Query(params): Query<EnableProjectRequest>,
) -> impl IntoResponse {
    // Normalize instance URL for consistent database lookup
    let instance_url = match normalize_instance_url(&params.instance_url) {
        Ok(url) => url,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &e,
            )
            .into_response();
        }
    };

    // Get credentials
    let creds = match GitLabOAuthCredentialsRepo::get_by_instance(&state.db, &instance_url).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_CONFIGURED",
                "No credentials for this GitLab instance",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch credentials: {}", e);
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

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Check if refresh is needed
    if !client.token_needs_refresh(&creds) {
        return error_response(
            StatusCode::OK,
            "NO_REFRESH_NEEDED",
            "Token does not need refresh",
        )
        .into_response();
    }

    // Get refresh token
    let refresh_token = match client.decrypt_refresh_token(&creds) {
        Ok(Some(t)) => t,
        Ok(None) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "NO_REFRESH_TOKEN",
                "No refresh token available. Re-authenticate required.",
            )
            .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to decrypt refresh token: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DECRYPTION_ERROR",
                "Failed to decrypt refresh token",
            )
            .into_response();
        }
    };

    // Get OAuth app credentials
    let db_app = match GitLabOAuthAppRepo::get_by_instance(&state.db, &creds.instance_url).await {
        Ok(app) => app,
        Err(e) => {
            tracing::error!("Failed to fetch GitLab OAuth app: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Failed to fetch OAuth app",
            )
            .into_response();
        }
    };

    let (client_id, client_secret) =
        match get_oauth_app_credentials(&creds.instance_url, db_app.as_ref(), &client) {
            Ok(c) => c,
            Err(e) => {
                return error_response(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "NO_OAUTH_APP",
                    &format!("{}", e),
                )
                .into_response();
            }
        };

    // Refresh token
    let token_response = match client
        .refresh_token(&creds.instance_url, &client_id, &client_secret, &refresh_token)
        .await
    {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to refresh token: {}", e);
            return error_response(
                StatusCode::BAD_GATEWAY,
                "REFRESH_FAILED",
                &format!("Token refresh failed: {}", e),
            )
            .into_response();
        }
    };

    // Encrypt new tokens
    let (
        access_token_encrypted,
        access_token_nonce,
        refresh_token_encrypted,
        refresh_token_nonce,
        token_expires_at,
    ) = match client.encrypt_new_tokens(&creds.id, &token_response) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to encrypt new tokens: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ENCRYPTION_ERROR",
                "Failed to encrypt new tokens",
            )
            .into_response();
        }
    };

    // Update credentials
    if let Err(e) = GitLabOAuthCredentialsRepo::update_tokens(
        &state.db,
        &creds.id,
        &access_token_encrypted,
        &access_token_nonce,
        refresh_token_encrypted.as_deref(),
        refresh_token_nonce.as_deref(),
        token_expires_at,
    )
    .await
    {
        tracing::error!("Failed to update tokens: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to update tokens",
        )
        .into_response();
    }

    tracing::info!("Refreshed GitLab token for {}", creds.instance_url);

    #[derive(Serialize)]
    struct RefreshResponse {
        message: String,
        expires_at: Option<String>,
    }

    let response = RefreshResponse {
        message: "Token refreshed successfully".to_string(),
        expires_at: token_expires_at.map(|t| t.to_rfc3339()),
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// Register OAuth app request.
#[derive(Debug, Deserialize)]
pub struct RegisterAppRequest {
    pub instance_url: String,
    pub client_id: String,
    pub client_secret: String,
}

/// POST /api/gitlab/apps - Registers OAuth app for self-hosted instance.
pub async fn register_app(
    State(state): State<AppState>,
    Json(params): Json<RegisterAppRequest>,
) -> impl IntoResponse {
    // Get encryption key
    let encryption_key = match state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            return error_response(StatusCode::SERVICE_UNAVAILABLE, "ENCRYPTION_NOT_CONFIGURED", msg)
                .into_response();
        }
    };

    // Create GitLab client
    let client = match GitLabClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitLab client: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CLIENT_ERROR",
                "Failed to create GitLab client",
            )
            .into_response();
        }
    };

    // Validate instance URL
    let validated_url = match client.validate_instance_url(&params.instance_url) {
        Ok(v) => v,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_INSTANCE_URL",
                &format!("Invalid GitLab instance URL: {}", e),
            )
            .into_response();
        }
    };

    let instance_url = validated_url.url.to_string();

    // Create OAuth app record
    let app = match client.create_oauth_app(&instance_url, &params.client_id, &params.client_secret) {
        Ok(a) => a,
        Err(e) => {
            tracing::error!("Failed to create OAuth app: {}", e);
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ENCRYPTION_ERROR",
                "Failed to encrypt client secret",
            )
            .into_response();
        }
    };

    // Store app
    if let Err(e) = GitLabOAuthAppRepo::upsert(&state.db, &app).await {
        tracing::error!("Failed to store OAuth app: {}", e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Failed to store OAuth app",
        )
        .into_response();
    }

    tracing::info!("Registered GitLab OAuth app for {}", instance_url);

    #[derive(Serialize)]
    struct RegisterResponse {
        message: String,
        instance_url: String,
    }

    let response = RegisterResponse {
        message: "OAuth app registered successfully".to_string(),
        instance_url,
    };

    (StatusCode::CREATED, Json(response)).into_response()
}
