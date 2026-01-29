//! Error types for the Oore core library.

use thiserror::Error;

/// Core error type for the Oore platform.
#[derive(Error, Debug)]
pub enum OoreError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Date parsing error in {field}: {message}")]
    DateParse {
        field: &'static str,
        message: String,
    },

    #[error("Webhook verification failed")]
    WebhookVerificationFailed,

    #[error("Invalid webhook payload: {0}")]
    InvalidWebhookPayload(String),

    #[error("Repository not found: {0}")]
    RepositoryNotFound(String),

    #[error("Build not found: {0}")]
    BuildNotFound(String),

    #[error("Webhook event not found: {0}")]
    WebhookEventNotFound(String),

    #[error("Duplicate delivery: {0}")]
    DuplicateDelivery(String),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Invalid provider: {0}")]
    InvalidProvider(String),

    #[error("OAuth error: {0}")]
    OAuth(String),

    #[error("Rate limited: {0}")]
    RateLimited(String),

    #[error("Already configured: {0}")]
    AlreadyConfigured(String),

    #[error("Not configured: {0}")]
    NotConfigured(String),

    // Pipeline-related errors
    #[error("Pipeline config not found: {0}")]
    PipelineConfigNotFound(String),

    #[error("Pipeline parse error: {0}")]
    PipelineParse(String),

    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("No matching workflow for trigger")]
    NoMatchingWorkflow,

    #[error("Build step not found: {0}")]
    BuildStepNotFound(String),

    #[error("Build log not found: {0}")]
    BuildLogNotFound(String),

    #[error("Build execution error: {0}")]
    BuildExecution(String),

    #[error("Build cancelled")]
    BuildCancelled,

    #[error("Build timeout: {0}")]
    BuildTimeout(String),

    #[error("Git clone error: {0}")]
    GitClone(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid ID: {0}")]
    InvalidId(#[from] ulid::DecodeError),
}

/// Result type alias for Oore operations.
pub type Result<T> = std::result::Result<T, OoreError>;
