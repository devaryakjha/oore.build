//! Webhook event models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use super::{GitProvider, RepositoryId};

/// Unique identifier for a webhook event.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct WebhookEventId(pub Ulid);

impl WebhookEventId {
    /// Creates a new random webhook event ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a webhook event ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for WebhookEventId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for WebhookEventId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Ulid> for WebhookEventId {
    fn from(ulid: Ulid) -> Self {
        Self(ulid)
    }
}

/// Types of webhook events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEventType {
    Push,
    PullRequest,
    MergeRequest,
    /// GitHub App installation events (created, deleted, etc.)
    Installation,
    /// GitHub App installation repositories changed
    InstallationRepositories,
}

impl WebhookEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            WebhookEventType::Push => "push",
            WebhookEventType::PullRequest => "pull_request",
            WebhookEventType::MergeRequest => "merge_request",
            WebhookEventType::Installation => "installation",
            WebhookEventType::InstallationRepositories => "installation_repositories",
        }
    }
}

impl std::fmt::Display for WebhookEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for WebhookEventType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "push" => Ok(WebhookEventType::Push),
            "pull_request" => Ok(WebhookEventType::PullRequest),
            "merge_request" => Ok(WebhookEventType::MergeRequest),
            "installation" => Ok(WebhookEventType::Installation),
            "installation_repositories" => Ok(WebhookEventType::InstallationRepositories),
            _ => Err(format!("Unknown webhook event type: {}", s)),
        }
    }
}

/// A stored webhook event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    pub id: WebhookEventId,
    pub repository_id: Option<RepositoryId>,
    pub provider: GitProvider,
    pub event_type: String,
    pub delivery_id: String,
    #[serde(skip_serializing)]
    pub payload: Vec<u8>,
    pub processed: bool,
    pub error_message: Option<String>,
    pub received_at: DateTime<Utc>,
}

/// API response DTO for webhook event (excludes raw payload).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEventResponse {
    pub id: String,
    pub repository_id: Option<String>,
    pub provider: String,
    pub event_type: String,
    pub delivery_id: String,
    pub processed: bool,
    pub error_message: Option<String>,
    pub received_at: DateTime<Utc>,
}

impl From<WebhookEvent> for WebhookEventResponse {
    fn from(event: WebhookEvent) -> Self {
        Self {
            id: event.id.to_string(),
            repository_id: event.repository_id.map(|id| id.to_string()),
            provider: event.provider.as_str().to_string(),
            event_type: event.event_type,
            delivery_id: event.delivery_id,
            processed: event.processed,
            error_message: event.error_message,
            received_at: event.received_at,
        }
    }
}

/// Parsed webhook event with extracted information.
#[derive(Debug, Clone)]
pub struct ParsedWebhookEvent {
    pub event_type: WebhookEventType,
    pub repository_owner: String,
    pub repository_name: String,
    pub commit_sha: String,
    pub branch: String,
    /// GitHub's numeric repository ID.
    pub github_repository_id: Option<i64>,
    /// GitHub App installation ID.
    pub github_installation_id: Option<i64>,
    /// GitLab's numeric project ID.
    pub gitlab_project_id: Option<i64>,
    /// PR/MR number if applicable.
    pub pull_request_number: Option<i64>,
    /// PR/MR action (opened, synchronize, closed, etc.).
    pub action: Option<String>,
}

/// Parsed installation event from GitHub.
#[derive(Debug, Clone)]
pub struct ParsedInstallationEvent {
    /// The type of event (installation or installation_repositories).
    pub event_type: WebhookEventType,
    /// Action: created, deleted, added, removed, etc.
    pub action: String,
    /// GitHub App installation ID.
    pub installation_id: i64,
    /// Account login (user or org name).
    pub account_login: String,
    /// Account type (User or Organization).
    pub account_type: String,
    /// Repository selection mode.
    pub repository_selection: Option<String>,
}
