//! Shared API request/response types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Health check response.
#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub status: String,
}

/// Version response.
#[derive(Debug, Deserialize)]
pub struct VersionResponse {
    pub version: String,
    pub name: String,
}

/// Repository response from the API.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RepositoryResponse {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub owner: String,
    pub repo_name: String,
    pub clone_url: String,
    pub default_branch: String,
    pub is_active: bool,
    pub github_repository_id: Option<i64>,
    pub github_installation_id: Option<i64>,
    pub gitlab_project_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a new repository.
#[derive(Debug, Clone, Serialize)]
pub struct CreateRepositoryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub provider: String,
    pub owner: String,
    pub repo_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github_repository_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github_installation_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gitlab_project_id: Option<i64>,
}

/// Webhook URL response.
#[derive(Debug, Deserialize)]
pub struct WebhookUrlResponse {
    pub webhook_url: String,
    pub provider: String,
}

/// Setup status response.
#[derive(Debug, Deserialize)]
pub struct SetupStatusResponse {
    pub github: GitHubStatus,
    pub gitlab: Vec<GitLabStatus>,
    pub encryption_configured: bool,
    pub admin_token_configured: bool,
}

/// GitHub setup status.
#[derive(Debug, Deserialize)]
pub struct GitHubStatus {
    pub configured: bool,
    pub app_name: Option<String>,
    pub installations_count: usize,
}

/// GitLab setup status.
#[derive(Debug, Deserialize)]
pub struct GitLabStatus {
    pub configured: bool,
    pub instance_url: Option<String>,
    pub username: Option<String>,
    pub enabled_projects_count: usize,
}
