use anyhow::Result;
use axum::{
    Router,
    routing::{delete, get, post, put},
    http::{HeaderValue, Method},
    response::IntoResponse,
    Json,
    middleware as axum_mw,
};
use clap::Parser;
use serde::Serialize;
use tokio::signal;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod cli;
mod middleware;
mod routes;
mod service;
mod state;
mod worker;

use cli::{Cli, Commands};
use middleware::{AdminAuthConfig, require_admin};
use oore_core::{
    crypto::MAX_WEBHOOK_SIZE,
    db::{create_pool, run_migrations, credentials::cleanup_expired},
    oauth::EncryptionKey,
    providers::{GitHubAppConfig, GitLabConfig},
};
use state::{AppState, ServerConfig};
use worker::{recover_unprocessed_events, start_webhook_processor};

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

fn api_router(state: AppState) -> Router {
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
        .with_state(state)
}

fn admin_router(state: AppState) -> Router {
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
        .route("/github/sync", post(routes::github_oauth::sync_installations))
        // GitLab OAuth endpoints
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

fn setup_pages_router(state: AppState) -> Router {
    Router::new()
        .route("/github/create", get(routes::oauth_callback::github_create_page_handler))
        .route("/github/callback", get(routes::oauth_callback::github_callback_handler))
        .route("/gitlab/callback", get(routes::oauth_callback::gitlab_callback_handler))
        .with_state(state)
}

/// Starts the periodic cleanup task for expired OAuth state and webhook deliveries.
fn start_cleanup_task(db: oore_core::db::DbPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300)); // 5 minutes

        loop {
            interval.tick().await;

            match cleanup_expired(&db).await {
                Ok((oauth_count, webhook_count)) => {
                    if oauth_count > 0 || webhook_count > 0 {
                        tracing::debug!(
                            "Cleanup: removed {} expired OAuth states, {} expired webhook deliveries",
                            oauth_count,
                            webhook_count
                        );
                    }
                }
                Err(e) => {
                    tracing::warn!("Cleanup task failed: {}", e);
                }
            }
        }
    });
}

/// Load environment from file specified by OORE_ENV_FILE or fallback to .env
fn load_env() {
    // First check for OORE_ENV_FILE (set by service manager)
    if let Ok(env_file) = std::env::var("OORE_ENV_FILE") {
        if let Err(e) = dotenvy::from_path(&env_file) {
            eprintln!("Warning: Failed to load env file {}: {}", env_file, e);
        } else {
            return;
        }
    }

    // Fallback to .env in current directory
    let _ = dotenvy::dotenv();
}

/// Run the server (foreground mode)
async fn run_server() -> Result<()> {
    // Load environment variables
    load_env();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "oore_server=debug,oore_core=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = match ServerConfig::from_env() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Configuration error: {}", e);
            std::process::exit(1);
        }
    };
    tracing::info!("Starting Oore server with base URL: {}", config.base_url);

    // Load admin auth configuration
    let admin_auth_config = AdminAuthConfig::from_env();
    if !admin_auth_config.is_configured() {
        tracing::warn!("OORE_ADMIN_TOKEN not set - admin endpoints will be disabled");
    }

    // Load encryption key
    let encryption_key = match EncryptionKey::from_env() {
        Ok(key) => {
            tracing::info!("Encryption key configured");
            Some(key)
        }
        Err(e) => {
            tracing::warn!("ENCRYPTION_KEY not configured: {} - credential storage will be disabled", e);
            None
        }
    };

    // Load provider configurations (legacy env var support)
    let github_config = match GitHubAppConfig::from_env() {
        Ok(Some(config)) => {
            tracing::info!("GitHub App integration configured via env vars (App ID: {})", config.app_id);
            Some(config)
        }
        Ok(None) => {
            tracing::info!("GitHub integration not configured via env vars");
            None
        }
        Err(e) => {
            tracing::error!("Failed to load GitHub config: {}", e);
            None
        }
    };

    let gitlab_config = match GitLabConfig::from_env() {
        Ok(Some(config)) => {
            tracing::info!("GitLab integration configured via env vars");
            Some(config)
        }
        Ok(None) => {
            tracing::info!("GitLab integration not configured via env vars");
            None
        }
        Err(e) => {
            tracing::error!("Failed to load GitLab config: {}", e);
            None
        }
    };

    // Initialize database
    let db = match create_pool(&config.database_url).await {
        Ok(pool) => pool,
        Err(e) => {
            tracing::error!("Failed to create database pool: {}", e);
            std::process::exit(1);
        }
    };

    if let Err(e) = run_migrations(&db).await {
        tracing::error!("Failed to run migrations: {}", e);
        std::process::exit(1);
    }

    // Validate encryption key if credentials exist
    if encryption_key.is_some() {
        // Try to decrypt any existing credentials to validate the key
        match oore_core::db::credentials::GitHubAppCredentialsRepo::get_active(&db).await {
            Ok(Some(creds)) => {
                if let Some(ref key) = encryption_key {
                    match oore_core::oauth::github::GitHubClient::new(key.clone()) {
                        Ok(client) => {
                            if let Err(e) = client.decrypt_webhook_secret(&creds) {
                                tracing::error!("Failed to decrypt existing credentials - ENCRYPTION_KEY may have changed: {}", e);
                                std::process::exit(1);
                            }
                            tracing::debug!("Encryption key validated against stored credentials");
                        }
                        Err(e) => {
                            tracing::error!("Failed to create GitHub client: {}", e);
                            std::process::exit(1);
                        }
                    }
                }
            }
            Ok(None) => {}
            Err(e) => {
                tracing::warn!("Failed to check existing credentials: {}", e);
            }
        }
    }

    // Start webhook processor
    let (webhook_tx, _worker_handle) = start_webhook_processor(db.clone());

    // Recover any unprocessed events from previous runs
    recover_unprocessed_events(&db, &webhook_tx).await;

    // Start cleanup task
    start_cleanup_task(db.clone());

    // Create application state
    let state = AppState::new(
        db,
        config.clone(),
        github_config,
        gitlab_config,
        webhook_tx,
        encryption_key,
        admin_auth_config,
    );

    // Configure CORS
    let cors = match &config.dashboard_origin {
        Some(origin) => {
            let origin: HeaderValue = origin.parse().expect("Invalid dashboard origin");
            CorsLayer::new()
                .allow_origin(origin)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers(tower_http::cors::Any)
        }
        None => {
            // Development mode - allow all origins
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers(tower_http::cors::Any)
        }
    };

    let app = Router::new()
        .nest("/api", api_router(state.clone()))
        .nest("/api", admin_router(state.clone()))
        .nest("/setup", setup_pages_router(state))
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(MAX_WEBHOOK_SIZE));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("Oore server listening on http://0.0.0.0:8080");

    // Serve with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shutdown complete");
    Ok(())
}

/// Wait for shutdown signal (SIGTERM or SIGINT)
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, initiating graceful shutdown...");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM, initiating graceful shutdown...");
        },
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command.unwrap_or_default() {
        Commands::Run => {
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?
                .block_on(run_server())
        }
        Commands::Install { env_file, force } => {
            service::install(env_file, force)
        }
        Commands::Uninstall { purge } => {
            service::uninstall(purge)
        }
        Commands::Start => {
            service::start()
        }
        Commands::Stop => {
            service::stop()
        }
        Commands::Restart => {
            service::restart()
        }
        Commands::Status => {
            service::status()
        }
        Commands::Logs { lines, follow } => {
            service::logs(lines, follow)
        }
    }
}
