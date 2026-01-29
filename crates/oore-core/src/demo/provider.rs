//! Demo mode data provider.

use std::sync::Arc;

use crate::error::Result;
use crate::models::{
    Build, BuildId, BuildStep, Repository, RepositoryId,
};
use crate::oauth::github::GitHubAppStatus;
use crate::oauth::gitlab::GitLabCredentialsStatus;

use super::data::{
    generate_demo_build_steps, generate_demo_builds, generate_demo_github_status,
    generate_demo_gitlab_statuses, generate_demo_log_content, generate_demo_repositories,
};

/// Demo mode scenario for simulating different states.
#[derive(Debug, Clone, Copy, Default)]
pub enum DemoScenario {
    /// All operations succeed with realistic data.
    #[default]
    Success,
    // Future scenarios can be added here:
    // SlowNetwork,
    // DatabaseError,
    // BuildFailures,
}

/// Demo data provider that returns mock data.
#[derive(Clone)]
pub struct DemoProvider {
    scenario: DemoScenario,
    repositories: Arc<Vec<Repository>>,
    builds: Arc<Vec<Build>>,
}

impl DemoProvider {
    /// Creates a new demo provider with the default scenario.
    pub fn new() -> Self {
        Self::with_scenario(DemoScenario::default())
    }

    /// Creates a new demo provider with the given scenario.
    pub fn with_scenario(scenario: DemoScenario) -> Self {
        let repositories = generate_demo_repositories();
        let builds = generate_demo_builds(&repositories);

        Self {
            scenario,
            repositories: Arc::new(repositories),
            builds: Arc::new(builds),
        }
    }

    /// Creates a demo provider from environment variables.
    pub fn from_env() -> Self {
        let scenario = std::env::var("OORE_DEMO_SCENARIO")
            .ok()
            .and_then(|s| match s.to_lowercase().as_str() {
                "success" => Some(DemoScenario::Success),
                _ => None,
            })
            .unwrap_or_default();

        Self::with_scenario(scenario)
    }

    /// Returns the current scenario.
    pub fn scenario(&self) -> DemoScenario {
        self.scenario
    }

    // --- Setup Status ---

    /// Returns demo GitHub App status.
    pub fn get_github_status(&self) -> GitHubAppStatus {
        generate_demo_github_status()
    }

    /// Returns demo GitLab credentials statuses.
    pub fn get_gitlab_statuses(&self) -> Vec<GitLabCredentialsStatus> {
        generate_demo_gitlab_statuses()
    }

    // --- Repositories ---

    /// Lists all demo repositories.
    pub fn list_repositories(&self) -> Result<Vec<Repository>> {
        Ok(self.repositories.as_ref().clone())
    }

    /// Gets a repository by ID.
    pub fn get_repository(&self, id: &RepositoryId) -> Result<Option<Repository>> {
        Ok(self.repositories.iter().find(|r| r.id == *id).cloned())
    }

    /// Gets a repository by ID string.
    pub fn get_repository_by_string(&self, id: &str) -> Result<Option<Repository>> {
        let repo_id = RepositoryId::from_string(id)?;
        self.get_repository(&repo_id)
    }

    // --- Builds ---

    /// Lists all demo builds, optionally filtered by repository.
    pub fn list_builds(&self, repo_id: Option<&RepositoryId>) -> Result<Vec<Build>> {
        let builds = match repo_id {
            Some(id) => self
                .builds
                .iter()
                .filter(|b| b.repository_id == *id)
                .cloned()
                .collect(),
            None => self.builds.as_ref().clone(),
        };
        Ok(builds)
    }

    /// Gets a build by ID.
    pub fn get_build(&self, id: &BuildId) -> Result<Option<Build>> {
        Ok(self.builds.iter().find(|b| b.id == *id).cloned())
    }

    /// Gets a build by ID string.
    pub fn get_build_by_string(&self, id: &str) -> Result<Option<Build>> {
        let build_id = BuildId::from_string(id)?;
        self.get_build(&build_id)
    }

    // --- Build Steps ---

    /// Lists build steps for a build.
    pub fn list_build_steps(&self, build_id: &BuildId) -> Result<Vec<BuildStep>> {
        // Find the build to get its status
        let build = self.builds.iter().find(|b| b.id == *build_id);
        match build {
            Some(b) => Ok(generate_demo_build_steps(build_id, b.status)),
            None => Ok(vec![]),
        }
    }

    /// Lists build steps for a build by ID string.
    pub fn list_build_steps_by_string(&self, build_id: &str) -> Result<Vec<BuildStep>> {
        let id = BuildId::from_string(build_id)?;
        self.list_build_steps(&id)
    }

    // --- Build Logs ---

    /// Gets build log content for a step.
    pub fn get_build_log_content(&self, _build_id: &BuildId, step_index: i32) -> Result<(String, String)> {
        Ok(generate_demo_log_content(step_index))
    }

    /// Gets build log content by ID string.
    pub fn get_build_log_content_by_string(
        &self,
        build_id: &str,
        step_index: i32,
    ) -> Result<(String, String)> {
        let id = BuildId::from_string(build_id)?;
        self.get_build_log_content(&id, step_index)
    }
}

impl Default for DemoProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for DemoProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DemoProvider")
            .field("scenario", &self.scenario)
            .field("repositories_count", &self.repositories.len())
            .field("builds_count", &self.builds.len())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_demo_provider_creation() {
        let provider = DemoProvider::new();
        assert!(provider.list_repositories().unwrap().len() >= 10);
        assert!(provider.list_builds(None).unwrap().len() >= 15);
    }

    #[test]
    fn test_demo_provider_github_status() {
        let provider = DemoProvider::new();
        let status = provider.get_github_status();
        assert!(status.configured);
        assert_eq!(status.app_name, Some("Demo GitHub App".to_string()));
    }

    #[test]
    fn test_demo_provider_gitlab_statuses() {
        let provider = DemoProvider::new();
        let statuses = provider.get_gitlab_statuses();
        assert!(!statuses.is_empty());
        assert!(statuses[0].configured);
    }

    #[test]
    fn test_demo_provider_builds_filter() {
        let provider = DemoProvider::new();
        let repos = provider.list_repositories().unwrap();
        let repo_id = &repos[0].id;

        let filtered = provider.list_builds(Some(repo_id)).unwrap();
        assert!(filtered.iter().all(|b| b.repository_id == *repo_id));
    }

    #[test]
    fn test_demo_provider_build_steps() {
        let provider = DemoProvider::new();
        let builds = provider.list_builds(None).unwrap();

        if let Some(build) = builds.first() {
            let steps = provider.list_build_steps(&build.id).unwrap();
            assert!(!steps.is_empty());
            assert!(steps.iter().enumerate().all(|(i, s)| s.step_index == i as i32));
        }
    }

    #[test]
    fn test_demo_provider_log_content() {
        let provider = DemoProvider::new();
        let builds = provider.list_builds(None).unwrap();

        if let Some(build) = builds.first() {
            let (stdout, _stderr) = provider.get_build_log_content(&build.id, 0).unwrap();
            assert!(!stdout.is_empty());
            assert!(stdout.contains("git clone"));
        }
    }
}
