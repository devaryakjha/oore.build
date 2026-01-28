//! Pipeline configuration models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ulid::Ulid;

use super::RepositoryId;

/// Unique identifier for a pipeline config.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PipelineConfigId(pub Ulid);

impl PipelineConfigId {
    /// Creates a new random pipeline config ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a pipeline config ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for PipelineConfigId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PipelineConfigId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Format of stored pipeline config.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StoredConfigFormat {
    Yaml,
    Huml,
}

impl StoredConfigFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            StoredConfigFormat::Yaml => "yaml",
            StoredConfigFormat::Huml => "huml",
        }
    }
}

impl std::fmt::Display for StoredConfigFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for StoredConfigFormat {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "yaml" => Ok(StoredConfigFormat::Yaml),
            "huml" => Ok(StoredConfigFormat::Huml),
            _ => Err(format!("Unknown config format: {}", s)),
        }
    }
}

impl Default for StoredConfigFormat {
    fn default() -> Self {
        StoredConfigFormat::Yaml
    }
}

/// A stored pipeline configuration (from web UI).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineConfig {
    pub id: PipelineConfigId,
    pub repository_id: RepositoryId,
    pub name: String,
    pub config_content: String,
    pub config_format: StoredConfigFormat,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PipelineConfig {
    /// Creates a new pipeline config with YAML format (default).
    pub fn new(repository_id: RepositoryId, name: String, config_content: String) -> Self {
        Self::with_format(repository_id, name, config_content, StoredConfigFormat::Yaml)
    }

    /// Creates a new pipeline config with specified format.
    pub fn with_format(
        repository_id: RepositoryId,
        name: String,
        config_content: String,
        config_format: StoredConfigFormat,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: PipelineConfigId::new(),
            repository_id,
            name,
            config_content,
            config_format,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Source of the pipeline configuration used for a build.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConfigSource {
    /// Config loaded from codemagic.yaml in the repository.
    Repository,
    /// Config loaded from stored UI config in database.
    Stored,
}

impl ConfigSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConfigSource::Repository => "repository",
            ConfigSource::Stored => "stored",
        }
    }
}

impl std::fmt::Display for ConfigSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for ConfigSource {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "repository" => Ok(ConfigSource::Repository),
            "stored" => Ok(ConfigSource::Stored),
            _ => Err(format!("Unknown config source: {}", s)),
        }
    }
}

/// Parsed Codemagic-compatible pipeline configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedPipeline {
    /// Map of workflow name to workflow definition.
    pub workflows: HashMap<String, Workflow>,
}

/// A workflow definition within a pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// Human-readable display name for the workflow.
    #[serde(default)]
    pub name: Option<String>,

    /// Maximum build duration in minutes (default: 60).
    #[serde(default = "default_max_build_duration")]
    pub max_build_duration: u32,

    /// Environment configuration.
    #[serde(default)]
    pub environment: WorkflowEnvironment,

    /// Triggering configuration (which events/branches trigger this workflow).
    #[serde(default)]
    pub triggering: Option<TriggeringConfig>,

    /// Build scripts to execute.
    #[serde(default)]
    pub scripts: Vec<Step>,

    /// Artifact paths to collect after build.
    #[serde(default)]
    pub artifacts: Vec<String>,
}

fn default_max_build_duration() -> u32 {
    60
}

/// Environment configuration for a workflow.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkflowEnvironment {
    /// Environment variables.
    #[serde(default)]
    pub vars: HashMap<String, String>,

    /// Flutter version to use.
    #[serde(default)]
    pub flutter: Option<String>,

    /// Xcode version to use.
    #[serde(default)]
    pub xcode: Option<String>,

    /// CocoaPods version to use.
    #[serde(default)]
    pub cocoapods: Option<String>,
}

/// Triggering configuration for a workflow.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TriggeringConfig {
    /// Events that trigger this workflow (push, pull_request, tag).
    #[serde(default)]
    pub events: Vec<TriggerEvent>,

    /// Branch patterns for filtering.
    #[serde(default)]
    pub branch_patterns: BranchPatterns,
}

/// Events that can trigger a workflow.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerEvent {
    Push,
    PullRequest,
    Tag,
}

/// Branch patterns for include/exclude filtering.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BranchPatterns {
    /// Branch patterns to include.
    #[serde(default)]
    pub include: Vec<String>,

    /// Branch patterns to exclude.
    #[serde(default)]
    pub exclude: Vec<String>,
}

/// A single script step in a workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    /// Human-readable name for the step.
    #[serde(default)]
    pub name: Option<String>,

    /// Shell script to execute.
    pub script: String,

    /// Timeout in seconds (default: 900 = 15 minutes).
    #[serde(default = "default_step_timeout")]
    pub timeout: u32,

    /// Whether to continue execution if this step fails.
    #[serde(default)]
    pub ignore_failure: bool,
}

fn default_step_timeout() -> u32 {
    900
}

/// API response DTO for pipeline config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineConfigResponse {
    pub id: String,
    pub repository_id: String,
    pub name: String,
    pub config_content: String,
    pub config_format: StoredConfigFormat,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<PipelineConfig> for PipelineConfigResponse {
    fn from(config: PipelineConfig) -> Self {
        Self {
            id: config.id.to_string(),
            repository_id: config.repository_id.to_string(),
            name: config.name,
            config_content: config.config_content,
            config_format: config.config_format,
            is_active: config.is_active,
            created_at: config.created_at,
            updated_at: config.updated_at,
        }
    }
}

/// Request to create/update a pipeline config.
#[derive(Debug, Clone, Deserialize)]
pub struct CreatePipelineConfigRequest {
    pub name: Option<String>,
    pub config_content: String,
    #[serde(default)]
    pub config_format: StoredConfigFormat,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ulid::Ulid;

    #[test]
    fn test_pipeline_config_id_new() {
        let id1 = PipelineConfigId::new();
        let id2 = PipelineConfigId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_pipeline_config_id_from_string() {
        let ulid = Ulid::new();
        let ulid_str = ulid.to_string();
        let id = PipelineConfigId::from_string(&ulid_str).unwrap();
        assert_eq!(id.0, ulid);
    }

    #[test]
    fn test_pipeline_config_id_from_string_invalid() {
        let result = PipelineConfigId::from_string("invalid-ulid");
        assert!(result.is_err());
    }

    #[test]
    fn test_pipeline_config_id_display() {
        let id = PipelineConfigId::new();
        let display = format!("{}", id);
        assert_eq!(display.len(), 26);
    }

    #[test]
    fn test_pipeline_config_id_default() {
        let id = PipelineConfigId::default();
        assert!(!id.to_string().is_empty());
    }

    #[test]
    fn test_stored_config_format_as_str() {
        assert_eq!(StoredConfigFormat::Yaml.as_str(), "yaml");
        assert_eq!(StoredConfigFormat::Huml.as_str(), "huml");
    }

    #[test]
    fn test_stored_config_format_display() {
        assert_eq!(format!("{}", StoredConfigFormat::Yaml), "yaml");
        assert_eq!(format!("{}", StoredConfigFormat::Huml), "huml");
    }

    #[test]
    fn test_stored_config_format_from_str() {
        assert_eq!(
            "yaml".parse::<StoredConfigFormat>().unwrap(),
            StoredConfigFormat::Yaml
        );
        assert_eq!(
            "huml".parse::<StoredConfigFormat>().unwrap(),
            StoredConfigFormat::Huml
        );
        assert_eq!(
            "YAML".parse::<StoredConfigFormat>().unwrap(),
            StoredConfigFormat::Yaml
        );
        assert_eq!(
            "HUML".parse::<StoredConfigFormat>().unwrap(),
            StoredConfigFormat::Huml
        );
    }

    #[test]
    fn test_stored_config_format_from_str_invalid() {
        let result = "unknown".parse::<StoredConfigFormat>();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown config format"));
    }

    #[test]
    fn test_stored_config_format_default() {
        assert_eq!(StoredConfigFormat::default(), StoredConfigFormat::Yaml);
    }

    #[test]
    fn test_stored_config_format_serde() {
        let format = StoredConfigFormat::Huml;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"huml\"");

        let parsed: StoredConfigFormat = serde_json::from_str("\"yaml\"").unwrap();
        assert_eq!(parsed, StoredConfigFormat::Yaml);
    }

    #[test]
    fn test_pipeline_config_new() {
        let repo_id = RepositoryId::new();
        let config = PipelineConfig::new(
            repo_id.clone(),
            "default".to_string(),
            "workflows:\n  default:\n    scripts:\n      - script: echo test".to_string(),
        );

        assert_eq!(config.repository_id, repo_id);
        assert_eq!(config.name, "default");
        assert!(config.config_content.contains("workflows"));
        assert_eq!(config.config_format, StoredConfigFormat::Yaml);
        assert!(config.is_active);
    }

    #[test]
    fn test_pipeline_config_with_format() {
        let repo_id = RepositoryId::new();
        let config = PipelineConfig::with_format(
            repo_id.clone(),
            "huml-config".to_string(),
            "%HUML v0.2.0\nworkflows::\n  default::\n    scripts::\n      - script: \"echo test\""
                .to_string(),
            StoredConfigFormat::Huml,
        );

        assert_eq!(config.repository_id, repo_id);
        assert_eq!(config.name, "huml-config");
        assert!(config.config_content.contains("%HUML"));
        assert_eq!(config.config_format, StoredConfigFormat::Huml);
        assert!(config.is_active);
    }

    #[test]
    fn test_config_source_as_str() {
        assert_eq!(ConfigSource::Repository.as_str(), "repository");
        assert_eq!(ConfigSource::Stored.as_str(), "stored");
    }

    #[test]
    fn test_config_source_display() {
        assert_eq!(format!("{}", ConfigSource::Repository), "repository");
        assert_eq!(format!("{}", ConfigSource::Stored), "stored");
    }

    #[test]
    fn test_config_source_from_str() {
        assert_eq!("repository".parse::<ConfigSource>().unwrap(), ConfigSource::Repository);
        assert_eq!("STORED".parse::<ConfigSource>().unwrap(), ConfigSource::Stored);
        assert_eq!("Repository".parse::<ConfigSource>().unwrap(), ConfigSource::Repository);
    }

    #[test]
    fn test_config_source_from_str_invalid() {
        let result = "unknown".parse::<ConfigSource>();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown config source"));
    }

    #[test]
    fn test_config_source_serde() {
        let source = ConfigSource::Repository;
        let json = serde_json::to_string(&source).unwrap();
        assert_eq!(json, "\"repository\"");

        let parsed: ConfigSource = serde_json::from_str("\"stored\"").unwrap();
        assert_eq!(parsed, ConfigSource::Stored);
    }

    #[test]
    fn test_trigger_event_serde() {
        let event = TriggerEvent::Push;
        let json = serde_json::to_string(&event).unwrap();
        assert_eq!(json, "\"push\"");

        let event = TriggerEvent::PullRequest;
        let json = serde_json::to_string(&event).unwrap();
        assert_eq!(json, "\"pull_request\"");

        let parsed: TriggerEvent = serde_json::from_str("\"tag\"").unwrap();
        assert_eq!(parsed, TriggerEvent::Tag);
    }

    #[test]
    fn test_step_default_values() {
        let yaml = r#"
script: echo "hello"
"#;
        let step: Step = serde_yaml::from_str(yaml).unwrap();
        assert!(step.name.is_none());
        assert_eq!(step.script, "echo \"hello\"");
        assert_eq!(step.timeout, 900); // default
        assert!(!step.ignore_failure); // default
    }

    #[test]
    fn test_step_all_values() {
        let yaml = r#"
name: Test Step
script: flutter test
timeout: 1800
ignore_failure: true
"#;
        let step: Step = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(step.name, Some("Test Step".to_string()));
        assert_eq!(step.script, "flutter test");
        assert_eq!(step.timeout, 1800);
        assert!(step.ignore_failure);
    }

    #[test]
    fn test_workflow_environment_default() {
        let env = WorkflowEnvironment::default();
        assert!(env.vars.is_empty());
        assert!(env.flutter.is_none());
        assert!(env.xcode.is_none());
        assert!(env.cocoapods.is_none());
    }

    #[test]
    fn test_workflow_environment_with_values() {
        let yaml = r#"
vars:
  DEBUG: "true"
  API_KEY: "secret"
flutter: "3.19.0"
xcode: "15.0"
cocoapods: "1.14.0"
"#;
        let env: WorkflowEnvironment = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(env.vars.len(), 2);
        assert_eq!(env.vars.get("DEBUG"), Some(&"true".to_string()));
        assert_eq!(env.flutter, Some("3.19.0".to_string()));
        assert_eq!(env.xcode, Some("15.0".to_string()));
        assert_eq!(env.cocoapods, Some("1.14.0".to_string()));
    }

    #[test]
    fn test_branch_patterns_default() {
        let patterns = BranchPatterns::default();
        assert!(patterns.include.is_empty());
        assert!(patterns.exclude.is_empty());
    }

    #[test]
    fn test_branch_patterns_with_values() {
        let yaml = r#"
include:
  - main
  - "release/*"
exclude:
  - "wip/*"
"#;
        let patterns: BranchPatterns = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(patterns.include.len(), 2);
        assert_eq!(patterns.exclude.len(), 1);
        assert!(patterns.include.contains(&"main".to_string()));
        assert!(patterns.exclude.contains(&"wip/*".to_string()));
    }

    #[test]
    fn test_triggering_config_default() {
        let config = TriggeringConfig::default();
        assert!(config.events.is_empty());
        assert!(config.branch_patterns.include.is_empty());
        assert!(config.branch_patterns.exclude.is_empty());
    }

    #[test]
    fn test_triggering_config_with_values() {
        let yaml = r#"
events:
  - push
  - pull_request
branch_patterns:
  include:
    - main
"#;
        let config: TriggeringConfig = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(config.events.len(), 2);
        assert!(config.events.contains(&TriggerEvent::Push));
        assert!(config.events.contains(&TriggerEvent::PullRequest));
        assert_eq!(config.branch_patterns.include.len(), 1);
    }

    #[test]
    fn test_workflow_default_max_build_duration() {
        let yaml = r#"
scripts:
  - script: echo test
"#;
        let workflow: Workflow = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(workflow.max_build_duration, 60); // default
    }

    #[test]
    fn test_workflow_custom_max_build_duration() {
        let yaml = r#"
max_build_duration: 120
scripts:
  - script: echo test
"#;
        let workflow: Workflow = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(workflow.max_build_duration, 120);
    }

    #[test]
    fn test_workflow_with_all_fields() {
        let yaml = r#"
name: Full Workflow
max_build_duration: 90
environment:
  vars:
    CI: "true"
triggering:
  events:
    - push
scripts:
  - name: Build
    script: flutter build
artifacts:
  - "build/**/*.apk"
"#;
        let workflow: Workflow = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(workflow.name, Some("Full Workflow".to_string()));
        assert_eq!(workflow.max_build_duration, 90);
        assert_eq!(workflow.environment.vars.get("CI"), Some(&"true".to_string()));
        assert!(workflow.triggering.is_some());
        assert_eq!(workflow.scripts.len(), 1);
        assert_eq!(workflow.artifacts.len(), 1);
    }

    #[test]
    fn test_parsed_pipeline_single_workflow() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo hello
"#;
        let pipeline: ParsedPipeline = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(pipeline.workflows.len(), 1);
        assert!(pipeline.workflows.contains_key("default"));
    }

    #[test]
    fn test_parsed_pipeline_multiple_workflows() {
        let yaml = r#"
workflows:
  ios:
    scripts:
      - script: flutter build ios
  android:
    scripts:
      - script: flutter build android
"#;
        let pipeline: ParsedPipeline = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(pipeline.workflows.len(), 2);
        assert!(pipeline.workflows.contains_key("ios"));
        assert!(pipeline.workflows.contains_key("android"));
    }

    #[test]
    fn test_pipeline_config_response_from_config() {
        let repo_id = RepositoryId::new();
        let config = PipelineConfig::new(
            repo_id.clone(),
            "test-config".to_string(),
            "workflows: {}".to_string(),
        );

        let response: PipelineConfigResponse = config.into();

        assert!(!response.id.is_empty());
        assert_eq!(response.repository_id, repo_id.to_string());
        assert_eq!(response.name, "test-config");
        assert_eq!(response.config_content, "workflows: {}");
        assert_eq!(response.config_format, StoredConfigFormat::Yaml);
        assert!(response.is_active);
    }

    #[test]
    fn test_pipeline_config_response_from_huml_config() {
        let repo_id = RepositoryId::new();
        let config = PipelineConfig::with_format(
            repo_id.clone(),
            "huml-test".to_string(),
            "%HUML v0.2.0\nworkflows:: {}".to_string(),
            StoredConfigFormat::Huml,
        );

        let response: PipelineConfigResponse = config.into();

        assert_eq!(response.config_format, StoredConfigFormat::Huml);
        assert!(response.config_content.contains("%HUML"));
    }

    #[test]
    fn test_create_pipeline_config_request_deserialize() {
        let json = r#"{"name": "my-config", "config_content": "workflows:\n  default:\n    scripts:\n      - script: echo test"}"#;
        let request: CreatePipelineConfigRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.name, Some("my-config".to_string()));
        assert!(request.config_content.contains("workflows"));
        assert_eq!(request.config_format, StoredConfigFormat::Yaml); // default
    }

    #[test]
    fn test_create_pipeline_config_request_without_name() {
        let json = r#"{"config_content": "workflows: {}"}"#;
        let request: CreatePipelineConfigRequest = serde_json::from_str(json).unwrap();
        assert!(request.name.is_none());
        assert_eq!(request.config_content, "workflows: {}");
        assert_eq!(request.config_format, StoredConfigFormat::Yaml);
    }

    #[test]
    fn test_create_pipeline_config_request_with_huml_format() {
        let json = r#"{"name": "huml-config", "config_content": "%HUML v0.2.0\nworkflows:: {}", "config_format": "huml"}"#;
        let request: CreatePipelineConfigRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.name, Some("huml-config".to_string()));
        assert_eq!(request.config_format, StoredConfigFormat::Huml);
    }

    #[test]
    fn test_trigger_event_equality() {
        assert_eq!(TriggerEvent::Push, TriggerEvent::Push);
        assert_ne!(TriggerEvent::Push, TriggerEvent::PullRequest);
        assert_ne!(TriggerEvent::PullRequest, TriggerEvent::Tag);
    }

    #[test]
    fn test_config_source_equality() {
        assert_eq!(ConfigSource::Repository, ConfigSource::Repository);
        assert_ne!(ConfigSource::Repository, ConfigSource::Stored);
    }

    #[test]
    fn test_pipeline_config_id_hash() {
        use std::collections::HashSet;

        let id1 = PipelineConfigId::new();
        let id2 = PipelineConfigId::new();

        let mut set = HashSet::new();
        set.insert(id1.clone());

        assert!(set.contains(&id1));
        assert!(!set.contains(&id2));
    }
}
