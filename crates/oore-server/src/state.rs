//! Application state for the Oore server.

use oore_core::db::DbPool;
use oore_core::oauth::EncryptionKey;
use oore_core::providers::{GitHubAppConfig, GitLabConfig};
use std::sync::Arc;
use tokio::sync::mpsc;
use url::Url;

use crate::middleware::AdminAuthConfig;
use crate::worker::WebhookJob;

/// Server configuration loaded from environment.
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Base URL for the server (for generating webhook URLs).
    pub base_url: String,
    /// Parsed base URL.
    pub base_url_parsed: Url,
    /// Allowed CORS origin for the dashboard.
    pub dashboard_origin: Option<String>,
    /// Database URL.
    pub database_url: String,
    /// Whether dev mode is enabled.
    #[allow(dead_code)]
    pub dev_mode: bool,
}

impl ServerConfig {
    /// Loads configuration from environment variables.
    pub fn from_env() -> Result<Self, String> {
        let base_url = std::env::var("OORE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:8080".to_string());

        let base_url_parsed = Url::parse(&base_url)
            .map_err(|e| format!("Invalid OORE_BASE_URL: {}", e))?;

        let dev_mode = std::env::var("OORE_DEV_MODE").ok() == Some("true".to_string());

        // Validate HTTPS in production
        if !dev_mode && base_url_parsed.scheme() != "https" {
            let host = base_url_parsed.host_str().unwrap_or("");
            let is_loopback = host == "localhost" || host == "127.0.0.1" || host == "::1";
            if !is_loopback {
                return Err("OORE_BASE_URL must use HTTPS in production. Set OORE_DEV_MODE=true for development.".to_string());
            }
        }

        Ok(Self {
            base_url,
            base_url_parsed,
            dashboard_origin: std::env::var("OORE_DASHBOARD_ORIGIN").ok(),
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:oore.db".to_string()),
            dev_mode,
        })
    }
}

/// Shared application state.
#[derive(Clone)]
pub struct AppState {
    /// Database connection pool.
    pub db: DbPool,
    /// Server configuration.
    pub config: Arc<ServerConfig>,
    /// GitHub App configuration (if configured via env vars).
    pub github_config: Option<Arc<GitHubAppConfig>>,
    /// GitLab configuration (if configured via env vars).
    pub gitlab_config: Option<Arc<GitLabConfig>>,
    /// Channel for sending webhook jobs to the worker.
    pub webhook_tx: mpsc::Sender<WebhookJob>,
    /// Encryption key for storing credentials.
    pub encryption_key: Option<EncryptionKey>,
    /// Admin authentication configuration.
    pub admin_auth_config: Arc<AdminAuthConfig>,
}

impl AppState {
    /// Creates a new application state.
    pub fn new(
        db: DbPool,
        config: ServerConfig,
        github_config: Option<GitHubAppConfig>,
        gitlab_config: Option<GitLabConfig>,
        webhook_tx: mpsc::Sender<WebhookJob>,
        encryption_key: Option<EncryptionKey>,
        admin_auth_config: AdminAuthConfig,
    ) -> Self {
        Self {
            db,
            config: Arc::new(config),
            github_config: github_config.map(Arc::new),
            gitlab_config: gitlab_config.map(Arc::new),
            webhook_tx,
            encryption_key,
            admin_auth_config: Arc::new(admin_auth_config),
        }
    }

    /// Gets the encryption key, returning an error if not configured.
    pub fn require_encryption_key(&self) -> Result<&EncryptionKey, &'static str> {
        self.encryption_key
            .as_ref()
            .ok_or("ENCRYPTION_KEY not configured")
    }
}
