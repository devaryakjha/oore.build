//! Repository model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use ulid::Ulid;

use super::GitProvider;

/// Unique identifier for a repository.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RepositoryId(pub Ulid);

impl RepositoryId {
    /// Creates a new random repository ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a repository ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for RepositoryId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for RepositoryId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Ulid> for RepositoryId {
    fn from(ulid: Ulid) -> Self {
        Self(ulid)
    }
}

/// A connected Git repository.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: RepositoryId,
    pub name: String,
    pub provider: GitProvider,
    pub owner: String,
    pub repo_name: String,
    pub clone_url: String,
    pub default_branch: String,
    /// HMAC of the webhook secret (for GitLab token verification).
    #[serde(skip_serializing)]
    pub webhook_secret_hmac: Option<String>,
    pub is_active: bool,
    /// GitHub's numeric repository ID (for webhook mapping).
    pub github_repository_id: Option<i64>,
    /// GitHub App installation ID (for token minting).
    pub github_installation_id: Option<i64>,
    /// GitLab's numeric project ID.
    pub gitlab_project_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Repository {
    /// Creates a new repository with the given details.
    pub fn new(
        name: String,
        provider: GitProvider,
        owner: String,
        repo_name: String,
        clone_url: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: RepositoryId::new(),
            name,
            provider,
            owner,
            repo_name,
            clone_url,
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: None,
            github_installation_id: None,
            gitlab_project_id: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// API response DTO for repository (excludes secrets).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct RepositoryResponse {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub owner: String,
    pub repo_name: String,
    pub clone_url: String,
    pub default_branch: String,
    pub is_active: bool,
    #[ts(type = "number | null")]
    pub github_repository_id: Option<i64>,
    #[ts(type = "number | null")]
    pub github_installation_id: Option<i64>,
    #[ts(type = "number | null")]
    pub gitlab_project_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Repository> for RepositoryResponse {
    fn from(repo: Repository) -> Self {
        Self {
            id: repo.id.to_string(),
            name: repo.name,
            provider: repo.provider.as_str().to_string(),
            owner: repo.owner,
            repo_name: repo.repo_name,
            clone_url: repo.clone_url,
            default_branch: repo.default_branch,
            is_active: repo.is_active,
            github_repository_id: repo.github_repository_id,
            github_installation_id: repo.github_installation_id,
            gitlab_project_id: repo.gitlab_project_id,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
        }
    }
}

/// Request to create a new repository.
#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct CreateRepositoryRequest {
    pub name: Option<String>,
    pub provider: String,
    pub owner: String,
    pub repo_name: String,
    pub clone_url: Option<String>,
    pub default_branch: Option<String>,
    /// Plaintext webhook secret (will be hashed before storage).
    pub webhook_secret: Option<String>,
    #[ts(type = "number | null")]
    pub github_repository_id: Option<i64>,
    #[ts(type = "number | null")]
    pub github_installation_id: Option<i64>,
    #[ts(type = "number | null")]
    pub gitlab_project_id: Option<i64>,
}

/// Request to update a repository.
#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct UpdateRepositoryRequest {
    pub name: Option<String>,
    pub default_branch: Option<String>,
    pub is_active: Option<bool>,
    /// New webhook secret (will be hashed before storage).
    pub webhook_secret: Option<String>,
    #[ts(type = "number | null")]
    pub github_installation_id: Option<i64>,
    #[ts(type = "number | null")]
    pub gitlab_project_id: Option<i64>,
}
