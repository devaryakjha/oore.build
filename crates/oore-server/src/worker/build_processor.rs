//! Build execution processor worker.
//!
//! Processes pending builds by cloning repos, resolving configs, and executing steps.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use dashmap::DashMap;
use oore_core::{
    auth::get_repository_auth_token,
    db::{
        pipeline::{BuildLogRepo, BuildStepRepo},
        repository::{BuildRepo, RepositoryRepo},
        DbPool,
    },
    models::{Build, BuildId, BuildLog, BuildStatus, BuildStep, LogStream, StepStatus},
    oauth::EncryptionKey,
    pipeline::{resolve_config, select_workflow, BuildExecutor, ShellExecutor},
    OoreError,
};
use tokio::sync::{mpsc, watch, Semaphore};

/// A build processing job.
#[derive(Debug, Clone)]
pub struct BuildJob {
    /// The ID of the build to process.
    pub build_id: BuildId,
}

/// Handle for managing the build processor worker.
pub struct BuildWorkerHandle {
    /// Handle to the worker task.
    pub task_handle: tokio::task::JoinHandle<()>,
    /// Sender for the shutdown signal.
    shutdown_tx: watch::Sender<bool>,
}

impl BuildWorkerHandle {
    /// Signals the worker to shut down gracefully and waits for it to finish.
    pub async fn shutdown(self) -> Result<(), tokio::task::JoinError> {
        let _ = self.shutdown_tx.send(true);
        self.task_handle.await
    }
}

/// Build processor configuration.
pub struct BuildProcessorConfig {
    /// Base directory for build workspaces.
    pub workspaces_dir: PathBuf,
    /// Base directory for build logs.
    pub logs_dir: PathBuf,
    /// Maximum concurrent builds.
    pub max_concurrent_builds: usize,
}

impl Default for BuildProcessorConfig {
    fn default() -> Self {
        Self {
            workspaces_dir: PathBuf::from("/var/lib/oore/workspaces"),
            logs_dir: PathBuf::from("/var/lib/oore/logs"),
            max_concurrent_builds: 2,
        }
    }
}

impl BuildProcessorConfig {
    /// Loads config from environment variables with defaults.
    pub fn from_env() -> Self {
        let mut config = Self::default();

        if let Ok(val) = std::env::var("OORE_WORKSPACES_DIR") {
            config.workspaces_dir = PathBuf::from(val);
        }

        if let Ok(val) = std::env::var("OORE_LOGS_DIR") {
            config.logs_dir = PathBuf::from(val);
        }

        if let Ok(val) = std::env::var("OORE_MAX_CONCURRENT_BUILDS") {
            if let Ok(v) = val.parse() {
                config.max_concurrent_builds = v;
            }
        }

        config
    }
}

/// Shared state for cancellation tracking.
pub type CancelChannels = Arc<DashMap<BuildId, watch::Sender<bool>>>;

/// Starts the build processor worker.
///
/// Returns a sender for submitting jobs, a handle for managing the worker,
/// and the cancel channels for build cancellation.
pub fn start_build_processor(
    db: DbPool,
    config: BuildProcessorConfig,
    encryption_key: Option<EncryptionKey>,
) -> (mpsc::Sender<BuildJob>, BuildWorkerHandle, CancelChannels) {
    let (tx, rx) = mpsc::channel::<BuildJob>(100);
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let cancel_channels: CancelChannels = Arc::new(DashMap::new());
    let cancel_channels_clone = cancel_channels.clone();

    let executor: Arc<dyn BuildExecutor> = Arc::new(ShellExecutor::new());

    let handle = tokio::spawn(async move {
        run_build_processor(db, config, encryption_key, executor, rx, shutdown_rx, cancel_channels_clone).await;
    });

    let worker_handle = BuildWorkerHandle {
        task_handle: handle,
        shutdown_tx,
    };

    (tx, worker_handle, cancel_channels)
}

/// Recovers pending builds on startup.
///
/// - Re-enqueues builds with status = 'pending'
/// - Marks 'running' builds as 'failure' (interrupted by restart)
pub async fn recover_pending_builds(db: &DbPool, tx: &mpsc::Sender<BuildJob>) {
    // Mark running builds as failed
    match BuildRepo::fail_running_builds(db, "Build interrupted by server restart").await {
        Ok(count) => {
            if count > 0 {
                tracing::warn!("Marked {} running builds as failed due to restart", count);
            }
        }
        Err(e) => {
            tracing::error!("Failed to mark running builds as failed: {}", e);
        }
    }

    // Re-enqueue pending builds
    match BuildRepo::get_pending(db).await {
        Ok(builds) => {
            let count = builds.len();
            if count > 0 {
                tracing::info!("Recovering {} pending builds...", count);
            }

            for build in builds {
                let job = BuildJob {
                    build_id: build.id.clone(),
                };
                if let Err(e) = tx.try_send(job) {
                    tracing::error!(
                        "Failed to re-enqueue build {}: {}",
                        build.id,
                        e
                    );
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to recover pending builds: {}", e);
        }
    }
}

/// Main processor loop.
async fn run_build_processor(
    db: DbPool,
    config: BuildProcessorConfig,
    encryption_key: Option<EncryptionKey>,
    executor: Arc<dyn BuildExecutor>,
    mut rx: mpsc::Receiver<BuildJob>,
    mut shutdown_rx: watch::Receiver<bool>,
    cancel_channels: CancelChannels,
) {
    tracing::info!("Build processor started");

    // Ensure directories exist
    if let Err(e) = tokio::fs::create_dir_all(&config.workspaces_dir).await {
        tracing::error!("Failed to create workspaces directory: {}", e);
    }
    if let Err(e) = tokio::fs::create_dir_all(&config.logs_dir).await {
        tracing::error!("Failed to create logs directory: {}", e);
    }

    // Semaphore to limit concurrent builds
    let semaphore = Arc::new(Semaphore::new(config.max_concurrent_builds));

    loop {
        tokio::select! {
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    tracing::info!("Build processor received shutdown signal");
                    break;
                }
            }
            job = rx.recv() => {
                match job {
                    Some(job) => {
                        let db = db.clone();
                        let executor = executor.clone();
                        let config_workspaces = config.workspaces_dir.clone();
                        let config_logs = config.logs_dir.clone();
                        let encryption_key = encryption_key.clone();
                        let cancel_channels = cancel_channels.clone();
                        let semaphore = semaphore.clone();

                        // Spawn task for this build (respecting concurrency limit)
                        tokio::spawn(async move {
                            // Acquire semaphore permit
                            let _permit = match semaphore.acquire().await {
                                Ok(p) => p,
                                Err(_) => {
                                    tracing::error!("Semaphore closed");
                                    return;
                                }
                            };

                            // Create cancellation channel for this build
                            let (cancel_tx, cancel_rx) = watch::channel(false);
                            cancel_channels.insert(job.build_id.clone(), cancel_tx);

                            // Process the build
                            let result = process_build(
                                &db,
                                &executor,
                                &config_workspaces,
                                &config_logs,
                                encryption_key.as_ref(),
                                &job,
                                cancel_rx,
                            )
                            .await;

                            // Remove cancellation channel
                            cancel_channels.remove(&job.build_id);

                            if let Err(e) = result {
                                tracing::error!("Build {} failed: {}", job.build_id, e);
                            }
                        });
                    }
                    None => {
                        tracing::info!("Build processor channel closed");
                        break;
                    }
                }
            }
        }
    }

    tracing::info!("Build processor stopped");
}

/// Processes a single build.
async fn process_build(
    db: &DbPool,
    executor: &Arc<dyn BuildExecutor>,
    workspaces_dir: &PathBuf,
    logs_dir: &PathBuf,
    encryption_key: Option<&EncryptionKey>,
    job: &BuildJob,
    mut cancel_rx: watch::Receiver<bool>,
) -> oore_core::Result<()> {
    // Load the build
    let build = BuildRepo::get_by_id(db, &job.build_id)
        .await?
        .ok_or_else(|| OoreError::BuildNotFound(job.build_id.to_string()))?;

    // Verify build is still pending
    if build.status != BuildStatus::Pending {
        tracing::debug!(
            "Build {} is no longer pending (status: {}), skipping",
            build.id,
            build.status
        );
        return Ok(());
    }

    tracing::info!(
        "Processing build {} for commit {} on branch {}",
        build.id,
        &build.commit_sha[..7.min(build.commit_sha.len())],
        build.branch
    );

    // Update status to running
    BuildRepo::update_status(db, &build.id, BuildStatus::Running).await?;

    // Set up paths
    let workspace = workspaces_dir.join(build.id.to_string());
    let build_logs_dir = logs_dir.join(build.id.to_string());

    // Create log directory
    tokio::fs::create_dir_all(&build_logs_dir).await?;

    // Load repository
    let repository = RepositoryRepo::get_by_id(db, &build.repository_id)
        .await?
        .ok_or_else(|| OoreError::RepositoryNotFound(build.repository_id.to_string()))?;

    // Get auth token if available (for private repos)
    let auth_token: Option<String> = if let Some(key) = encryption_key {
        match get_repository_auth_token(db, key, &repository).await {
            Ok(token) => token,
            Err(OoreError::Configuration(msg)) => {
                // Configuration errors indicate setup issues - fail the build with clear message
                tracing::error!(
                    "Configuration error for repository {}: {}",
                    repository.id,
                    msg
                );
                BuildRepo::set_error(db, &build.id, &format!("Configuration error: {}", msg)).await?;
                BuildRepo::update_status(db, &build.id, BuildStatus::Failure).await?;
                return Err(OoreError::Configuration(msg));
            }
            Err(e) => {
                // For other errors (API failures, etc.), try clone without auth
                tracing::warn!(
                    "Failed to get auth token for repository {}: {}. Attempting clone without auth.",
                    repository.id,
                    e
                );
                None
            }
        }
    } else {
        tracing::debug!("No encryption key configured, skipping private repo auth");
        None
    };

    // Clone the repository
    let clone_result = executor
        .clone_repo(
            &repository.clone_url,
            &build.commit_sha,
            &workspace,
            auth_token.as_deref(),
        )
        .await;

    if let Err(e) = clone_result {
        // Clone failed - mark build as failed
        BuildRepo::set_error(db, &build.id, &e.to_string()).await?;
        BuildRepo::update_status(db, &build.id, BuildStatus::Failure).await?;
        return Err(e);
    }

    // Check for cancellation
    if *cancel_rx.borrow() {
        cleanup_and_fail(db, executor, &workspace, &build, "Build cancelled").await?;
        return Err(OoreError::BuildCancelled);
    }

    // Resolve pipeline configuration
    let resolved = match resolve_config(db, &build.repository_id, Some(&workspace)).await {
        Ok(r) => r,
        Err(e) => {
            cleanup_and_fail(db, executor, &workspace, &build, &e.to_string()).await?;
            return Err(e);
        }
    };

    // Select workflow
    let (workflow_name, workflow) = match select_workflow(
        &resolved.pipeline,
        build.trigger_type,
        &build.branch,
    ) {
        Ok(w) => w,
        Err(e) => {
            cleanup_and_fail(db, executor, &workspace, &build, &e.to_string()).await?;
            return Err(e);
        }
    };

    // Update build with workflow info
    BuildRepo::update_workflow_info(db, &build.id, &workflow_name, resolved.source).await?;

    tracing::info!(
        "Build {} using workflow '{}' from {:?}",
        build.id,
        workflow_name,
        resolved.source
    );

    // Create build steps in database
    for (i, step) in workflow.scripts.iter().enumerate() {
        let build_step = BuildStep::new(
            build.id.clone(),
            i as i32,
            step.name.clone().unwrap_or_else(|| format!("Step {}", i + 1)),
            Some(step.script.clone()),
            Some(step.timeout as i32),
            step.ignore_failure,
        );
        BuildStepRepo::create(db, &build_step).await?;
    }

    // Build environment variables
    let mut env: HashMap<String, String> = workflow.environment.vars.clone();
    env.insert("CI".to_string(), "true".to_string());
    env.insert("OORE".to_string(), "true".to_string());
    env.insert("OORE_BUILD_ID".to_string(), build.id.to_string());
    env.insert("OORE_COMMIT_SHA".to_string(), build.commit_sha.clone());
    env.insert("OORE_BRANCH".to_string(), build.branch.clone());
    env.insert("OORE_REPOSITORY_ID".to_string(), build.repository_id.to_string());

    // Execute steps
    let mut build_success = true;

    for (i, step) in workflow.scripts.iter().enumerate() {
        // Check for cancellation before each step
        if *cancel_rx.borrow() {
            // Cancel remaining steps
            BuildStepRepo::cancel_pending_for_build(db, &build.id).await?;
            cleanup_and_fail(db, executor, &workspace, &build, "Build cancelled").await?;
            return Err(OoreError::BuildCancelled);
        }

        let step_name = step.name.clone().unwrap_or_else(|| format!("Step {}", i + 1));
        tracing::debug!("Build {} executing step {}: {}", build.id, i, step_name);

        // Get step record
        let steps = BuildStepRepo::list_for_build(db, &build.id).await?;
        let step_record = steps
            .iter()
            .find(|s| s.step_index == i as i32)
            .ok_or_else(|| OoreError::BuildStepNotFound(format!("step {}", i)))?;

        // Mark step as running
        BuildStepRepo::update_status(db, &step_record.id, StepStatus::Running, None).await?;

        // Execute the step
        let result = executor
            .execute_step(
                &workspace,
                &step.script,
                &env,
                step.timeout as u64,
                &build_logs_dir,
                i as i32,
                &mut cancel_rx,
            )
            .await;

        match result {
            Ok(step_result) => {
                // Create log records
                let stdout_log = BuildLog::new(
                    build.id.clone(),
                    i as i32,
                    LogStream::Stdout,
                    format!("{}/step-{}-stdout.log", build.id, i),
                );
                BuildLogRepo::create(db, &stdout_log).await?;
                BuildLogRepo::update_line_count(db, &stdout_log.id, step_result.stdout_lines).await?;

                let stderr_log = BuildLog::new(
                    build.id.clone(),
                    i as i32,
                    LogStream::Stderr,
                    format!("{}/step-{}-stderr.log", build.id, i),
                );
                BuildLogRepo::create(db, &stderr_log).await?;
                BuildLogRepo::update_line_count(db, &stderr_log.id, step_result.stderr_lines).await?;

                // Determine step status
                let step_status = if step_result.exit_code == 0 {
                    StepStatus::Success
                } else if step.ignore_failure {
                    tracing::warn!(
                        "Build {} step {} failed with exit code {} (ignored)",
                        build.id,
                        i,
                        step_result.exit_code
                    );
                    StepStatus::Failure
                } else {
                    tracing::error!(
                        "Build {} step {} failed with exit code {}",
                        build.id,
                        i,
                        step_result.exit_code
                    );
                    build_success = false;
                    StepStatus::Failure
                };

                BuildStepRepo::update_status(
                    db,
                    &step_record.id,
                    step_status,
                    Some(step_result.exit_code),
                )
                .await?;

                // Stop on failure (unless ignore_failure)
                if !build_success {
                    // Mark remaining steps as skipped
                    for remaining in &steps[(i + 1)..] {
                        BuildStepRepo::update_status(
                            db,
                            &remaining.id,
                            StepStatus::Skipped,
                            None,
                        )
                        .await?;
                    }
                    break;
                }
            }
            Err(OoreError::BuildCancelled) => {
                BuildStepRepo::update_status(db, &step_record.id, StepStatus::Cancelled, None)
                    .await?;
                BuildStepRepo::cancel_pending_for_build(db, &build.id).await?;
                cleanup_and_fail(db, executor, &workspace, &build, "Build cancelled").await?;
                return Err(OoreError::BuildCancelled);
            }
            Err(OoreError::BuildTimeout(msg)) => {
                BuildStepRepo::update_status(db, &step_record.id, StepStatus::Failure, Some(-1))
                    .await?;
                cleanup_and_fail(db, executor, &workspace, &build, &msg).await?;
                return Err(OoreError::BuildTimeout(msg));
            }
            Err(e) => {
                BuildStepRepo::update_status(db, &step_record.id, StepStatus::Failure, Some(-1))
                    .await?;
                cleanup_and_fail(db, executor, &workspace, &build, &e.to_string()).await?;
                return Err(e);
            }
        }
    }

    // Update final build status
    let final_status = if build_success {
        BuildStatus::Success
    } else {
        BuildStatus::Failure
    };
    BuildRepo::update_status(db, &build.id, final_status).await?;

    tracing::info!(
        "Build {} completed with status: {}",
        build.id,
        final_status
    );

    // Cleanup workspace (keep logs)
    executor.cleanup(&workspace).await?;

    Ok(())
}

/// Cleans up workspace and marks build as failed.
async fn cleanup_and_fail(
    db: &DbPool,
    executor: &Arc<dyn BuildExecutor>,
    workspace: &PathBuf,
    build: &Build,
    error_message: &str,
) -> oore_core::Result<()> {
    BuildRepo::set_error(db, &build.id, error_message).await?;
    BuildRepo::update_status(db, &build.id, BuildStatus::Failure).await?;
    executor.cleanup(workspace).await?;
    Ok(())
}
