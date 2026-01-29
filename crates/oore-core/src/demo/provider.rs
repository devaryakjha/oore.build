//! Demo mode provider that returns fake data.

use std::sync::Arc;

use crate::error::Result;
use crate::models::{
    Build, BuildId, BuildStep, PipelineConfig, PipelineConfigId, Repository, RepositoryId,
    StoredConfigFormat,
};
use crate::oauth::github::GitHubAppStatus;
use crate::oauth::gitlab::GitLabCredentialsStatus;

use super::data::{
    generate_demo_build_steps, generate_demo_builds, generate_demo_github_status,
    generate_demo_gitlab_statuses, generate_demo_installations, generate_demo_log_content,
    generate_demo_repositories, get_demo_pipeline_config, DemoInstallationInfo,
};

/// Scenario for demo mode (for future error simulation).
#[derive(Debug, Clone, Default)]
pub enum DemoScenario {
    /// Normal operation with all systems working.
    #[default]
    Normal,
    /// Simulate GitHub API errors.
    GitHubError,
    /// Simulate GitLab API errors.
    GitLabError,
    /// Simulate build failures.
    BuildFailures,
}

impl DemoScenario {
    /// Creates a scenario from environment variable.
    pub fn from_env() -> Self {
        match std::env::var("OORE_DEMO_SCENARIO").as_deref() {
            Ok("github_error") => Self::GitHubError,
            Ok("gitlab_error") => Self::GitLabError,
            Ok("build_failures") => Self::BuildFailures,
            _ => Self::Normal,
        }
    }
}

/// Provider for demo mode that returns fake data.
#[derive(Debug, Clone)]
pub struct DemoProvider {
    scenario: DemoScenario,
    repositories: Arc<Vec<Repository>>,
    builds: Arc<Vec<Build>>,
}

impl Default for DemoProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl DemoProvider {
    /// Creates a new demo provider with default scenario.
    pub fn new() -> Self {
        let repositories = generate_demo_repositories();
        let builds = generate_demo_builds(&repositories);

        Self {
            scenario: DemoScenario::Normal,
            repositories: Arc::new(repositories),
            builds: Arc::new(builds),
        }
    }

    /// Creates a demo provider from environment configuration.
    pub fn from_env() -> Self {
        let scenario = DemoScenario::from_env();
        let repositories = generate_demo_repositories();
        let builds = generate_demo_builds(&repositories);

        Self {
            scenario,
            repositories: Arc::new(repositories),
            builds: Arc::new(builds),
        }
    }

    /// Checks if demo mode is enabled via environment variable.
    pub fn is_enabled() -> bool {
        std::env::var("OORE_DEMO_MODE")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false)
    }

    /// Gets the GitHub App status (always configured in demo mode).
    pub fn get_github_status(&self) -> GitHubAppStatus {
        match self.scenario {
            DemoScenario::GitHubError => GitHubAppStatus::not_configured(),
            _ => generate_demo_github_status(),
        }
    }

    /// Gets the GitLab credentials statuses (always connected in demo mode).
    pub fn get_gitlab_statuses(&self) -> Vec<GitLabCredentialsStatus> {
        match self.scenario {
            DemoScenario::GitLabError => vec![],
            _ => generate_demo_gitlab_statuses(),
        }
    }

    /// Gets the GitHub installations (for demo mode).
    pub fn get_github_installations(&self) -> Vec<DemoInstallationInfo> {
        match self.scenario {
            DemoScenario::GitHubError => vec![],
            _ => generate_demo_installations(),
        }
    }

    /// Lists all demo repositories.
    pub fn list_repositories(&self) -> Result<Vec<Repository>> {
        Ok(self.repositories.as_ref().clone())
    }

    /// Gets a single repository by ID.
    pub fn get_repository(&self, id: &RepositoryId) -> Result<Option<Repository>> {
        Ok(self.repositories.iter().find(|r| &r.id == id).cloned())
    }

    /// Gets a repository by index (for predictable demo data).
    pub fn get_repository_by_index(&self, index: usize) -> Option<&Repository> {
        self.repositories.get(index)
    }

    /// Lists builds, optionally filtered by repository.
    pub fn list_builds(&self, repo_id: Option<&RepositoryId>) -> Result<Vec<Build>> {
        let builds = match repo_id {
            Some(id) => self
                .builds
                .iter()
                .filter(|b| &b.repository_id == id)
                .cloned()
                .collect(),
            None => self.builds.as_ref().clone(),
        };
        Ok(builds)
    }

    /// Gets a single build by ID.
    pub fn get_build(&self, id: &BuildId) -> Result<Option<Build>> {
        Ok(self.builds.iter().find(|b| &b.id == id).cloned())
    }

    /// Lists build steps for a build.
    pub fn list_build_steps(&self, build_id: &BuildId) -> Result<Vec<BuildStep>> {
        if let Some(build) = self.builds.iter().find(|b| &b.id == build_id) {
            Ok(generate_demo_build_steps(build))
        } else {
            Ok(vec![])
        }
    }

    /// Gets log content for a build step.
    pub fn get_build_log_content(
        &self,
        build_id: &BuildId,
        step_index: i32,
    ) -> Result<Option<(String, String)>> {
        if let Some(build) = self.builds.iter().find(|b| &b.id == build_id) {
            let steps = generate_demo_build_steps(build);
            if let Some(step) = steps.get(step_index as usize) {
                let (stdout, stderr) = generate_demo_log_content(&step.name, &step.status);
                return Ok(Some((stdout, stderr)));
            }
        }
        Ok(None)
    }

    /// Gets pipeline config for a repository.
    pub fn get_pipeline_config(&self, repo_id: &RepositoryId) -> Result<Option<PipelineConfig>> {
        // Find the repository index to determine which config to use
        if let Some(idx) = self.repositories.iter().position(|r| &r.id == repo_id) {
            if let Some((content, format)) = get_demo_pipeline_config(idx) {
                let repo = &self.repositories[idx];
                let stored_format = match format {
                    crate::pipeline::ConfigFormat::Yaml => StoredConfigFormat::Yaml,
                    crate::pipeline::ConfigFormat::Huml => StoredConfigFormat::Huml,
                };
                return Ok(Some(PipelineConfig {
                    id: PipelineConfigId::new(),
                    repository_id: repo_id.clone(),
                    name: match stored_format {
                        StoredConfigFormat::Yaml => "Flutter CI".to_string(),
                        StoredConfigFormat::Huml => "iOS Release".to_string(),
                    },
                    config_content: content,
                    config_format: stored_format,
                    is_active: true,
                    created_at: repo.created_at,
                    updated_at: repo.updated_at,
                }));
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_demo_provider_new() {
        let provider = DemoProvider::new();
        assert!(!provider.repositories.is_empty());
        assert!(!provider.builds.is_empty());
    }

    #[test]
    fn test_list_repositories() {
        let provider = DemoProvider::new();
        let repos = provider.list_repositories().unwrap();
        assert!(!repos.is_empty());
    }

    #[test]
    fn test_get_repository() {
        let provider = DemoProvider::new();
        let repos = provider.list_repositories().unwrap();
        let first_id = &repos[0].id;

        let repo = provider.get_repository(first_id).unwrap();
        assert!(repo.is_some());
        assert_eq!(&repo.unwrap().id, first_id);
    }

    #[test]
    fn test_list_builds() {
        let provider = DemoProvider::new();
        let builds = provider.list_builds(None).unwrap();
        assert!(!builds.is_empty());
    }

    #[test]
    fn test_list_builds_by_repo() {
        let provider = DemoProvider::new();
        let repos = provider.list_repositories().unwrap();
        let repo_id = &repos[0].id;

        let builds = provider.list_builds(Some(repo_id)).unwrap();
        assert!(builds.iter().all(|b| &b.repository_id == repo_id));
    }

    #[test]
    fn test_list_build_steps() {
        let provider = DemoProvider::new();
        let builds = provider.list_builds(None).unwrap();
        let build_id = &builds[0].id;

        let steps = provider.list_build_steps(build_id).unwrap();
        assert!(!steps.is_empty());
    }

    #[test]
    fn test_get_build_log_content() {
        let provider = DemoProvider::new();
        let builds = provider.list_builds(None).unwrap();
        let build_id = &builds[0].id;

        let content = provider.get_build_log_content(build_id, 0).unwrap();
        assert!(content.is_some());

        let (stdout, _stderr) = content.unwrap();
        assert!(!stdout.is_empty());
    }

    #[test]
    fn test_github_status_configured() {
        let provider = DemoProvider::new();
        let status = provider.get_github_status();
        assert!(status.configured);
    }

    #[test]
    fn test_gitlab_statuses_configured() {
        let provider = DemoProvider::new();
        let statuses = provider.get_gitlab_statuses();
        assert!(!statuses.is_empty());
        assert!(statuses.iter().all(|s| s.configured));
    }

    #[test]
    fn test_pipeline_config() {
        let provider = DemoProvider::new();
        let repos = provider.list_repositories().unwrap();

        // First repo should have YAML config
        let config = provider.get_pipeline_config(&repos[0].id).unwrap();
        assert!(config.is_some());
        assert_eq!(config.unwrap().config_format, StoredConfigFormat::Yaml);

        // Second repo should have HUML config
        let config = provider.get_pipeline_config(&repos[1].id).unwrap();
        assert!(config.is_some());
        assert_eq!(config.unwrap().config_format, StoredConfigFormat::Huml);
    }
}
