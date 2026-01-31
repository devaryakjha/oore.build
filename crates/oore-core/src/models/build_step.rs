//! Build step execution models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use ulid::Ulid;

use super::BuildId;

/// Unique identifier for a build step.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BuildStepId(pub Ulid);

impl BuildStepId {
    /// Creates a new random build step ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a build step ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for BuildStepId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for BuildStepId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Status of a build step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../types/")]
pub enum StepStatus {
    Pending,
    Running,
    Success,
    Failure,
    Skipped,
    Cancelled,
}

impl StepStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            StepStatus::Pending => "pending",
            StepStatus::Running => "running",
            StepStatus::Success => "success",
            StepStatus::Failure => "failure",
            StepStatus::Skipped => "skipped",
            StepStatus::Cancelled => "cancelled",
        }
    }

    /// Returns true if this is a terminal status.
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            StepStatus::Success | StepStatus::Failure | StepStatus::Skipped | StepStatus::Cancelled
        )
    }
}

impl std::fmt::Display for StepStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for StepStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(StepStatus::Pending),
            "running" => Ok(StepStatus::Running),
            "success" => Ok(StepStatus::Success),
            "failure" => Ok(StepStatus::Failure),
            "skipped" => Ok(StepStatus::Skipped),
            "cancelled" => Ok(StepStatus::Cancelled),
            _ => Err(format!("Unknown step status: {}", s)),
        }
    }
}

/// A build step execution record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildStep {
    pub id: BuildStepId,
    pub build_id: BuildId,
    pub step_index: i32,
    pub name: String,
    pub script: Option<String>,
    pub timeout_secs: Option<i32>,
    pub ignore_failure: bool,
    pub status: StepStatus,
    pub exit_code: Option<i32>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl BuildStep {
    /// Creates a new build step record.
    pub fn new(
        build_id: BuildId,
        step_index: i32,
        name: String,
        script: Option<String>,
        timeout_secs: Option<i32>,
        ignore_failure: bool,
    ) -> Self {
        Self {
            id: BuildStepId::new(),
            build_id,
            step_index,
            name,
            script,
            timeout_secs,
            ignore_failure,
            status: StepStatus::Pending,
            exit_code: None,
            started_at: None,
            finished_at: None,
            created_at: Utc::now(),
        }
    }
}

/// API response DTO for build step.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct BuildStepResponse {
    pub id: String,
    pub build_id: String,
    pub step_index: i32,
    pub name: String,
    pub script: Option<String>,
    pub timeout_secs: Option<i32>,
    pub ignore_failure: bool,
    pub status: String,
    pub exit_code: Option<i32>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<BuildStep> for BuildStepResponse {
    fn from(step: BuildStep) -> Self {
        Self {
            id: step.id.to_string(),
            build_id: step.build_id.to_string(),
            step_index: step.step_index,
            name: step.name,
            script: step.script,
            timeout_secs: step.timeout_secs,
            ignore_failure: step.ignore_failure,
            status: step.status.as_str().to_string(),
            exit_code: step.exit_code,
            started_at: step.started_at,
            finished_at: step.finished_at,
            created_at: step.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ulid::Ulid;

    #[test]
    fn test_build_step_id_new() {
        let id1 = BuildStepId::new();
        let id2 = BuildStepId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_build_step_id_from_string() {
        let ulid = Ulid::new();
        let ulid_str = ulid.to_string();
        let id = BuildStepId::from_string(&ulid_str).unwrap();
        assert_eq!(id.0, ulid);
    }

    #[test]
    fn test_build_step_id_from_string_invalid() {
        let result = BuildStepId::from_string("invalid");
        assert!(result.is_err());
    }

    #[test]
    fn test_build_step_id_display() {
        let id = BuildStepId::new();
        let display = format!("{}", id);
        assert_eq!(display.len(), 26); // ULID is 26 characters
    }

    #[test]
    fn test_build_step_id_default() {
        let id = BuildStepId::default();
        // Should produce valid ULID
        assert!(!id.to_string().is_empty());
    }

    #[test]
    fn test_step_status_as_str() {
        assert_eq!(StepStatus::Pending.as_str(), "pending");
        assert_eq!(StepStatus::Running.as_str(), "running");
        assert_eq!(StepStatus::Success.as_str(), "success");
        assert_eq!(StepStatus::Failure.as_str(), "failure");
        assert_eq!(StepStatus::Skipped.as_str(), "skipped");
        assert_eq!(StepStatus::Cancelled.as_str(), "cancelled");
    }

    #[test]
    fn test_step_status_display() {
        assert_eq!(format!("{}", StepStatus::Pending), "pending");
        assert_eq!(format!("{}", StepStatus::Success), "success");
    }

    #[test]
    fn test_step_status_from_str() {
        assert_eq!("pending".parse::<StepStatus>().unwrap(), StepStatus::Pending);
        assert_eq!("RUNNING".parse::<StepStatus>().unwrap(), StepStatus::Running);
        assert_eq!("Success".parse::<StepStatus>().unwrap(), StepStatus::Success);
        assert_eq!("FAILURE".parse::<StepStatus>().unwrap(), StepStatus::Failure);
        assert_eq!("skipped".parse::<StepStatus>().unwrap(), StepStatus::Skipped);
        assert_eq!("Cancelled".parse::<StepStatus>().unwrap(), StepStatus::Cancelled);
    }

    #[test]
    fn test_step_status_from_str_invalid() {
        let result = "unknown".parse::<StepStatus>();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown step status"));
    }

    #[test]
    fn test_step_status_is_terminal() {
        assert!(!StepStatus::Pending.is_terminal());
        assert!(!StepStatus::Running.is_terminal());
        assert!(StepStatus::Success.is_terminal());
        assert!(StepStatus::Failure.is_terminal());
        assert!(StepStatus::Skipped.is_terminal());
        assert!(StepStatus::Cancelled.is_terminal());
    }

    #[test]
    fn test_build_step_new() {
        let build_id = BuildId::new();
        let step = BuildStep::new(
            build_id.clone(),
            0,
            "Test Step".to_string(),
            Some("echo test".to_string()),
            Some(300),
            false,
        );

        assert_eq!(step.build_id, build_id);
        assert_eq!(step.step_index, 0);
        assert_eq!(step.name, "Test Step");
        assert_eq!(step.script, Some("echo test".to_string()));
        assert_eq!(step.timeout_secs, Some(300));
        assert!(!step.ignore_failure);
        assert_eq!(step.status, StepStatus::Pending);
        assert!(step.exit_code.is_none());
        assert!(step.started_at.is_none());
        assert!(step.finished_at.is_none());
    }

    #[test]
    fn test_build_step_new_minimal() {
        let build_id = BuildId::new();
        let step = BuildStep::new(
            build_id.clone(),
            5,
            "Step 5".to_string(),
            None,
            None,
            true,
        );

        assert_eq!(step.step_index, 5);
        assert_eq!(step.name, "Step 5");
        assert!(step.script.is_none());
        assert!(step.timeout_secs.is_none());
        assert!(step.ignore_failure);
    }

    #[test]
    fn test_build_step_response_from_step() {
        let build_id = BuildId::new();
        let step = BuildStep::new(
            build_id.clone(),
            0,
            "Test".to_string(),
            Some("echo hello".to_string()),
            Some(600),
            false,
        );

        let response: BuildStepResponse = step.into();

        assert!(!response.id.is_empty());
        assert_eq!(response.build_id, build_id.to_string());
        assert_eq!(response.step_index, 0);
        assert_eq!(response.name, "Test");
        assert_eq!(response.script, Some("echo hello".to_string()));
        assert_eq!(response.timeout_secs, Some(600));
        assert!(!response.ignore_failure);
        assert_eq!(response.status, "pending");
        assert!(response.exit_code.is_none());
    }

    #[test]
    fn test_step_status_serde() {
        // Test serialization
        let status = StepStatus::Running;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"running\"");

        // Test deserialization
        let parsed: StepStatus = serde_json::from_str("\"success\"").unwrap();
        assert_eq!(parsed, StepStatus::Success);
    }

    #[test]
    fn test_build_step_serde() {
        let build_id = BuildId::new();
        let step = BuildStep::new(
            build_id,
            0,
            "Test".to_string(),
            Some("echo test".to_string()),
            None,
            false,
        );

        // Should serialize without error
        let json = serde_json::to_string(&step).unwrap();
        assert!(json.contains("\"status\":\"pending\""));
        assert!(json.contains("\"name\":\"Test\""));

        // Should deserialize without error
        let parsed: BuildStep = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "Test");
        assert_eq!(parsed.status, StepStatus::Pending);
    }
}
