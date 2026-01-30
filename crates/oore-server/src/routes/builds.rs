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
        artifact::BuildArtifactRepo,
        pipeline::{BuildLogRepo, BuildStepRepo},
        repository::{BuildRepo, RepositoryRepo},
    },
    models::{
        Build, BuildArtifactResponse, BuildId, BuildLogContentResponse,
        BuildLogResponse, BuildResponse, BuildStatus, BuildStepResponse, RepositoryId,
        TriggerBuildRequest, TriggerType, sanitize_filename,
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

#[derive(Deserialize)]
pub struct GetLogContentQuery {
    pub step: Option<i32>,
    /// Line offset to start reading from (0-indexed, exclusive)
    /// If provided, returns only lines after this offset
    pub offset: Option<i32>,
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
/// GET /api/builds/:id/logs/content?step=0&offset=100 (incremental - returns lines after offset)
pub async fn get_build_log_content(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<GetLogContentQuery>,
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

    let offset = query.offset.unwrap_or(0) as usize;

    // Read log files
    let stdout_content = tokio::fs::read_to_string(&stdout_path)
        .await
        .unwrap_or_default();
    let stderr_content = tokio::fs::read_to_string(&stderr_path)
        .await
        .unwrap_or_default();

    // Apply offset - skip first N lines and return only new content
    let (stdout_content, stdout_total) = if offset > 0 {
        let lines: Vec<&str> = stdout_content.lines().collect();
        let total = lines.len();
        if offset >= total {
            (String::new(), total as i32)
        } else {
            (lines[offset..].join("\n"), total as i32)
        }
    } else {
        let total = stdout_content.lines().count() as i32;
        (stdout_content, total)
    };

    let (stderr_content, stderr_total) = if offset > 0 {
        let lines: Vec<&str> = stderr_content.lines().collect();
        let total = lines.len();
        if offset >= total {
            (String::new(), total as i32)
        } else {
            (lines[offset..].join("\n"), total as i32)
        }
    } else {
        let total = stderr_content.lines().count() as i32;
        (stderr_content, total)
    };

    let response = vec![
        BuildLogContentResponse {
            step_index,
            stream: "stdout".to_string(),
            content: stdout_content,
            line_count: stdout_total, // Total lines in file (for next offset)
        },
        BuildLogContentResponse {
            step_index,
            stream: "stderr".to_string(),
            content: stderr_content,
            line_count: stderr_total,
        },
    ];

    (StatusCode::OK, Json(json!(response)))
}

// ============================================================================
// Build Artifacts
// ============================================================================

/// List artifacts for a build.
///
/// GET /api/builds/:id/artifacts
pub async fn list_build_artifacts(
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

    match BuildArtifactRepo::list_for_build(&state.db, &build_id).await {
        Ok(artifacts) => {
            let responses: Vec<BuildArtifactResponse> = artifacts
                .into_iter()
                .map(BuildArtifactResponse::from_artifact)
                .collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list build artifacts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Download an artifact by ID.
///
/// GET /api/builds/:build_id/artifacts/:artifact_id
pub async fn download_artifact(
    State(state): State<AppState>,
    Path((build_id, artifact_id)): Path<(String, String)>,
) -> axum::response::Response {
    // Get artifact from database
    let artifact = match BuildArtifactRepo::get_by_id(&state.db, &artifact_id).await {
        Ok(Some(a)) => a,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Artifact not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get artifact: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
                .into_response();
        }
    };

    // Verify artifact belongs to the specified build
    if artifact.build_id.to_string() != build_id {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Artifact not found for this build"})),
        )
            .into_response();
    }

    // Get artifacts directory from env or default
    let artifacts_dir = std::env::var("OORE_ARTIFACTS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/var/lib/oore/artifacts"));

    let file_path = artifacts_dir.join(&artifact.storage_path);

    // Verify file exists
    if !file_path.exists() {
        tracing::error!(
            "Artifact file not found at {} for artifact {}",
            file_path.display(),
            artifact_id
        );
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Artifact file not found"})),
        )
            .into_response();
    }

    // Read file
    let content = match tokio::fs::read(&file_path).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to read artifact file: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to read artifact"})),
            )
                .into_response();
        }
    };

    // Build response headers
    let content_type = artifact
        .content_type
        .clone()
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let safe_filename = sanitize_filename(&artifact.name);

    (
        StatusCode::OK,
        [
            ("Content-Type", content_type),
            (
                "Content-Disposition",
                format!("attachment; filename=\"{}\"", safe_filename),
            ),
            ("Content-Length", content.len().to_string()),
        ],
        content,
    )
        .into_response()
}
