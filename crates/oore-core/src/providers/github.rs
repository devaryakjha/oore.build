//! GitHub provider integration.
//!
//! Handles GitHub App authentication and API interactions.

use crate::error::{OoreError, Result};

/// GitHub App configuration loaded from environment.
#[derive(Debug, Clone)]
pub struct GitHubAppConfig {
    /// GitHub App ID.
    pub app_id: String,
    /// Path to the private key PEM file.
    pub private_key_path: String,
    /// Webhook secret for signature verification.
    pub webhook_secret: String,
}

impl GitHubAppConfig {
    /// Loads configuration from environment variables.
    pub fn from_env() -> Result<Option<Self>> {
        let app_id = std::env::var("GITHUB_APP_ID").ok();
        let private_key_path = std::env::var("GITHUB_PRIVATE_KEY_PATH").ok();
        let webhook_secret = std::env::var("GITHUB_WEBHOOK_SECRET").ok();

        match (app_id, private_key_path, webhook_secret) {
            (Some(app_id), Some(private_key_path), Some(webhook_secret)) => Ok(Some(Self {
                app_id,
                private_key_path,
                webhook_secret,
            })),
            (None, None, None) => Ok(None),
            _ => Err(OoreError::Configuration(
                "Partial GitHub configuration. Set all of: GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH, GITHUB_WEBHOOK_SECRET".to_string(),
            )),
        }
    }

    /// Checks if GitHub integration is configured.
    pub fn is_configured() -> bool {
        std::env::var("GITHUB_APP_ID").is_ok()
            && std::env::var("GITHUB_PRIVATE_KEY_PATH").is_ok()
            && std::env::var("GITHUB_WEBHOOK_SECRET").is_ok()
    }
}

/// Generates a clone URL for a GitHub repository.
pub fn github_clone_url(owner: &str, repo: &str) -> String {
    format!("https://github.com/{}/{}.git", owner, repo)
}

/// Generates the webhook URL for GitHub.
pub fn github_webhook_url(base_url: &str) -> String {
    format!("{}/api/webhooks/github", base_url.trim_end_matches('/'))
}
