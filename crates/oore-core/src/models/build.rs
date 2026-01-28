//! Build model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use super::{ConfigSource, RepositoryId, WebhookEventId};

/// Unique identifier for a build.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BuildId(pub Ulid);

impl BuildId {
    /// Creates a new random build ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a build ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for BuildId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for BuildId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Ulid> for BuildId {
    fn from(ulid: Ulid) -> Self {
        Self(ulid)
    }
}

/// Build status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BuildStatus {
    Pending,
    Running,
    Success,
    Failure,
    Cancelled,
}

impl BuildStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BuildStatus::Pending => "pending",
            BuildStatus::Running => "running",
            BuildStatus::Success => "success",
            BuildStatus::Failure => "failure",
            BuildStatus::Cancelled => "cancelled",
        }
    }
}

impl std::fmt::Display for BuildStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for BuildStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(BuildStatus::Pending),
            "running" => Ok(BuildStatus::Running),
            "success" => Ok(BuildStatus::Success),
            "failure" => Ok(BuildStatus::Failure),
            "cancelled" => Ok(BuildStatus::Cancelled),
            _ => Err(format!("Unknown build status: {}", s)),
        }
    }
}

/// Build trigger type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerType {
    Push,
    PullRequest,
    MergeRequest,
    Manual,
}

impl TriggerType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TriggerType::Push => "push",
            TriggerType::PullRequest => "pull_request",
            TriggerType::MergeRequest => "merge_request",
            TriggerType::Manual => "manual",
        }
    }
}

impl std::fmt::Display for TriggerType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for TriggerType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "push" => Ok(TriggerType::Push),
            "pull_request" => Ok(TriggerType::PullRequest),
            "merge_request" => Ok(TriggerType::MergeRequest),
            "manual" => Ok(TriggerType::Manual),
            _ => Err(format!("Unknown trigger type: {}", s)),
        }
    }
}

/// A build execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Build {
    pub id: BuildId,
    pub repository_id: RepositoryId,
    pub webhook_event_id: Option<WebhookEventId>,
    pub commit_sha: String,
    pub branch: String,
    pub trigger_type: TriggerType,
    pub status: BuildStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    /// Name of the workflow being executed.
    pub workflow_name: Option<String>,
    /// Source of the pipeline configuration.
    pub config_source: Option<ConfigSource>,
    /// Error message if build failed during setup.
    pub error_message: Option<String>,
}

impl Build {
    /// Creates a new build record.
    pub fn new(
        repository_id: RepositoryId,
        webhook_event_id: Option<WebhookEventId>,
        commit_sha: String,
        branch: String,
        trigger_type: TriggerType,
    ) -> Self {
        Self {
            id: BuildId::new(),
            repository_id,
            webhook_event_id,
            commit_sha,
            branch,
            trigger_type,
            status: BuildStatus::Pending,
            started_at: None,
            finished_at: None,
            created_at: Utc::now(),
            workflow_name: None,
            config_source: None,
            error_message: None,
        }
    }
}

/// API response DTO for build.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildResponse {
    pub id: String,
    pub repository_id: String,
    pub webhook_event_id: Option<String>,
    pub commit_sha: String,
    pub branch: String,
    pub trigger_type: String,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub workflow_name: Option<String>,
    pub config_source: Option<String>,
    pub error_message: Option<String>,
}

impl From<Build> for BuildResponse {
    fn from(build: Build) -> Self {
        Self {
            id: build.id.to_string(),
            repository_id: build.repository_id.to_string(),
            webhook_event_id: build.webhook_event_id.map(|id| id.to_string()),
            commit_sha: build.commit_sha,
            branch: build.branch,
            trigger_type: build.trigger_type.as_str().to_string(),
            status: build.status.as_str().to_string(),
            started_at: build.started_at,
            finished_at: build.finished_at,
            created_at: build.created_at,
            workflow_name: build.workflow_name,
            config_source: build.config_source.map(|s| s.as_str().to_string()),
            error_message: build.error_message,
        }
    }
}

/// Request to trigger a manual build.
#[derive(Debug, Clone, Deserialize)]
pub struct TriggerBuildRequest {
    pub branch: Option<String>,
    pub commit_sha: Option<String>,
}
