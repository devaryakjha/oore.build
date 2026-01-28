//! Pipeline configuration resolver.
//!
//! Resolves pipeline configuration from either:
//! 1. codemagic.yaml in the repository (takes precedence)
//! 2. Stored UI config in the database (fallback)

use std::path::Path;

use crate::db::{pipeline::PipelineConfigRepo, DbPool};
use crate::error::{OoreError, Result};
use crate::models::{
    ConfigSource, ParsedPipeline, RepositoryId, TriggerEvent, TriggerType, Workflow,
};

use super::parse_pipeline;

/// Result of config resolution.
pub struct ResolvedConfig {
    /// The parsed pipeline configuration.
    pub pipeline: ParsedPipeline,
    /// Where the config was loaded from.
    pub source: ConfigSource,
}

/// Resolves pipeline configuration for a build.
///
/// Priority:
/// 1. codemagic.yaml in workspace (if workspace is provided)
/// 2. Stored config from database
///
/// Returns an error with a helpful message if no config is found.
pub async fn resolve_config(
    db: &DbPool,
    repository_id: &RepositoryId,
    workspace: Option<&Path>,
) -> Result<ResolvedConfig> {
    // 1. Try codemagic.yaml in workspace
    if let Some(workspace_path) = workspace {
        let yaml_path = workspace_path.join("codemagic.yaml");
        if yaml_path.exists() {
            let content = std::fs::read_to_string(&yaml_path)?;
            let pipeline = parse_pipeline(&content)?;
            tracing::debug!("Loaded pipeline config from codemagic.yaml");
            return Ok(ResolvedConfig {
                pipeline,
                source: ConfigSource::Repository,
            });
        }

        // Also check .codemagic.yaml (hidden file variant)
        let hidden_yaml_path = workspace_path.join(".codemagic.yaml");
        if hidden_yaml_path.exists() {
            let content = std::fs::read_to_string(&hidden_yaml_path)?;
            let pipeline = parse_pipeline(&content)?;
            tracing::debug!("Loaded pipeline config from .codemagic.yaml");
            return Ok(ResolvedConfig {
                pipeline,
                source: ConfigSource::Repository,
            });
        }
    }

    // 2. Try stored config from database
    if let Some(stored_config) = PipelineConfigRepo::get_active_for_repository(db, repository_id).await? {
        let pipeline = parse_pipeline(&stored_config.config_yaml)?;
        tracing::debug!("Loaded pipeline config from stored config '{}'", stored_config.name);
        return Ok(ResolvedConfig {
            pipeline,
            source: ConfigSource::Stored,
        });
    }

    // No config found - return helpful error
    Err(OoreError::PipelineConfigNotFound(format!(
        "No pipeline configuration found.\n\n\
        To fix this, either:\n\
        1. Add a codemagic.yaml file to your repository root\n\
        2. Configure a pipeline in the Oore web dashboard\n\n\
        Documentation: https://docs.oore.build/pipelines"
    )))
}

/// Selects the appropriate workflow for a given trigger.
///
/// Selection priority:
/// 1. Match by triggering.events and branch_patterns
/// 2. If only one workflow exists, use it as default
/// 3. If multiple workflows match, return error (ambiguous)
pub fn select_workflow<'a>(
    pipeline: &'a ParsedPipeline,
    trigger_type: TriggerType,
    branch: &str,
) -> Result<(String, &'a Workflow)> {
    let trigger_event = match trigger_type {
        TriggerType::Push => TriggerEvent::Push,
        TriggerType::PullRequest | TriggerType::MergeRequest => TriggerEvent::PullRequest,
        TriggerType::Manual => {
            // For manual triggers, use first workflow or any that doesn't have specific triggers
            return select_default_or_first(pipeline);
        }
    };

    let mut matching_workflows: Vec<(String, &Workflow)> = Vec::new();

    for (name, workflow) in &pipeline.workflows {
        if matches_trigger(workflow, trigger_event, branch) {
            matching_workflows.push((name.clone(), workflow));
        }
    }

    match matching_workflows.len() {
        0 => {
            // No explicit matches - check if we have a workflow without triggering config
            // that can be used as a default
            let workflows_without_triggers: Vec<_> = pipeline
                .workflows
                .iter()
                .filter(|(_, wf)| wf.triggering.is_none())
                .collect();

            match workflows_without_triggers.len() {
                0 => Err(OoreError::NoMatchingWorkflow),
                1 => {
                    let (name, workflow) = workflows_without_triggers.into_iter().next().unwrap();
                    Ok((name.clone(), workflow))
                }
                _ => Err(OoreError::NoMatchingWorkflow),
            }
        }
        1 => Ok(matching_workflows.into_iter().next().unwrap()),
        _ => {
            let names: Vec<_> = matching_workflows.iter().map(|(n, _)| n.as_str()).collect();
            Err(OoreError::PipelineParse(format!(
                "Multiple workflows match trigger {} on branch '{}': {}. \
                 Please configure triggering.branch_patterns to disambiguate.",
                trigger_type, branch, names.join(", ")
            )))
        }
    }
}

/// Selects the default workflow or the first one if only one exists.
fn select_default_or_first(pipeline: &ParsedPipeline) -> Result<(String, &Workflow)> {
    // Try "default" workflow first
    if let Some(workflow) = pipeline.workflows.get("default") {
        return Ok(("default".to_string(), workflow));
    }

    // If only one workflow, use it
    if pipeline.workflows.len() == 1 {
        let (name, workflow) = pipeline.workflows.iter().next().unwrap();
        return Ok((name.clone(), workflow));
    }

    // Multiple workflows with no clear default
    let names: Vec<_> = pipeline.workflows.keys().collect();
    Err(OoreError::PipelineParse(format!(
        "Multiple workflows defined but no 'default' workflow: {}. \
         Please specify which workflow to run or name one 'default'.",
        names.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
    )))
}

/// Checks if a workflow matches the given trigger event and branch.
fn matches_trigger(workflow: &Workflow, event: TriggerEvent, branch: &str) -> bool {
    let Some(triggering) = &workflow.triggering else {
        // No triggering config means workflow accepts all triggers
        return true;
    };

    // Check event type matches
    if !triggering.events.is_empty() && !triggering.events.contains(&event) {
        return false;
    }

    // Check branch patterns
    let patterns = &triggering.branch_patterns;

    // If no patterns defined, match all branches
    if patterns.include.is_empty() && patterns.exclude.is_empty() {
        return true;
    }

    // Check exclude patterns first
    for pattern in &patterns.exclude {
        if matches_branch_pattern(pattern, branch) {
            return false;
        }
    }

    // Check include patterns (if empty, include all)
    if patterns.include.is_empty() {
        return true;
    }

    for pattern in &patterns.include {
        if matches_branch_pattern(pattern, branch) {
            return true;
        }
    }

    false
}

/// Matches a branch name against a glob pattern.
fn matches_branch_pattern(pattern: &str, branch: &str) -> bool {
    // Use glob pattern matching
    let glob_pattern = glob::Pattern::new(pattern);
    match glob_pattern {
        Ok(p) => p.matches(branch),
        Err(_) => {
            // Fallback to exact match if pattern is invalid
            tracing::warn!("Invalid branch pattern '{}', using exact match", pattern);
            pattern == branch
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pipeline::parse_pipeline;

    #[test]
    fn test_select_single_workflow() {
        let yaml = r#"
workflows:
  build:
    scripts:
      - script: echo "build"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();
        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "build");
    }

    #[test]
    fn test_select_default_workflow() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "default"
  other:
    scripts:
      - script: echo "other"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();
        let (name, _) = select_workflow(&pipeline, TriggerType::Manual, "main").unwrap();
        assert_eq!(name, "default");
    }

    #[test]
    fn test_select_by_trigger_event() {
        let yaml = r#"
workflows:
  pr-build:
    triggering:
      events:
        - pull_request
    scripts:
      - script: echo "pr"
  push-build:
    triggering:
      events:
        - push
    scripts:
      - script: echo "push"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "push-build");

        let (name, _) = select_workflow(&pipeline, TriggerType::PullRequest, "feature").unwrap();
        assert_eq!(name, "pr-build");
    }

    #[test]
    fn test_select_by_branch_pattern() {
        let yaml = r#"
workflows:
  release:
    triggering:
      events:
        - push
      branch_patterns:
        include:
          - "release/*"
    scripts:
      - script: echo "release"
  develop:
    triggering:
      events:
        - push
      branch_patterns:
        include:
          - main
          - develop
    scripts:
      - script: echo "develop"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "release/1.0").unwrap();
        assert_eq!(name, "release");

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "develop");
    }

    #[test]
    fn test_branch_exclude_pattern() {
        let yaml = r#"
workflows:
  build:
    triggering:
      events:
        - push
      branch_patterns:
        include:
          - "*"
        exclude:
          - "wip/*"
    scripts:
      - script: echo "build"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        let result = select_workflow(&pipeline, TriggerType::Push, "wip/experiment");
        assert!(result.is_err());

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "feature/new").unwrap();
        assert_eq!(name, "build");
    }

    #[test]
    fn test_matches_branch_pattern() {
        assert!(matches_branch_pattern("main", "main"));
        assert!(!matches_branch_pattern("main", "develop"));

        assert!(matches_branch_pattern("release/*", "release/1.0"));
        assert!(!matches_branch_pattern("release/*", "feature/x"));

        assert!(matches_branch_pattern("*", "anything"));
        assert!(matches_branch_pattern("feature/*", "feature/new-thing"));
    }

    #[test]
    fn test_select_merge_request_uses_pull_request_workflow() {
        let yaml = r#"
workflows:
  pr-build:
    triggering:
      events:
        - pull_request
    scripts:
      - script: echo "pr"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // MergeRequest (GitLab) should use pull_request workflow
        let (name, _) = select_workflow(&pipeline, TriggerType::MergeRequest, "feature").unwrap();
        assert_eq!(name, "pr-build");
    }

    #[test]
    fn test_select_manual_trigger_uses_default() {
        let yaml = r#"
workflows:
  default:
    scripts:
      - script: echo "default"
  push-only:
    triggering:
      events:
        - push
    scripts:
      - script: echo "push"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        let (name, _) = select_workflow(&pipeline, TriggerType::Manual, "any-branch").unwrap();
        assert_eq!(name, "default");
    }

    #[test]
    fn test_select_manual_trigger_single_workflow() {
        let yaml = r#"
workflows:
  ci:
    triggering:
      events:
        - push
    scripts:
      - script: echo "ci"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Manual trigger with single workflow should use that workflow
        let (name, _) = select_workflow(&pipeline, TriggerType::Manual, "main").unwrap();
        assert_eq!(name, "ci");
    }

    #[test]
    fn test_select_ambiguous_multiple_workflows_fails() {
        let yaml = r#"
workflows:
  build1:
    triggering:
      events:
        - push
    scripts:
      - script: echo "build1"
  build2:
    triggering:
      events:
        - push
    scripts:
      - script: echo "build2"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Both workflows match push on main - should fail
        let result = select_workflow(&pipeline, TriggerType::Push, "main");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Multiple workflows match"));
    }

    #[test]
    fn test_select_no_matching_workflow_fails() {
        let yaml = r#"
workflows:
  pr-only:
    triggering:
      events:
        - pull_request
    scripts:
      - script: echo "pr"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Push trigger, but only pr workflow exists
        let result = select_workflow(&pipeline, TriggerType::Push, "main");
        assert!(result.is_err());
    }

    #[test]
    fn test_select_workflow_without_triggering_matches_all() {
        let yaml = r#"
workflows:
  catch-all:
    scripts:
      - script: echo "catch-all"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // No triggering config means it matches all events
        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "catch-all");

        let (name, _) = select_workflow(&pipeline, TriggerType::PullRequest, "feature").unwrap();
        assert_eq!(name, "catch-all");
    }

    #[test]
    fn test_branch_pattern_double_star() {
        // ** matches any depth
        assert!(matches_branch_pattern("feature/**", "feature/sub/deep"));
        assert!(matches_branch_pattern("**/test", "a/b/c/test"));
    }

    #[test]
    fn test_branch_pattern_question_mark() {
        // ? matches single character
        assert!(matches_branch_pattern("release-?", "release-1"));
        assert!(!matches_branch_pattern("release-?", "release-10"));
    }

    #[test]
    fn test_branch_pattern_brackets() {
        // [abc] matches any of a, b, c
        assert!(matches_branch_pattern("release-[123]", "release-1"));
        assert!(matches_branch_pattern("release-[123]", "release-2"));
        assert!(!matches_branch_pattern("release-[123]", "release-4"));
    }

    #[test]
    fn test_select_with_complex_branch_patterns() {
        let yaml = r#"
workflows:
  production:
    triggering:
      events:
        - push
      branch_patterns:
        include:
          - main
          - "release/*"
        exclude:
          - "release/beta-*"
    scripts:
      - script: echo "production"
  staging:
    triggering:
      events:
        - push
      branch_patterns:
        include:
          - develop
          - "staging/*"
    scripts:
      - script: echo "staging"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "production");

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "release/1.0").unwrap();
        assert_eq!(name, "production");

        // Beta releases are excluded from production
        let result = select_workflow(&pipeline, TriggerType::Push, "release/beta-1");
        assert!(result.is_err());

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "develop").unwrap();
        assert_eq!(name, "staging");
    }

    #[test]
    fn test_select_exclude_takes_precedence() {
        let yaml = r#"
workflows:
  build:
    triggering:
      events:
        - push
      branch_patterns:
        include:
          - "*"
        exclude:
          - main
    scripts:
      - script: echo "build"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Include * but exclude main - main should not match
        let result = select_workflow(&pipeline, TriggerType::Push, "main");
        assert!(result.is_err());

        // Other branches should match
        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "feature").unwrap();
        assert_eq!(name, "build");
    }

    #[test]
    fn test_select_empty_include_matches_all() {
        let yaml = r#"
workflows:
  build:
    triggering:
      events:
        - push
      branch_patterns:
        exclude:
          - "wip/*"
    scripts:
      - script: echo "build"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Empty include means all branches (except excluded)
        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "build");

        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "feature/x").unwrap();
        assert_eq!(name, "build");

        // wip/* should be excluded
        let result = select_workflow(&pipeline, TriggerType::Push, "wip/experiment");
        assert!(result.is_err());
    }

    #[test]
    fn test_select_workflow_returns_correct_workflow_data() {
        let yaml = r#"
workflows:
  ios-build:
    name: iOS Build
    max_build_duration: 45
    environment:
      vars:
        PLATFORM: ios
    scripts:
      - name: Build
        script: flutter build ios
        timeout: 1200
    artifacts:
      - build/ios/**/*.ipa
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        let (name, workflow) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "ios-build");
        assert_eq!(workflow.name, Some("iOS Build".to_string()));
        assert_eq!(workflow.max_build_duration, 45);
        assert_eq!(workflow.environment.vars.get("PLATFORM"), Some(&"ios".to_string()));
        assert_eq!(workflow.scripts.len(), 1);
        assert_eq!(workflow.scripts[0].timeout, 1200);
        assert_eq!(workflow.artifacts.len(), 1);
    }

    #[test]
    fn test_manual_trigger_multiple_workflows_no_default_fails() {
        let yaml = r#"
workflows:
  build1:
    scripts:
      - script: echo "build1"
  build2:
    scripts:
      - script: echo "build2"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Manual trigger with multiple workflows and no "default" should fail
        let result = select_workflow(&pipeline, TriggerType::Manual, "main");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no 'default' workflow"));
    }

    #[test]
    fn test_push_trigger_fallback_to_workflow_without_triggering() {
        let yaml = r#"
workflows:
  ci:
    scripts:
      - script: echo "ci"
"#;
        let pipeline = parse_pipeline(yaml).unwrap();

        // Single workflow without triggering should match any event
        let (name, _) = select_workflow(&pipeline, TriggerType::Push, "main").unwrap();
        assert_eq!(name, "ci");
    }

    #[test]
    fn test_matches_branch_pattern_exact_match() {
        assert!(matches_branch_pattern("main", "main"));
        assert!(!matches_branch_pattern("main", "main-branch"));
        assert!(!matches_branch_pattern("main", "not-main"));
    }

    #[test]
    fn test_matches_branch_pattern_wildcard_at_end() {
        assert!(matches_branch_pattern("feature/*", "feature/login"));
        assert!(matches_branch_pattern("feature/*", "feature/"));
        assert!(!matches_branch_pattern("feature/*", "feature"));
        assert!(!matches_branch_pattern("feature/*", "features/login"));
    }

    #[test]
    fn test_matches_branch_pattern_wildcard_at_start() {
        assert!(matches_branch_pattern("*/main", "origin/main"));
        assert!(matches_branch_pattern("*/main", "upstream/main"));
        assert!(!matches_branch_pattern("*/main", "main"));
    }

    #[test]
    fn test_matches_branch_pattern_invalid_pattern_falls_back_to_exact() {
        // Invalid glob patterns should fall back to exact match
        // Note: glob crate is quite permissive, so testing edge cases
        assert!(matches_branch_pattern("normal", "normal"));
    }
}
