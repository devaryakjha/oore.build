//! Pipeline parser for Codemagic-compatible configuration.
//!
//! Supports both YAML and HUML formats.

use crate::error::{OoreError, Result};
use crate::models::{ParsedPipeline, Step, Workflow, WorkflowEnvironment};

/// Format of the pipeline configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigFormat {
    Yaml,
    Huml,
}

/// Supported Codemagic YAML fields (subset of full spec).
///
/// ```yaml
/// workflows:
///   <name>:
///     name: string           # Display name
///     max_build_duration: int  # Minutes (default 60)
///     environment:
///       vars: map<string, string>
///     triggering:
///       events: [push, pull_request, tag]
///       branch_patterns:
///         include: [glob...]
///         exclude: [glob...]
///     scripts:
///       - name: string
///         script: string
///         timeout: int       # Seconds (default 900)
///         ignore_failure: bool
///     artifacts:
///       - glob pattern
/// ```

/// Parses a Codemagic-compatible YAML string into a ParsedPipeline.
pub fn parse_pipeline(yaml_content: &str) -> Result<ParsedPipeline> {
    let parsed: ParsedPipeline = serde_yaml::from_str(yaml_content)
        .map_err(|e| OoreError::PipelineParse(format!("Invalid YAML: {}", e)))?;

    validate_pipeline(&parsed)?;
    warn_unsupported_fields(yaml_content);

    Ok(parsed)
}

/// Parses a HUML string into a ParsedPipeline.
pub fn parse_pipeline_huml(huml_content: &str) -> Result<ParsedPipeline> {
    let parsed: ParsedPipeline = huml_rs::serde::from_str(huml_content)
        .map_err(|e| OoreError::PipelineParse(format!("Invalid HUML: {}", e)))?;

    validate_pipeline(&parsed)?;
    Ok(parsed)
}

/// Parses a pipeline config, auto-detecting format from content.
///
/// - If starts with `%HUML` → parse as HUML
/// - Otherwise → parse as YAML
pub fn parse_pipeline_auto(content: &str) -> Result<(ParsedPipeline, ConfigFormat)> {
    let trimmed = content.trim_start();

    if trimmed.starts_with("%HUML") {
        let pipeline = parse_pipeline_huml(content)?;
        Ok((pipeline, ConfigFormat::Huml))
    } else {
        let pipeline = parse_pipeline(content)?;
        Ok((pipeline, ConfigFormat::Yaml))
    }
}

/// Validates that the parsed pipeline meets minimum requirements.
fn validate_pipeline(pipeline: &ParsedPipeline) -> Result<()> {
    if pipeline.workflows.is_empty() {
        return Err(OoreError::PipelineParse(
            "Pipeline must define at least one workflow".to_string(),
        ));
    }

    for (name, workflow) in &pipeline.workflows {
        validate_workflow(name, workflow)?;
    }

    Ok(())
}

/// Validates a single workflow.
fn validate_workflow(name: &str, workflow: &Workflow) -> Result<()> {
    if workflow.scripts.is_empty() {
        return Err(OoreError::PipelineParse(format!(
            "Workflow '{}' must have at least one script",
            name
        )));
    }

    for (i, step) in workflow.scripts.iter().enumerate() {
        if step.script.trim().is_empty() {
            return Err(OoreError::PipelineParse(format!(
                "Workflow '{}' step {} has empty script",
                name,
                i + 1
            )));
        }
    }

    if workflow.max_build_duration == 0 {
        return Err(OoreError::PipelineParse(format!(
            "Workflow '{}' max_build_duration must be > 0",
            name
        )));
    }

    Ok(())
}

/// Logs warnings for unsupported Codemagic fields.
fn warn_unsupported_fields(yaml_content: &str) {
    // Parse as generic YAML to check for unsupported fields
    let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(yaml_content) else {
        return;
    };

    let unsupported_top_level = ["definitions", "includes"];
    let unsupported_workflow_fields = [
        "cache",
        "publishing",
        "groups",
        "instance_type",
        "integrations",
        "labels",
        "working_directory",
    ];

    // Check top-level fields
    if let Some(mapping) = value.as_mapping() {
        for field in unsupported_top_level {
            if mapping.contains_key(field) {
                tracing::warn!(
                    "Unsupported Codemagic field '{}' will be ignored",
                    field
                );
            }
        }

        // Check workflow-level fields
        if let Some(workflows) = mapping.get("workflows").and_then(|v| v.as_mapping()) {
            for (workflow_name, workflow_value) in workflows {
                if let Some(wf_mapping) = workflow_value.as_mapping() {
                    for field in unsupported_workflow_fields {
                        if wf_mapping.contains_key(field) {
                            let name = workflow_name
                                .as_str()
                                .unwrap_or("<unknown>");
                            tracing::warn!(
                                "Unsupported Codemagic field '{}' in workflow '{}' will be ignored",
                                field,
                                name
                            );
                        }
                    }
                }
            }
        }
    }
}

/// Creates a minimal pipeline with a single workflow from a script.
pub fn create_minimal_pipeline(script: &str) -> ParsedPipeline {
    use std::collections::HashMap;

    let workflow = Workflow {
        name: Some("default".to_string()),
        max_build_duration: 60,
        environment: WorkflowEnvironment::default(),
        triggering: None,
        scripts: vec![Step {
            name: Some("Run script".to_string()),
            script: script.to_string(),
            timeout: 900,
            ignore_failure: false,
        }],
        artifacts: vec![],
    };

    let mut workflows = HashMap::new();
    workflows.insert("default".to_string(), workflow);

    ParsedPipeline { workflows }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TriggerEvent;

    #[test]
    fn test_parse_minimal_pipeline() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "Hello"
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        assert!(pipeline.workflows.contains_key("default"));
        assert_eq!(pipeline.workflows["default"].scripts.len(), 1);
    }

    #[test]
    fn test_parse_full_pipeline() {
        let yaml = r#"
workflows:
  ios-build:
    name: iOS Build
    max_build_duration: 30
    environment:
      vars:
        FLUTTER_VERSION: "3.19.0"
    triggering:
      events:
        - push
        - pull_request
      branch_patterns:
        include:
          - main
          - develop
        exclude:
          - "release/*"
    scripts:
      - name: Install dependencies
        script: flutter pub get
      - name: Run tests
        script: flutter test
        timeout: 600
        ignore_failure: true
    artifacts:
      - build/ios/**/*.ipa
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let workflow = &pipeline.workflows["ios-build"];

        assert_eq!(workflow.name, Some("iOS Build".to_string()));
        assert_eq!(workflow.max_build_duration, 30);
        assert_eq!(workflow.environment.vars.get("FLUTTER_VERSION"), Some(&"3.19.0".to_string()));
        assert_eq!(workflow.scripts.len(), 2);
        assert_eq!(workflow.scripts[1].timeout, 600);
        assert!(workflow.scripts[1].ignore_failure);

        let triggering = workflow.triggering.as_ref().unwrap();
        assert_eq!(triggering.events.len(), 2);
        assert!(triggering.events.contains(&TriggerEvent::Push));
    }

    #[test]
    fn test_parse_empty_workflows_fails() {
        let yaml = r#"
workflows: {}
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("at least one workflow"));
    }

    #[test]
    fn test_parse_empty_scripts_fails() {
        let yaml = r#"
workflows:
  default:
    scripts: []
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("at least one script"));
    }

    #[test]
    fn test_parse_empty_script_content_fails() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: ""
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty script"));
    }

    #[test]
    fn test_create_minimal_pipeline() {
        let pipeline = create_minimal_pipeline("flutter build");
        assert!(pipeline.workflows.contains_key("default"));
        assert_eq!(pipeline.workflows["default"].scripts[0].script, "flutter build");
    }

    #[test]
    fn test_parse_multiple_workflows() {
        let yaml = r#"
workflows:
  ios:
    scripts:
      - script: flutter build ios
  android:
    scripts:
      - script: flutter build android
  web:
    scripts:
      - script: flutter build web
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        assert_eq!(pipeline.workflows.len(), 3);
        assert!(pipeline.workflows.contains_key("ios"));
        assert!(pipeline.workflows.contains_key("android"));
        assert!(pipeline.workflows.contains_key("web"));
    }

    #[test]
    fn test_parse_workflow_with_all_trigger_events() {
        let yaml = r#"
workflows:
  ci:
    triggering:
      events:
        - push
        - pull_request
        - tag
    scripts:
      - script: flutter test
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let triggering = pipeline.workflows["ci"].triggering.as_ref().unwrap();
        assert_eq!(triggering.events.len(), 3);
        assert!(triggering.events.contains(&TriggerEvent::Push));
        assert!(triggering.events.contains(&TriggerEvent::PullRequest));
        assert!(triggering.events.contains(&TriggerEvent::Tag));
    }

    #[test]
    fn test_parse_workflow_with_branch_patterns() {
        let yaml = r#"
workflows:
  release:
    triggering:
      branch_patterns:
        include:
          - main
          - "release/*"
          - "hotfix/**"
        exclude:
          - "release/beta-*"
    scripts:
      - script: flutter build --release
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let triggering = pipeline.workflows["release"].triggering.as_ref().unwrap();
        assert_eq!(triggering.branch_patterns.include.len(), 3);
        assert_eq!(triggering.branch_patterns.exclude.len(), 1);
        assert!(triggering.branch_patterns.include.contains(&"main".to_string()));
        assert!(triggering.branch_patterns.include.contains(&"release/*".to_string()));
        assert!(triggering.branch_patterns.exclude.contains(&"release/beta-*".to_string()));
    }

    #[test]
    fn test_parse_step_defaults() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "test"
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let step = &pipeline.workflows["default"].scripts[0];
        // Check default values
        assert_eq!(step.timeout, 900); // Default 15 minutes
        assert!(!step.ignore_failure); // Default false
        assert!(step.name.is_none()); // No name by default
    }

    #[test]
    fn test_parse_step_with_all_options() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - name: Long running test
        script: flutter test --coverage
        timeout: 1800
        ignore_failure: true
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let step = &pipeline.workflows["default"].scripts[0];
        assert_eq!(step.name, Some("Long running test".to_string()));
        assert_eq!(step.timeout, 1800);
        assert!(step.ignore_failure);
    }

    #[test]
    fn test_parse_workflow_defaults() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "test"
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let workflow = &pipeline.workflows["default"];
        assert_eq!(workflow.max_build_duration, 60); // Default 60 minutes
        assert!(workflow.environment.vars.is_empty());
        assert!(workflow.artifacts.is_empty());
        assert!(workflow.triggering.is_none());
    }

    #[test]
    fn test_parse_multiline_script() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - name: Setup
        script: |
          echo "Line 1"
          echo "Line 2"
          flutter pub get
          flutter test
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let script = &pipeline.workflows["default"].scripts[0].script;
        assert!(script.contains("Line 1"));
        assert!(script.contains("Line 2"));
        assert!(script.contains("flutter pub get"));
    }

    #[test]
    fn test_parse_environment_variables() {
        let yaml = r#"
workflows:
  default:
    environment:
      vars:
        FLUTTER_VERSION: "3.19.0"
        JAVA_HOME: /usr/lib/jvm/java-11
        DEBUG: "true"
    scripts:
      - script: echo $FLUTTER_VERSION
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let env = &pipeline.workflows["default"].environment.vars;
        assert_eq!(env.len(), 3);
        assert_eq!(env.get("FLUTTER_VERSION"), Some(&"3.19.0".to_string()));
        assert_eq!(env.get("JAVA_HOME"), Some(&"/usr/lib/jvm/java-11".to_string()));
        assert_eq!(env.get("DEBUG"), Some(&"true".to_string()));
    }

    #[test]
    fn test_parse_artifacts() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: flutter build
    artifacts:
      - build/ios/**/*.ipa
      - build/android/**/*.apk
      - build/macos/**/*.app
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let artifacts = &pipeline.workflows["default"].artifacts;
        assert_eq!(artifacts.len(), 3);
        assert!(artifacts.contains(&"build/ios/**/*.ipa".to_string()));
        assert!(artifacts.contains(&"build/android/**/*.apk".to_string()));
    }

    #[test]
    fn test_parse_invalid_yaml_syntax() {
        let yaml = r#"
workflows:
  default:
    scripts
      - script: echo "test"
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid YAML"));
    }

    #[test]
    fn test_parse_missing_scripts_key() {
        let yaml = r#"
workflows:
  default:
    name: No scripts workflow
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        // This will fail on validation because scripts is required
    }

    #[test]
    fn test_parse_zero_max_build_duration() {
        let yaml = r#"
workflows:
  default:
    max_build_duration: 0
    scripts:
      - script: echo "test"
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("max_build_duration must be > 0"));
    }

    #[test]
    fn test_parse_whitespace_only_script() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: "   "
"#;

        let result = parse_pipeline(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty script"));
    }

    #[test]
    fn test_parse_special_characters_in_script() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "Hello $USER" && ls -la | grep "*.txt"
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        let script = &pipeline.workflows["default"].scripts[0].script;
        assert!(script.contains("$USER"));
        assert!(script.contains("&&"));
        assert!(script.contains("|"));
    }

    #[test]
    fn test_parse_workflow_name_with_special_chars() {
        let yaml = r#"
workflows:
  ios-release-v2:
    scripts:
      - script: echo "test"
  android_debug_build:
    scripts:
      - script: echo "test"
"#;

        let pipeline = parse_pipeline(yaml).unwrap();
        assert!(pipeline.workflows.contains_key("ios-release-v2"));
        assert!(pipeline.workflows.contains_key("android_debug_build"));
    }

    #[test]
    fn test_create_minimal_pipeline_has_correct_defaults() {
        let pipeline = create_minimal_pipeline("flutter build");
        let workflow = &pipeline.workflows["default"];

        assert_eq!(workflow.name, Some("default".to_string()));
        assert_eq!(workflow.max_build_duration, 60);
        assert_eq!(workflow.scripts.len(), 1);
        assert_eq!(workflow.scripts[0].timeout, 900);
        assert!(!workflow.scripts[0].ignore_failure);
        assert!(workflow.environment.vars.is_empty());
        assert!(workflow.artifacts.is_empty());
    }

    // ========== HUML Parsing Tests ==========

    #[test]
    fn test_parse_huml_minimal_pipeline() {
        // HUML uses 2-space indentation and `- ::` for arrays of objects
        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts::
      - ::
        script: \"echo Hello\"
";

        let pipeline = parse_pipeline_huml(huml).unwrap();
        assert!(pipeline.workflows.contains_key("default"));
        assert_eq!(pipeline.workflows["default"].scripts.len(), 1);
        assert_eq!(
            pipeline.workflows["default"].scripts[0].script,
            "echo Hello"
        );
    }

    #[test]
    fn test_parse_huml_full_pipeline() {
        let huml = "%HUML v0.2.0
workflows::
  ios-build::
    name: \"iOS Build\"
    max_build_duration: 30
    environment::
      vars::
        FLUTTER_VERSION: \"3.19.0\"
    triggering::
      events:: \"push\", \"pull_request\"
      branch_patterns::
        include:: \"main\", \"develop\"
        exclude:: \"release/*\"
    scripts::
      - ::
        name: \"Install dependencies\"
        script: \"flutter pub get\"
      - ::
        name: \"Run tests\"
        script: \"flutter test\"
        timeout: 600
        ignore_failure: true
    artifacts:: \"build/ios/**/*.ipa\"
";

        let pipeline = parse_pipeline_huml(huml).unwrap();
        let workflow = &pipeline.workflows["ios-build"];

        assert_eq!(workflow.name, Some("iOS Build".to_string()));
        assert_eq!(workflow.max_build_duration, 30);
        assert_eq!(
            workflow.environment.vars.get("FLUTTER_VERSION"),
            Some(&"3.19.0".to_string())
        );
        assert_eq!(workflow.scripts.len(), 2);
        assert_eq!(workflow.scripts[1].timeout, 600);
        assert!(workflow.scripts[1].ignore_failure);

        let triggering = workflow.triggering.as_ref().unwrap();
        assert_eq!(triggering.events.len(), 2);
        assert!(triggering.events.contains(&TriggerEvent::Push));
        assert_eq!(triggering.branch_patterns.include.len(), 2);
        assert_eq!(triggering.branch_patterns.exclude.len(), 1);
    }

    #[test]
    fn test_parse_huml_empty_workflows_fails() {
        let huml = "%HUML v0.2.0
workflows::
";

        let result = parse_pipeline_huml(huml);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_huml_empty_scripts_fails() {
        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts::
";

        let result = parse_pipeline_huml(huml);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_huml_invalid_syntax() {
        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts invalid syntax here
";

        let result = parse_pipeline_huml(huml);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid HUML"));
    }

    #[test]
    fn test_parse_huml_multiple_workflows() {
        let huml = "%HUML v0.2.0
workflows::
  ios::
    scripts::
      - ::
        script: \"flutter build ios\"
  android::
    scripts::
      - ::
        script: \"flutter build android\"
  web::
    scripts::
      - ::
        script: \"flutter build web\"
";

        let pipeline = parse_pipeline_huml(huml).unwrap();
        assert_eq!(pipeline.workflows.len(), 3);
        assert!(pipeline.workflows.contains_key("ios"));
        assert!(pipeline.workflows.contains_key("android"));
        assert!(pipeline.workflows.contains_key("web"));
    }

    // ========== Auto-detection Tests ==========

    #[test]
    fn test_parse_auto_detects_huml() {
        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts::
      - ::
        script: \"echo test\"
";

        let (pipeline, format) = parse_pipeline_auto(huml).unwrap();
        assert_eq!(format, ConfigFormat::Huml);
        assert!(pipeline.workflows.contains_key("default"));
    }

    #[test]
    fn test_parse_auto_detects_yaml() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo test
"#;

        let (pipeline, format) = parse_pipeline_auto(yaml).unwrap();
        assert_eq!(format, ConfigFormat::Yaml);
        assert!(pipeline.workflows.contains_key("default"));
    }

    #[test]
    fn test_parse_auto_detects_huml_with_leading_whitespace() {
        let huml = "  %HUML v0.2.0
workflows::
  default::
    scripts::
      - ::
        script: \"echo test\"
";

        let (_, format) = parse_pipeline_auto(huml).unwrap();
        assert_eq!(format, ConfigFormat::Huml);
    }

    #[test]
    fn test_parse_auto_yaml_without_huml_header() {
        // YAML that happens to contain %HUML in content (not at start)
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "This mentions %HUML somewhere"
"#;

        let (_, format) = parse_pipeline_auto(yaml).unwrap();
        assert_eq!(format, ConfigFormat::Yaml);
    }

    // ========== ConfigFormat Tests ==========

    #[test]
    fn test_config_format_equality() {
        assert_eq!(ConfigFormat::Yaml, ConfigFormat::Yaml);
        assert_eq!(ConfigFormat::Huml, ConfigFormat::Huml);
        assert_ne!(ConfigFormat::Yaml, ConfigFormat::Huml);
    }

    #[test]
    fn test_config_format_clone() {
        let format = ConfigFormat::Huml;
        let cloned = format;
        assert_eq!(format, cloned);
    }

    #[test]
    fn test_config_format_debug() {
        let format = ConfigFormat::Yaml;
        let debug_str = format!("{:?}", format);
        assert_eq!(debug_str, "Yaml");

        let format = ConfigFormat::Huml;
        let debug_str = format!("{:?}", format);
        assert_eq!(debug_str, "Huml");
    }

    // ========== HUML-YAML Equivalence Tests ==========

    #[test]
    fn test_huml_yaml_equivalence_simple() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo test
"#;

        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts::
      - ::
        script: \"echo test\"
";

        let yaml_pipeline = parse_pipeline(yaml).unwrap();
        let huml_pipeline = parse_pipeline_huml(huml).unwrap();

        assert_eq!(yaml_pipeline.workflows.len(), huml_pipeline.workflows.len());
        assert_eq!(
            yaml_pipeline.workflows["default"].scripts[0].script,
            huml_pipeline.workflows["default"].scripts[0].script
        );
    }

    #[test]
    fn test_huml_yaml_equivalence_with_environment() {
        let yaml = r#"
workflows:
  build:
    environment:
      vars:
        DEBUG: "true"
        VERSION: "1.0"
    scripts:
      - script: echo $DEBUG
"#;

        let huml = "%HUML v0.2.0
workflows::
  build::
    environment::
      vars::
        DEBUG: \"true\"
        VERSION: \"1.0\"
    scripts::
      - ::
        script: \"echo $DEBUG\"
";

        let yaml_pipeline = parse_pipeline(yaml).unwrap();
        let huml_pipeline = parse_pipeline_huml(huml).unwrap();

        let yaml_env = &yaml_pipeline.workflows["build"].environment.vars;
        let huml_env = &huml_pipeline.workflows["build"].environment.vars;

        assert_eq!(yaml_env.get("DEBUG"), huml_env.get("DEBUG"));
        assert_eq!(yaml_env.get("VERSION"), huml_env.get("VERSION"));
    }

    #[test]
    fn test_huml_with_step_options() {
        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts::
      - ::
        name: \"Long test\"
        script: \"flutter test --coverage\"
        timeout: 1800
        ignore_failure: true
";

        let pipeline = parse_pipeline_huml(huml).unwrap();
        let step = &pipeline.workflows["default"].scripts[0];

        assert_eq!(step.name, Some("Long test".to_string()));
        assert_eq!(step.timeout, 1800);
        assert!(step.ignore_failure);
    }

    #[test]
    fn test_huml_workflow_defaults() {
        let huml = "%HUML v0.2.0
workflows::
  default::
    scripts::
      - ::
        script: \"echo test\"
";

        let pipeline = parse_pipeline_huml(huml).unwrap();
        let workflow = &pipeline.workflows["default"];

        assert_eq!(workflow.max_build_duration, 60); // default
        assert!(workflow.environment.vars.is_empty());
        assert!(workflow.artifacts.is_empty());
        assert!(workflow.triggering.is_none());
    }

    #[test]
    fn test_huml_with_artifacts() {
        let huml = "%HUML v0.2.0
workflows::
  build::
    scripts::
      - ::
        script: \"flutter build\"
    artifacts:: \"build/ios/**/*.ipa\", \"build/android/**/*.apk\"
";

        let pipeline = parse_pipeline_huml(huml).unwrap();
        let artifacts = &pipeline.workflows["build"].artifacts;

        assert_eq!(artifacts.len(), 2);
        assert!(artifacts.contains(&"build/ios/**/*.ipa".to_string()));
        assert!(artifacts.contains(&"build/android/**/*.apk".to_string()));
    }
}
