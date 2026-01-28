//! Build log models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use super::BuildId;

/// Unique identifier for a build log record.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BuildLogId(pub Ulid);

impl BuildLogId {
    /// Creates a new random build log ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a build log ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for BuildLogId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for BuildLogId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Type of log stream.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogStream {
    Stdout,
    Stderr,
    System,
}

impl LogStream {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogStream::Stdout => "stdout",
            LogStream::Stderr => "stderr",
            LogStream::System => "system",
        }
    }
}

impl std::fmt::Display for LogStream {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for LogStream {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "stdout" => Ok(LogStream::Stdout),
            "stderr" => Ok(LogStream::Stderr),
            "system" => Ok(LogStream::System),
            _ => Err(format!("Unknown log stream: {}", s)),
        }
    }
}

/// A build log file record (metadata, not content).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildLog {
    pub id: BuildLogId,
    pub build_id: BuildId,
    pub step_index: i32,
    pub stream: LogStream,
    /// Relative path to the log file (e.g., "{build_id}/step-{n}-stdout.log").
    pub log_file_path: String,
    pub line_count: i32,
    pub created_at: DateTime<Utc>,
}

impl BuildLog {
    /// Creates a new build log record.
    pub fn new(
        build_id: BuildId,
        step_index: i32,
        stream: LogStream,
        log_file_path: String,
    ) -> Self {
        Self {
            id: BuildLogId::new(),
            build_id,
            step_index,
            stream,
            log_file_path,
            line_count: 0,
            created_at: Utc::now(),
        }
    }
}

/// API response DTO for build log metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildLogResponse {
    pub id: String,
    pub build_id: String,
    pub step_index: i32,
    pub stream: String,
    pub log_file_path: String,
    pub line_count: i32,
    pub created_at: DateTime<Utc>,
}

impl From<BuildLog> for BuildLogResponse {
    fn from(log: BuildLog) -> Self {
        Self {
            id: log.id.to_string(),
            build_id: log.build_id.to_string(),
            step_index: log.step_index,
            stream: log.stream.as_str().to_string(),
            log_file_path: log.log_file_path,
            line_count: log.line_count,
            created_at: log.created_at,
        }
    }
}

/// Response containing log content.
#[derive(Debug, Clone, Serialize)]
pub struct BuildLogContentResponse {
    pub step_index: i32,
    pub stream: String,
    pub content: String,
    pub line_count: i32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ulid::Ulid;

    #[test]
    fn test_build_log_id_new() {
        let id1 = BuildLogId::new();
        let id2 = BuildLogId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_build_log_id_from_string() {
        let ulid = Ulid::new();
        let ulid_str = ulid.to_string();
        let id = BuildLogId::from_string(&ulid_str).unwrap();
        assert_eq!(id.0, ulid);
    }

    #[test]
    fn test_build_log_id_from_string_invalid() {
        let result = BuildLogId::from_string("not-a-ulid");
        assert!(result.is_err());
    }

    #[test]
    fn test_build_log_id_display() {
        let id = BuildLogId::new();
        let display = format!("{}", id);
        assert_eq!(display.len(), 26); // ULID is 26 characters
    }

    #[test]
    fn test_build_log_id_default() {
        let id = BuildLogId::default();
        assert!(!id.to_string().is_empty());
    }

    #[test]
    fn test_log_stream_as_str() {
        assert_eq!(LogStream::Stdout.as_str(), "stdout");
        assert_eq!(LogStream::Stderr.as_str(), "stderr");
        assert_eq!(LogStream::System.as_str(), "system");
    }

    #[test]
    fn test_log_stream_display() {
        assert_eq!(format!("{}", LogStream::Stdout), "stdout");
        assert_eq!(format!("{}", LogStream::Stderr), "stderr");
        assert_eq!(format!("{}", LogStream::System), "system");
    }

    #[test]
    fn test_log_stream_from_str() {
        assert_eq!("stdout".parse::<LogStream>().unwrap(), LogStream::Stdout);
        assert_eq!("STDERR".parse::<LogStream>().unwrap(), LogStream::Stderr);
        assert_eq!("System".parse::<LogStream>().unwrap(), LogStream::System);
    }

    #[test]
    fn test_log_stream_from_str_invalid() {
        let result = "unknown".parse::<LogStream>();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown log stream"));
    }

    #[test]
    fn test_build_log_new() {
        let build_id = BuildId::new();
        let log = BuildLog::new(
            build_id.clone(),
            0,
            LogStream::Stdout,
            "abc123/step-0-stdout.log".to_string(),
        );

        assert_eq!(log.build_id, build_id);
        assert_eq!(log.step_index, 0);
        assert_eq!(log.stream, LogStream::Stdout);
        assert_eq!(log.log_file_path, "abc123/step-0-stdout.log");
        assert_eq!(log.line_count, 0);
    }

    #[test]
    fn test_build_log_new_stderr() {
        let build_id = BuildId::new();
        let log = BuildLog::new(
            build_id.clone(),
            5,
            LogStream::Stderr,
            "build-xyz/step-5-stderr.log".to_string(),
        );

        assert_eq!(log.step_index, 5);
        assert_eq!(log.stream, LogStream::Stderr);
    }

    #[test]
    fn test_build_log_new_system() {
        let build_id = BuildId::new();
        let log = BuildLog::new(
            build_id.clone(),
            0,
            LogStream::System,
            "build-xyz/system.log".to_string(),
        );

        assert_eq!(log.stream, LogStream::System);
    }

    #[test]
    fn test_build_log_response_from_log() {
        let build_id = BuildId::new();
        let log = BuildLog::new(
            build_id.clone(),
            2,
            LogStream::Stdout,
            "xyz/step-2-stdout.log".to_string(),
        );

        let response: BuildLogResponse = log.into();

        assert!(!response.id.is_empty());
        assert_eq!(response.build_id, build_id.to_string());
        assert_eq!(response.step_index, 2);
        assert_eq!(response.stream, "stdout");
        assert_eq!(response.log_file_path, "xyz/step-2-stdout.log");
        assert_eq!(response.line_count, 0);
    }

    #[test]
    fn test_log_stream_serde() {
        // Test serialization
        let stream = LogStream::Stderr;
        let json = serde_json::to_string(&stream).unwrap();
        assert_eq!(json, "\"stderr\"");

        // Test deserialization
        let parsed: LogStream = serde_json::from_str("\"stdout\"").unwrap();
        assert_eq!(parsed, LogStream::Stdout);
    }

    #[test]
    fn test_build_log_serde() {
        let build_id = BuildId::new();
        let log = BuildLog::new(
            build_id,
            0,
            LogStream::Stdout,
            "test/stdout.log".to_string(),
        );

        let json = serde_json::to_string(&log).unwrap();
        assert!(json.contains("\"stream\":\"stdout\""));
        assert!(json.contains("\"log_file_path\":\"test/stdout.log\""));

        let parsed: BuildLog = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.stream, LogStream::Stdout);
        assert_eq!(parsed.log_file_path, "test/stdout.log");
    }

    #[test]
    fn test_build_log_content_response() {
        let response = BuildLogContentResponse {
            step_index: 0,
            stream: "stdout".to_string(),
            content: "Hello\nWorld\n".to_string(),
            line_count: 2,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"step_index\":0"));
        assert!(json.contains("\"stream\":\"stdout\""));
        assert!(json.contains("\"content\":\"Hello\\nWorld\\n\""));
        assert!(json.contains("\"line_count\":2"));
    }

    #[test]
    fn test_log_stream_equality() {
        assert_eq!(LogStream::Stdout, LogStream::Stdout);
        assert_ne!(LogStream::Stdout, LogStream::Stderr);
        assert_ne!(LogStream::Stderr, LogStream::System);
    }

    #[test]
    fn test_build_log_id_hash() {
        use std::collections::HashSet;

        let id1 = BuildLogId::new();
        let id2 = BuildLogId::new();

        let mut set = HashSet::new();
        set.insert(id1.clone());

        assert!(set.contains(&id1));
        assert!(!set.contains(&id2));
    }
}
