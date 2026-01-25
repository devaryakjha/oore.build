//! Build management endpoints.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use oore_core::{
    db::repository::{BuildRepo, RepositoryRepo},
    models::{Build, BuildId, BuildResponse, BuildStatus, RepositoryId, TriggerBuildRequest, TriggerType},
};
use serde::Deserialize;
use serde_json::json;

use crate::state::AppState;

#[derive(Deserialize)]
pub struct ListBuildsQuery {
    pub repo: Option<String>,
}

/// List builds, optionally filtered by repository.
///
/// GET /api/builds
/// GET /api/builds?repo=<repo_id>
pub async fn list_builds(
    State(state): State<AppState>,
    Query(query): Query<ListBuildsQuery>,
) -> impl IntoResponse {
    let repo_id = match query.repo {
        Some(id) => match RepositoryId::from_string(&id) {
            Ok(id) => Some(id),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "Invalid repository ID"})),
                );
            }
        },
        None => None,
    };

    match BuildRepo::list(&state.db, repo_id.as_ref()).await {
        Ok(builds) => {
            let responses: Vec<BuildResponse> =
                builds.into_iter().map(BuildResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list builds: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Get a build by ID.
///
/// GET /api/builds/:id
pub async fn get_build(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let build_id = match BuildId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid build ID"})),
            );
        }
    };

    match BuildRepo::get_by_id(&state.db, &build_id).await {
        Ok(Some(build)) => {
            let response = BuildResponse::from(build);
            (StatusCode::OK, Json(json!(response)))
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Build not found"})),
        ),
        Err(e) => {
            tracing::error!("Failed to get build: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Cancel a build.
///
/// POST /api/builds/:id/cancel
pub async fn cancel_build(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let build_id = match BuildId::from_string(&id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid build ID"})),
            );
        }
    };

    // Get build to check status
    let build = match BuildRepo::get_by_id(&state.db, &build_id).await {
        Ok(Some(build)) => build,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Build not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get build: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    // Can only cancel pending or running builds
    if build.status != BuildStatus::Pending && build.status != BuildStatus::Running {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Can only cancel pending or running builds"})),
        );
    }

    if let Err(e) = BuildRepo::update_status(&state.db, &build_id, BuildStatus::Cancelled).await {
        tracing::error!("Failed to cancel build: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to cancel build"})),
        );
    }

    (StatusCode::OK, Json(json!({"status": "cancelled"})))
}

/// Trigger a manual build for a repository.
///
/// POST /api/repositories/:id/trigger
pub async fn trigger_build(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<TriggerBuildRequest>,
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

    // Get repository
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

    let branch = req.branch.unwrap_or(repo.default_branch);
    let commit_sha = req.commit_sha.unwrap_or_else(|| "HEAD".to_string());

    // Create build record
    let build = Build::new(
        repo_id,
        None, // No webhook event for manual triggers
        commit_sha,
        branch,
        TriggerType::Manual,
    );

    if let Err(e) = BuildRepo::create(&state.db, &build).await {
        tracing::error!("Failed to create build: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create build"})),
        );
    }

    let response = BuildResponse::from(build);
    (StatusCode::CREATED, Json(json!(response)))
}
