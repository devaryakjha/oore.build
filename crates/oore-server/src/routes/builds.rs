//! Build management endpoints.

use std::path::PathBuf;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use oore_core::{
    db::{
        pipeline::{BuildLogRepo, BuildStepRepo},
        repository::{BuildRepo, RepositoryRepo},
    },
    models::{
        Build, BuildId, BuildLogContentResponse, BuildLogResponse, BuildResponse, BuildStatus,
        BuildStepResponse, RepositoryId, TriggerBuildRequest, TriggerType,
    },
};
use serde::Deserialize;
use serde_json::json;

use crate::state::AppState;
use crate::worker::BuildJob;

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

    // Return demo data if demo mode is enabled
    if let Some(ref demo) = state.demo_provider {
        match demo.list_builds(repo_id.as_ref()) {
            Ok(builds) => {
                let responses: Vec<BuildResponse> =
                    builds.into_iter().map(BuildResponse::from).collect();
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

    // Return demo data if demo mode is enabled
    if let Some(ref demo) = state.demo_provider {
        match demo.get_build(&build_id) {
            Ok(Some(build)) => {
                let response = BuildResponse::from(build);
                return (StatusCode::OK, Json(json!(response)));
            }
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "Build not found"})),
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

    // Send cancel signal if build is running
    if build.status == BuildStatus::Running {
        if let Some(cancel_tx) = state.build_cancel_channels.get(&build_id) {
            let _ = cancel_tx.send(true);
            tracing::info!("Sent cancel signal to build {}", build_id);
        }
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

    // Queue the build for execution
    let build_job = BuildJob {
        build_id: build.id.clone(),
    };
    if let Err(e) = state.build_tx.try_send(build_job) {
        tracing::error!("Failed to queue build {}: {}", build.id, e);
        // Build was created but not queued - don't fail the request
    }

    let response = BuildResponse::from(build);
    (StatusCode::CREATED, Json(json!(response)))
}

/// Get build steps.
///
/// GET /api/builds/:id/steps
pub async fn get_build_steps(
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

    // Return demo data if demo mode is enabled
    if let Some(ref demo) = state.demo_provider {
        match demo.list_build_steps(&build_id) {
            Ok(steps) => {
                let responses: Vec<BuildStepResponse> =
                    steps.into_iter().map(BuildStepResponse::from).collect();
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

    // Verify build exists
    match BuildRepo::get_by_id(&state.db, &build_id).await {
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
        Ok(Some(_)) => {}
    }

    match BuildStepRepo::list_for_build(&state.db, &build_id).await {
        Ok(steps) => {
            let responses: Vec<BuildStepResponse> =
                steps.into_iter().map(BuildStepResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list build steps: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

#[derive(Deserialize)]
pub struct GetLogsQuery {
    pub step: Option<i32>,
}

/// Get build logs.
///
/// GET /api/builds/:id/logs
/// GET /api/builds/:id/logs?step=0
pub async fn get_build_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<GetLogsQuery>,
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

    // Verify build exists
    match BuildRepo::get_by_id(&state.db, &build_id).await {
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
        Ok(Some(_)) => {}
    }

    // Get logs (filtered by step if specified)
    let logs = match query.step {
        Some(step_index) => BuildLogRepo::list_for_step(&state.db, &build_id, step_index).await,
        None => BuildLogRepo::list_for_build(&state.db, &build_id).await,
    };

    match logs {
        Ok(logs) => {
            let responses: Vec<BuildLogResponse> =
                logs.into_iter().map(BuildLogResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list build logs: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Get build log content.
///
/// GET /api/builds/:id/logs/content?step=0
pub async fn get_build_log_content(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<GetLogsQuery>,
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

    let step_index = query.step.unwrap_or(0);

    // Return demo data if demo mode is enabled
    if let Some(ref demo) = state.demo_provider {
        match demo.get_build_log_content(&build_id, step_index) {
            Ok(Some((stdout_content, stderr_content))) => {
                let stdout_lines = stdout_content.lines().count() as i32;
                let stderr_lines = stderr_content.lines().count() as i32;

                let response = vec![
                    BuildLogContentResponse {
                        step_index,
                        stream: "stdout".to_string(),
                        content: stdout_content,
                        line_count: stdout_lines,
                    },
                    BuildLogContentResponse {
                        step_index,
                        stream: "stderr".to_string(),
                        content: stderr_content,
                        line_count: stderr_lines,
                    },
                ];
                return (StatusCode::OK, Json(json!(response)));
            }
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "Build or step not found"})),
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

    // Get logs directory from env or default
    let logs_dir = std::env::var("OORE_LOGS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/var/lib/oore/logs"));

    let stdout_path = logs_dir
        .join(build_id.to_string())
        .join(format!("step-{}-stdout.log", step_index));
    let stderr_path = logs_dir
        .join(build_id.to_string())
        .join(format!("step-{}-stderr.log", step_index));

    // Read log files
    let stdout_content = tokio::fs::read_to_string(&stdout_path)
        .await
        .unwrap_or_default();
    let stderr_content = tokio::fs::read_to_string(&stderr_path)
        .await
        .unwrap_or_default();

    let stdout_lines = stdout_content.lines().count() as i32;
    let stderr_lines = stderr_content.lines().count() as i32;

    let response = vec![
        BuildLogContentResponse {
            step_index,
            stream: "stdout".to_string(),
            content: stdout_content,
            line_count: stdout_lines,
        },
        BuildLogContentResponse {
            step_index,
            stream: "stderr".to_string(),
            content: stderr_content,
            line_count: stderr_lines,
        },
    ];

    (StatusCode::OK, Json(json!(response)))
}
