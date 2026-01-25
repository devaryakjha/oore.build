//! GitLab provider integration.
//!
//! Handles GitLab authentication and API interactions.

use crate::error::Result;

/// GitLab server configuration loaded from environment.
#[derive(Debug, Clone)]
pub struct GitLabConfig {
    /// Server pepper for HMAC computation of webhook tokens.
    pub server_pepper: String,
    /// Base URL for GitLab API (defaults to gitlab.com).
    pub api_base_url: String,
}

impl GitLabConfig {
    /// Loads configuration from environment variables.
    pub fn from_env() -> Result<Option<Self>> {
        let server_pepper = std::env::var("GITLAB_SERVER_PEPPER").ok();
        let api_base_url =
            std::env::var("GITLAB_API_BASE_URL").unwrap_or_else(|_| "https://gitlab.com".to_string());

        match server_pepper {
            Some(server_pepper) => Ok(Some(Self {
                server_pepper,
                api_base_url,
            })),
            None => Ok(None),
        }
    }

    /// Checks if GitLab integration is configured.
    pub fn is_configured() -> bool {
        std::env::var("GITLAB_SERVER_PEPPER").is_ok()
    }
}

/// Generates a clone URL for a GitLab repository.
pub fn gitlab_clone_url(base_url: &str, owner: &str, repo: &str) -> String {
    let base = base_url.trim_end_matches('/');
    format!("{}/{}/{}.git", base, owner, repo)
}

/// Generates the webhook URL for a specific GitLab repository.
pub fn gitlab_webhook_url(base_url: &str, repo_id: &str) -> String {
    format!(
        "{}/api/webhooks/gitlab/{}",
        base_url.trim_end_matches('/'),
        repo_id
    )
}
