//! Repository management endpoints.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use oore_core::{
    crypto::compute_gitlab_token_hmac,
    db::repository::RepositoryRepo,
    models::{
        CreateRepositoryRequest, GitProvider, Repository, RepositoryId, RepositoryResponse,
        UpdateRepositoryRequest,
    },
    providers::{github_clone_url, github_webhook_url, gitlab_clone_url, gitlab_webhook_url},
};
use serde_json::json;

use crate::state::AppState;

/// List all repositories.
///
/// GET /api/repositories
pub async fn list_repositories(State(state): State<AppState>) -> impl IntoResponse {
    // Return demo data if demo mode is enabled
    if let Some(ref demo) = state.demo_provider {
        match demo.list_repositories() {
            Ok(repos) => {
                let responses: Vec<RepositoryResponse> =
                    repos.into_iter().map(RepositoryResponse::from).collect();
                return (StatusCode::OK, Json(json!(responses)));
            }
            Err(e) => {
                tracing::error!("Demo provider error: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Demo provider error"})),
                );
            }
        }
    }

    match RepositoryRepo::list(&state.db).await {
        Ok(repos) => {
            let responses: Vec<RepositoryResponse> =
                repos.into_iter().map(RepositoryResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list repositories: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Get a repository by ID.
///
/// GET /api/repositories/:id
pub async fn get_repository(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Return demo data if demo mode is enabled
    if let Some(ref demo) = state.demo_provider {
        match demo.get_repository(&repo_id) {
            Ok(Some(repo)) => {
                let response = RepositoryResponse::from(repo);
                return (StatusCode::OK, Json(json!(response)));
            }
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "Repository not found"})),
                );
            }
            Err(e) => {
                tracing::error!("Demo provider error: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Demo provider error"})),
                );
            }
        }
    }

    match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        Ok(Some(repo)) => {
            let response = RepositoryResponse::from(repo);
            (StatusCode::OK, Json(json!(response)))
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Repository not found"})),
        ),
        Err(e) => {
            tracing::error!("Failed to get repository: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Create a new repository.
///
/// POST /api/repositories
pub async fn create_repository(
    State(state): State<AppState>,
    Json(req): Json<CreateRepositoryRequest>,
) -> impl IntoResponse {
    // Parse provider
    let provider: GitProvider = match req.provider.parse() {
        Ok(p) => p,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid provider. Use 'github' or 'gitlab'"})),
            );
        }
    };

    // Generate clone URL if not provided
    let clone_url = req.clone_url.unwrap_or_else(|| match provider {
        GitProvider::GitHub => github_clone_url(&req.owner, &req.repo_name),
        GitProvider::GitLab => {
            let base = state
                .gitlab_config
                .as_ref()
                .map(|c| c.api_base_url.as_str())
                .unwrap_or("https://gitlab.com");
            gitlab_clone_url(base, &req.owner, &req.repo_name)
        }
    });

    // Generate name if not provided
    let name = req
        .name
        .unwrap_or_else(|| format!("{}/{}", req.owner, req.repo_name));

    // Create repository
    let mut repo = Repository::new(name, provider, req.owner, req.repo_name, clone_url);

    // Set default branch if provided
    if let Some(branch) = req.default_branch {
        repo.default_branch = branch;
    }

    // Set provider-specific IDs
    repo.github_repository_id = req.github_repository_id;
    repo.github_installation_id = req.github_installation_id;
    repo.gitlab_project_id = req.gitlab_project_id;

    // Hash webhook secret if provided (for GitLab)
    if let Some(secret) = req.webhook_secret
        && provider == GitProvider::GitLab
    {
        if let Some(config) = &state.gitlab_config {
            repo.webhook_secret_hmac = Some(compute_gitlab_token_hmac(&config.server_pepper, &secret));
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "GitLab not configured, cannot hash webhook secret"})),
            );
        }
    }

    // Save to database
    if let Err(e) = RepositoryRepo::create(&state.db, &repo).await {
        tracing::error!("Failed to create repository: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create repository"})),
        );
    }

    let response = RepositoryResponse::from(repo);
    (StatusCode::CREATED, Json(json!(response)))
}

/// Update a repository.
///
/// PUT /api/repositories/:id
pub async fn update_repository(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateRepositoryRequest>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Get existing repository
    let mut repo = match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Repository not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get repository: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    // Apply updates
    if let Some(name) = req.name {
        repo.name = name;
    }
    if let Some(branch) = req.default_branch {
        repo.default_branch = branch;
    }
    if let Some(active) = req.is_active {
        repo.is_active = active;
    }
    if let Some(installation_id) = req.github_installation_id {
        repo.github_installation_id = Some(installation_id);
    }
    if let Some(project_id) = req.gitlab_project_id {
        repo.gitlab_project_id = Some(project_id);
    }

    // Update webhook secret if provided
    if let Some(secret) = req.webhook_secret
        && repo.provider == GitProvider::GitLab
        && let Some(config) = &state.gitlab_config
    {
        repo.webhook_secret_hmac = Some(compute_gitlab_token_hmac(&config.server_pepper, &secret));
    }

    // Save to database
    if let Err(e) = RepositoryRepo::update(&state.db, &repo).await {
        tracing::error!("Failed to update repository: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update repository"})),
        );
    }

    let response = RepositoryResponse::from(repo);
    (StatusCode::OK, Json(json!(response)))
}

/// Delete a repository.
///
/// DELETE /api/repositories/:id
pub async fn delete_repository(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Delete directly and check rows_affected to avoid TOCTOU race condition
    // This is safer than checking existence first, then deleting
    match RepositoryRepo::delete(&state.db, &repo_id).await {
        Ok(0) => {
            // No rows deleted means repository didn't exist
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Repository not found"})),
            );
        }
        Ok(_) => {
            // Successfully deleted
            (StatusCode::NO_CONTENT, Json(json!({})))
        }
        Err(e) => {
            tracing::error!("Failed to delete repository: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to delete repository"})),
            )
        }
    }
}

/// Get the webhook URL for a repository.
///
/// GET /api/repositories/:id/webhook-url
pub async fn get_webhook_url(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    let repo = match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Repository not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get repository: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let webhook_url = match repo.provider {
        GitProvider::GitHub => github_webhook_url(&state.config.base_url),
        GitProvider::GitLab => gitlab_webhook_url(&state.config.base_url, &repo.id.to_string()),
    };

    (
        StatusCode::OK,
        Json(json!({
            "webhook_url": webhook_url,
            "provider": repo.provider.as_str()
        })),
    )
}
