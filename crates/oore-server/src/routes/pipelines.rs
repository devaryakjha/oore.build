//! Pipeline configuration endpoints.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use oore_core::{
    db::{pipeline::PipelineConfigRepo, repository::RepositoryRepo},
    models::{CreatePipelineConfigRequest, PipelineConfig, PipelineConfigResponse, RepositoryId},
    pipeline::parse_pipeline,
};
use serde_json::json;

use crate::state::AppState;

/// Get pipeline config for a repository.
///
/// GET /api/repositories/:id/pipeline
pub async fn get_pipeline_config(
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

    // Verify repository exists
    match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
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
        Ok(Some(_)) => {}
    }

    match PipelineConfigRepo::get_active_for_repository(&state.db, &repo_id).await {
        Ok(Some(config)) => {
            let response = PipelineConfigResponse::from(config);
            (StatusCode::OK, Json(json!(response)))
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "No pipeline configuration found"})),
        ),
        Err(e) => {
            tracing::error!("Failed to get pipeline config: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Create or update pipeline config for a repository.
///
/// PUT /api/repositories/:id/pipeline
pub async fn set_pipeline_config(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CreatePipelineConfigRequest>,
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

    // Verify repository exists
    match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
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
        Ok(Some(_)) => {}
    }

    // Validate YAML
    if let Err(e) = parse_pipeline(&req.config_yaml) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Invalid pipeline configuration",
                "details": e.to_string()
            })),
        );
    }

    let config = PipelineConfig::new(
        repo_id,
        req.name.unwrap_or_else(|| "default".to_string()),
        req.config_yaml,
    );

    if let Err(e) = PipelineConfigRepo::upsert(&state.db, &config).await {
        tracing::error!("Failed to save pipeline config: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to save configuration"})),
        );
    }

    let response = PipelineConfigResponse::from(config);
    (StatusCode::OK, Json(json!(response)))
}

/// Delete pipeline config for a repository.
///
/// DELETE /api/repositories/:id/pipeline
pub async fn delete_pipeline_config(
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

    // Verify repository exists
    match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
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
        Ok(Some(_)) => {}
    }

    if let Err(e) = PipelineConfigRepo::delete_for_repository(&state.db, &repo_id).await {
        tracing::error!("Failed to delete pipeline config: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to delete configuration"})),
        );
    }

    (StatusCode::OK, Json(json!({"status": "deleted"})))
}

/// Validate pipeline YAML without saving.
///
/// POST /api/pipelines/validate
pub async fn validate_pipeline(Json(req): Json<CreatePipelineConfigRequest>) -> impl IntoResponse {
    match parse_pipeline(&req.config_yaml) {
        Ok(pipeline) => {
            let workflow_names: Vec<&String> = pipeline.workflows.keys().collect();
            (
                StatusCode::OK,
                Json(json!({
                    "valid": true,
                    "workflows": workflow_names
                })),
            )
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "valid": false,
                "error": e.to_string()
            })),
        ),
    }
}
