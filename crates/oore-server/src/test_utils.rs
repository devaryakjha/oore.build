//! Test utilities for oore-server integration tests.

use axum::{
    Router,
    middleware as axum_mw,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json,
};
use dashmap::DashMap;
use oore_core::db::{create_pool, run_migrations, DbPool};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::mpsc;
use url::Url;

use crate::middleware::{AdminAuthConfig, require_admin};
use crate::state::{AppState, ServerConfig};
use crate::worker::{BuildJob, CancelChannels, WebhookJob};
use crate::routes;

/// Test admin token used in all tests.
pub const TEST_ADMIN_TOKEN: &str = "test-admin-token-12345";

/// Test server configuration for integration tests.
pub struct TestConfig {
    pub db: DbPool,
    pub webhook_rx: mpsc::Receiver<WebhookJob>,
    pub build_rx: mpsc::Receiver<BuildJob>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Serialize)]
struct VersionResponse {
    version: &'static str,
    name: &'static str,
}

async fn health_check() -> impl IntoResponse {
    Json(HealthResponse { status: "ok" })
}

async fn version() -> impl IntoResponse {
    Json(VersionResponse {
        version: oore_core::VERSION,
        name: "oored",
    })
}

/// Creates the public API router for testing.
pub fn api_router(state: AppState) -> Router {
    Router::new()
        // Health and version
        .route("/health", get(health_check))
        .route("/version", get(version))
        // Webhooks (public, but signature-verified)
        .route("/webhooks/github", post(routes::webhooks::handle_github_webhook))
        .route("/webhooks/gitlab/{repo_id}", post(routes::webhooks::handle_gitlab_webhook))
        .route("/webhooks/events", get(routes::webhooks::list_webhook_events))
        .route("/webhooks/events/{id}", get(routes::webhooks::get_webhook_event))
        // Repositories
        .route("/repositories", get(routes::repositories::list_repositories))
        .route("/repositories", post(routes::repositories::create_repository))
        .route("/repositories/{id}", get(routes::repositories::get_repository))
        .route("/repositories/{id}", put(routes::repositories::update_repository))
        .route("/repositories/{id}", delete(routes::repositories::delete_repository))
        .route("/repositories/{id}/webhook-url", get(routes::repositories::get_webhook_url))
        .route("/repositories/{id}/trigger", post(routes::builds::trigger_build))
        // Builds
        .route("/builds", get(routes::builds::list_builds))
        .route("/builds/{id}", get(routes::builds::get_build))
        .route("/builds/{id}/cancel", post(routes::builds::cancel_build))
        .route("/builds/{id}/steps", get(routes::builds::get_build_steps))
        .route("/builds/{id}/logs", get(routes::builds::get_build_logs))
        .route("/builds/{id}/logs/content", get(routes::builds::get_build_log_content))
        // Pipelines
        .route("/pipelines/validate", post(routes::pipelines::validate_pipeline))
        .route("/repositories/{id}/pipeline", get(routes::pipelines::get_pipeline_config))
        .route("/repositories/{id}/pipeline", put(routes::pipelines::set_pipeline_config))
        .route("/repositories/{id}/pipeline", delete(routes::pipelines::delete_pipeline_config))
        // GitHub setup status (public - state token is authorization)
        .route("/github/setup/status", get(routes::github_oauth::get_setup_status))
        // GitLab setup status (public - state token is authorization)
        .route("/gitlab/setup/status", get(routes::gitlab_oauth::get_setup_status))
        .with_state(state)
}

/// Creates the admin-only router with authentication middleware for testing.
pub fn admin_router(state: AppState) -> Router {
    let admin_config = state.admin_auth_config.clone();

    Router::new()
        // Setup status
        .route("/setup/status", get(routes::setup::get_status))
        // GitHub OAuth endpoints
        .route("/github/manifest", get(routes::github_oauth::get_manifest))
        .route("/github/callback", post(routes::github_oauth::handle_callback))
        .route("/github/app", get(routes::github_oauth::get_app))
        .route("/github/app", delete(routes::github_oauth::delete_app))
        .route("/github/installations", get(routes::github_oauth::list_installations))
        .route("/github/installations/{installation_id}/repositories", get(routes::github_oauth::list_installation_repositories))
        .route("/github/sync", post(routes::github_oauth::sync_installations))
        // GitLab OAuth endpoints
        .route("/gitlab/setup", post(routes::gitlab_oauth::setup))
        .route("/gitlab/connect", post(routes::gitlab_oauth::connect))
        .route("/gitlab/callback", post(routes::gitlab_oauth::handle_callback))
        .route("/gitlab/credentials", get(routes::gitlab_oauth::list_credentials))
        .route("/gitlab/credentials/{id}", delete(routes::gitlab_oauth::delete_credentials))
        .route("/gitlab/projects", get(routes::gitlab_oauth::list_projects))
        .route("/gitlab/projects/{id}/enabled", put(routes::gitlab_oauth::enable_project))
        .route("/gitlab/projects/{id}/enabled", delete(routes::gitlab_oauth::disable_project))
        .route("/gitlab/refresh", post(routes::gitlab_oauth::refresh_token))
        .route("/gitlab/apps", post(routes::gitlab_oauth::register_app))
        .layer(axum_mw::from_fn_with_state(admin_config, require_admin))
        .with_state(state)
}

/// Creates an in-memory test database with migrations applied.
pub async fn setup_test_db() -> DbPool {
    let pool = create_pool("sqlite::memory:")
        .await
        .expect("Failed to create test database");
    run_migrations(&pool)
        .await
        .expect("Failed to run migrations");
    pool
}

/// Creates test application state with in-memory database.
pub async fn setup_test_state() -> (AppState, TestConfig) {
    let db = setup_test_db().await;

    let (webhook_tx, webhook_rx) = mpsc::channel(100);
    let (build_tx, build_rx) = mpsc::channel(100);
    let build_cancel_channels: CancelChannels = Arc::new(DashMap::new());

    let config = ServerConfig {
        base_url: "http://localhost:8080".to_string(),
        base_url_parsed: Url::parse("http://localhost:8080").unwrap(),
        dashboard_origin: None,
        database_url: "sqlite::memory:".to_string(),
        dev_mode: true,
    };

    let admin_auth_config = AdminAuthConfig {
        admin_token: Some(Arc::new(TEST_ADMIN_TOKEN.to_string())),
        require_https: false,
        dev_mode: true,
        trusted_proxies: vec![],
    };

    let state = AppState {
        db: db.clone(),
        config: Arc::new(config),
        github_config: None,
        gitlab_config: None,
        webhook_tx,
        build_tx,
        build_cancel_channels,
        encryption_key: None,
        admin_auth_config: Arc::new(admin_auth_config),
        demo_provider: None,
    };

    let test_config = TestConfig {
        db,
        webhook_rx,
        build_rx,
    };

    (state, test_config)
}

/// Creates the full application router for testing.
pub fn create_test_app(state: AppState) -> Router {
    Router::new()
        .nest("/api", api_router(state.clone()))
        .nest("/api", admin_router(state))
}

/// Creates a test application with in-memory database.
/// Returns the router and test configuration.
pub async fn create_test_app_with_state() -> (Router, TestConfig) {
    let (state, config) = setup_test_state().await;
    let app = create_test_app(state);
    (app, config)
}
