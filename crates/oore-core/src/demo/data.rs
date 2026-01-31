//! Demo data generators for testing.

use crate::models::{
    Build, BuildId, BuildStatus, BuildStep, BuildStepId, ConfigSource, GitProvider, Repository,
    RepositoryId, StepStatus, TriggerType,
};
use crate::oauth::github::GitHubAppStatus;
use crate::oauth::gitlab::GitLabCredentialsStatus;
use crate::pipeline::ConfigFormat;
use chrono::{Duration, Utc};
use ulid::Ulid;

/// Static commit SHAs for demo data (40-character hex strings).
const DEMO_COMMIT_SHAS: &[&str] = &[
    "a1b2c3d4e5f6789012345678901234567890abcd",
    "b2c3d4e5f67890123456789012345678901abcde",
    "c3d4e5f678901234567890123456789012abcdef",
    "d4e5f6789012345678901234567890123abcdef0",
    "e5f67890123456789012345678901234abcdef01",
    "f678901234567890123456789012345abcdef012",
    "7890123456789012345678901234567abcdef0123",
    "890123456789012345678901234567abcdef01234",
    "90123456789012345678901234567abcdef012345",
    "0123456789012345678901234567abcdef0123456",
    "1234567890123456789012345678abcdef01234567",
    "234567890123456789012345678abcdef012345678",
    "34567890123456789012345678abcdef0123456789",
    "4567890123456789012345678abcdef01234567890",
    "567890123456789012345678abcdef012345678901",
    "67890123456789012345678abcdef0123456789012",
    "7890123456789012345678abcdef01234567890123",
    "890123456789012345678abcdef012345678901234",
    "90123456789012345678abcdef0123456789012345",
    "0123456789012345678abcdef01234567890123456",
];

/// Demo YAML pipeline configuration (Codemagic-compatible format).
pub const DEMO_YAML_CONFIG: &str = r#"workflows:
  flutter-ci:
    name: Flutter CI
    max_build_duration: 30
    environment:
      vars:
        FLUTTER_VERSION: "3.24.0"
    triggering:
      events:
        - push
        - pull_request
      branch_patterns:
        include:
          - main
          - develop
    scripts:
      - name: Install dependencies
        script: flutter pub get
      - name: Analyze code
        script: flutter analyze
      - name: Run tests
        script: flutter test --coverage
        timeout: 600
      - name: Build iOS
        script: flutter build ios --release --no-codesign
      - name: Build Android
        script: flutter build apk --release
    artifacts:
      - build/ios/**/*.ipa
      - build/app/outputs/**/*.apk
"#;

/// Demo HUML pipeline configuration.
pub const DEMO_HUML_CONFIG: &str = r#"%HUML v0.2.0
workflows::
  ios-release::
    name: "iOS Release"
    max_build_duration: 45
    environment::
      vars::
        FLUTTER_VERSION: "3.24.0"
        XCODE_VERSION: "15.2"
    triggering::
      events:: "push"
      branch_patterns::
        include:: "main", "release/*"
    scripts::
      - ::
        name: "Checkout"
        script: "git checkout $BRANCH"
      - ::
        name: "Install Flutter"
        script: "fvm install $FLUTTER_VERSION && fvm use $FLUTTER_VERSION"
      - ::
        name: "Dependencies"
        script: "flutter pub get"
      - ::
        name: "Analyze"
        script: "flutter analyze --fatal-infos"
      - ::
        name: "Test"
        script: "flutter test --coverage"
      - ::
        name: "Build iOS"
        script: "flutter build ipa --release --export-options-plist=ios/ExportOptions.plist"
        timeout: 1200
      - ::
        name: "Upload to TestFlight"
        script: "xcrun altool --upload-app -f build/ios/ipa/*.ipa"
    artifacts:: "build/ios/ipa/*.ipa", "coverage/lcov.info"
"#;

/// Generates demo GitHub App status showing as configured.
pub fn generate_demo_github_status() -> GitHubAppStatus {
    GitHubAppStatus {
        configured: true,
        app_name: Some("Oore CI Demo".to_string()),
        app_id: Some(123456),
        app_slug: Some("oore-ci-demo".to_string()),
        owner_login: Some("acme-corp".to_string()),
        owner_type: Some("Organization".to_string()),
        html_url: Some("https://github.com/apps/oore-ci-demo".to_string()),
        installations_count: 3,
        created_at: Some("2024-01-15T10:30:00Z".to_string()),
    }
}

/// Generates demo GitLab credentials showing as connected.
pub fn generate_demo_gitlab_statuses() -> Vec<GitLabCredentialsStatus> {
    vec![
        GitLabCredentialsStatus {
            id: Ulid::new().to_string(),
            configured: true,
            instance_url: Some("https://gitlab.com".to_string()),
            username: Some("demo-user".to_string()),
            user_id: Some(12345),
            token_expires_at: Some(
                (Utc::now() + Duration::days(30))
                    .format("%Y-%m-%dT%H:%M:%SZ")
                    .to_string(),
            ),
            needs_refresh: false,
            enabled_projects_count: 5,
        },
        GitLabCredentialsStatus {
            id: Ulid::new().to_string(),
            configured: true,
            instance_url: Some("https://gitlab.example.com".to_string()),
            username: Some("enterprise-user".to_string()),
            user_id: Some(67890),
            token_expires_at: Some(
                (Utc::now() + Duration::days(60))
                    .format("%Y-%m-%dT%H:%M:%SZ")
                    .to_string(),
            ),
            needs_refresh: false,
            enabled_projects_count: 3,
        },
    ]
}

/// Demo GitHub installation info.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DemoInstallationInfo {
    pub installation_id: i64,
    pub account_login: String,
    pub account_type: String,
    pub repository_selection: String,
    pub is_active: bool,
}

/// Generates demo GitHub installations.
pub fn generate_demo_installations() -> Vec<DemoInstallationInfo> {
    vec![
        DemoInstallationInfo {
            installation_id: 50001,
            account_login: "acme-corp".to_string(),
            account_type: "Organization".to_string(),
            repository_selection: "selected".to_string(),
            is_active: true,
        },
        DemoInstallationInfo {
            installation_id: 50002,
            account_login: "mobile-team".to_string(),
            account_type: "Organization".to_string(),
            repository_selection: "all".to_string(),
            is_active: true,
        },
        DemoInstallationInfo {
            installation_id: 50003,
            account_login: "frontend-team".to_string(),
            account_type: "Organization".to_string(),
            repository_selection: "selected".to_string(),
            is_active: true,
        },
    ]
}

/// Generates demo repositories (mix of GitHub and GitLab).
pub fn generate_demo_repositories() -> Vec<Repository> {
    let now = Utc::now();

    vec![
        // GitHub repositories
        Repository {
            id: RepositoryId::new(),
            name: "flutter-mobile-app".to_string(),
            provider: GitProvider::GitHub,
            owner: "acme-corp".to_string(),
            repo_name: "flutter-mobile-app".to_string(),
            clone_url: "https://github.com/acme-corp/flutter-mobile-app.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: Some(100001),
            github_installation_id: Some(50001),
            gitlab_project_id: None,
            created_at: now - Duration::days(45),
            updated_at: now - Duration::hours(2),
        },
        Repository {
            id: RepositoryId::new(),
            name: "backend-api".to_string(),
            provider: GitProvider::GitHub,
            owner: "acme-corp".to_string(),
            repo_name: "backend-api".to_string(),
            clone_url: "https://github.com/acme-corp/backend-api.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: Some(100002),
            github_installation_id: Some(50001),
            gitlab_project_id: None,
            created_at: now - Duration::days(60),
            updated_at: now - Duration::days(1),
        },
        Repository {
            id: RepositoryId::new(),
            name: "shared-components".to_string(),
            provider: GitProvider::GitHub,
            owner: "acme-corp".to_string(),
            repo_name: "shared-components".to_string(),
            clone_url: "https://github.com/acme-corp/shared-components.git".to_string(),
            default_branch: "develop".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: Some(100003),
            github_installation_id: Some(50001),
            gitlab_project_id: None,
            created_at: now - Duration::days(30),
            updated_at: now - Duration::hours(6),
        },
        Repository {
            id: RepositoryId::new(),
            name: "ios-native-module".to_string(),
            provider: GitProvider::GitHub,
            owner: "mobile-team".to_string(),
            repo_name: "ios-native-module".to_string(),
            clone_url: "https://github.com/mobile-team/ios-native-module.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: Some(100004),
            github_installation_id: Some(50002),
            gitlab_project_id: None,
            created_at: now - Duration::days(20),
            updated_at: now - Duration::hours(12),
        },
        Repository {
            id: RepositoryId::new(),
            name: "android-sdk".to_string(),
            provider: GitProvider::GitHub,
            owner: "mobile-team".to_string(),
            repo_name: "android-sdk".to_string(),
            clone_url: "https://github.com/mobile-team/android-sdk.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: Some(100005),
            github_installation_id: Some(50002),
            gitlab_project_id: None,
            created_at: now - Duration::days(15),
            updated_at: now - Duration::days(2),
        },
        Repository {
            id: RepositoryId::new(),
            name: "design-system".to_string(),
            provider: GitProvider::GitHub,
            owner: "frontend-team".to_string(),
            repo_name: "design-system".to_string(),
            clone_url: "https://github.com/frontend-team/design-system.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: false, // Inactive repo
            github_repository_id: Some(100006),
            github_installation_id: Some(50003),
            gitlab_project_id: None,
            created_at: now - Duration::days(90),
            updated_at: now - Duration::days(30),
        },
        Repository {
            id: RepositoryId::new(),
            name: "docs-site".to_string(),
            provider: GitProvider::GitHub,
            owner: "acme-corp".to_string(),
            repo_name: "docs-site".to_string(),
            clone_url: "https://github.com/acme-corp/docs-site.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: Some(100007),
            github_installation_id: Some(50001),
            gitlab_project_id: None,
            created_at: now - Duration::days(10),
            updated_at: now - Duration::hours(1),
        },
        // GitLab repositories
        Repository {
            id: RepositoryId::new(),
            name: "enterprise-app".to_string(),
            provider: GitProvider::GitLab,
            owner: "enterprise".to_string(),
            repo_name: "enterprise-app".to_string(),
            clone_url: "https://gitlab.com/enterprise/enterprise-app.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: None,
            github_installation_id: None,
            gitlab_project_id: Some(200001),
            created_at: now - Duration::days(25),
            updated_at: now - Duration::hours(4),
        },
        Repository {
            id: RepositoryId::new(),
            name: "internal-tools".to_string(),
            provider: GitProvider::GitLab,
            owner: "devops".to_string(),
            repo_name: "internal-tools".to_string(),
            clone_url: "https://gitlab.example.com/devops/internal-tools.git".to_string(),
            default_branch: "master".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: None,
            github_installation_id: None,
            gitlab_project_id: Some(200002),
            created_at: now - Duration::days(50),
            updated_at: now - Duration::days(3),
        },
        Repository {
            id: RepositoryId::new(),
            name: "flutter-widgets".to_string(),
            provider: GitProvider::GitLab,
            owner: "mobile".to_string(),
            repo_name: "flutter-widgets".to_string(),
            clone_url: "https://gitlab.com/mobile/flutter-widgets.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: None,
            github_installation_id: None,
            gitlab_project_id: Some(200003),
            created_at: now - Duration::days(18),
            updated_at: now - Duration::hours(8),
        },
        Repository {
            id: RepositoryId::new(),
            name: "analytics-dashboard".to_string(),
            provider: GitProvider::GitLab,
            owner: "data-team".to_string(),
            repo_name: "analytics-dashboard".to_string(),
            clone_url: "https://gitlab.example.com/data-team/analytics-dashboard.git".to_string(),
            default_branch: "develop".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: None,
            github_installation_id: None,
            gitlab_project_id: Some(200004),
            created_at: now - Duration::days(35),
            updated_at: now - Duration::hours(18),
        },
        Repository {
            id: RepositoryId::new(),
            name: "ci-templates".to_string(),
            provider: GitProvider::GitLab,
            owner: "devops".to_string(),
            repo_name: "ci-templates".to_string(),
            clone_url: "https://gitlab.example.com/devops/ci-templates.git".to_string(),
            default_branch: "main".to_string(),
            webhook_secret_hmac: None,
            is_active: true,
            github_repository_id: None,
            github_installation_id: None,
            gitlab_project_id: Some(200005),
            created_at: now - Duration::days(40),
            updated_at: now - Duration::days(5),
        },
    ]
}

/// Generates demo builds for the given repositories.
pub fn generate_demo_builds(repositories: &[Repository]) -> Vec<Build> {
    let now = Utc::now();
    let mut builds = Vec::new();

    let statuses = [
        BuildStatus::Success,
        BuildStatus::Success,
        BuildStatus::Success,
        BuildStatus::Failure,
        BuildStatus::Running,
        BuildStatus::Pending,
        BuildStatus::Success,
        BuildStatus::Cancelled,
    ];

    let triggers = [
        TriggerType::Push,
        TriggerType::PullRequest,
        TriggerType::Push,
        TriggerType::Manual,
    ];

    let branches = ["main", "develop", "feature/new-ui", "fix/login-bug", "release/v1.2.0"];

    let workflow_names = [
        Some("Flutter CI"),
        Some("iOS Release"),
        Some("Android Build"),
        None,
    ];

    for (repo_idx, repo) in repositories.iter().take(8).enumerate() {
        // Generate 2-4 builds per repo
        let num_builds = 2 + (repo_idx % 3);

        for build_idx in 0..num_builds {
            let status_idx = (repo_idx * 3 + build_idx) % statuses.len();
            let status = statuses[status_idx].clone();

            let hours_ago = (repo_idx * 4 + build_idx * 2) as i64;
            let created_at = now - Duration::hours(hours_ago);

            let (started_at, finished_at) = match status {
                BuildStatus::Pending => (None, None),
                BuildStatus::Running => (Some(created_at + Duration::seconds(5)), None),
                _ => {
                    let started = created_at + Duration::seconds(5);
                    let duration_mins = 3 + (build_idx % 5) as i64;
                    (Some(started), Some(started + Duration::minutes(duration_mins)))
                }
            };

            let error_message = if status == BuildStatus::Failure {
                Some("Test suite failed: 3 tests failed in test/widget_test.dart".to_string())
            } else {
                None
            };

            builds.push(Build {
                id: BuildId::new(),
                repository_id: repo.id.clone(),
                webhook_event_id: None,
                commit_sha: DEMO_COMMIT_SHAS[(repo_idx * 3 + build_idx) % DEMO_COMMIT_SHAS.len()]
                    .to_string(),
                branch: branches[(repo_idx + build_idx) % branches.len()].to_string(),
                trigger_type: triggers[(repo_idx + build_idx) % triggers.len()].clone(),
                status,
                started_at,
                finished_at,
                created_at,
                workflow_name: workflow_names[(repo_idx + build_idx) % workflow_names.len()]
                    .map(String::from),
                config_source: Some(ConfigSource::Repository),
                error_message,
            });
        }
    }

    // Sort by created_at descending (newest first)
    builds.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    builds
}

/// Generates demo build steps for a build.
pub fn generate_demo_build_steps(build: &Build) -> Vec<BuildStep> {
    let step_definitions = [
        ("Checkout", "git checkout $BRANCH && git pull origin $BRANCH"),
        ("Install Flutter", "fvm install 3.24.0 && fvm use 3.24.0"),
        ("Get Dependencies", "flutter pub get"),
        ("Analyze Code", "flutter analyze --fatal-infos"),
        ("Run Tests", "flutter test --coverage"),
        ("Build Release", "flutter build apk --release"),
    ];

    let now = Utc::now();
    let mut steps = Vec::new();

    for (idx, (name, script)) in step_definitions.iter().enumerate() {
        let step_status = match &build.status {
            BuildStatus::Success => StepStatus::Success,
            BuildStatus::Failure if idx == 4 => StepStatus::Failure, // Tests fail
            BuildStatus::Failure if idx > 4 => StepStatus::Skipped,
            BuildStatus::Failure => StepStatus::Success,
            BuildStatus::Running if idx < 3 => StepStatus::Success,
            BuildStatus::Running if idx == 3 => StepStatus::Running,
            BuildStatus::Running => StepStatus::Pending,
            BuildStatus::Pending => StepStatus::Pending,
            BuildStatus::Cancelled if idx < 2 => StepStatus::Success,
            BuildStatus::Cancelled => StepStatus::Cancelled,
        };

        let (started_at, finished_at, exit_code) = match step_status {
            StepStatus::Pending => (None, None, None),
            StepStatus::Running => {
                let started = build.started_at.map(|s| s + Duration::seconds((idx * 30) as i64));
                (started, None, None)
            }
            StepStatus::Skipped | StepStatus::Cancelled => (None, None, None),
            _ => {
                let started = build.started_at.map(|s| s + Duration::seconds((idx * 30) as i64));
                let duration = Duration::seconds(15 + (idx * 10) as i64);
                let exit = if step_status == StepStatus::Failure {
                    1
                } else {
                    0
                };
                (started, started.map(|s| s + duration), Some(exit))
            }
        };

        steps.push(BuildStep {
            id: BuildStepId::new(),
            build_id: build.id.clone(),
            step_index: idx as i32,
            name: name.to_string(),
            script: Some(script.to_string()),
            timeout_secs: Some(300),
            ignore_failure: false,
            status: step_status,
            exit_code,
            started_at,
            finished_at,
            created_at: now,
        });
    }

    steps
}

/// Generates demo log content for a step with ANSI colors.
pub fn generate_demo_log_content(step_name: &str, step_status: &StepStatus) -> (String, String) {
    let stdout = match step_name {
        "Checkout" => "\x1b[36m[oore]\x1b[0m Checking out repository...\n\
             \x1b[32m✓\x1b[0m Switched to branch 'main'\n\
             \x1b[32m✓\x1b[0m Already up to date.\n\
             \x1b[36m[oore]\x1b[0m Checkout complete\n"
            .to_string(),
        "Install Flutter" => "\x1b[36m[oore]\x1b[0m Installing Flutter 3.24.0...\n\
             Downloading Flutter SDK...\n\
             \x1b[32m✓\x1b[0m Flutter 3.24.0 installed\n\
             \x1b[36m[oore]\x1b[0m Using Flutter 3.24.0\n\
             Flutter 3.24.0 • channel stable • https://github.com/flutter/flutter.git\n\
             Framework • revision abc123def (2 weeks ago) • 2024-01-15 10:00:00\n\
             Engine • revision xyz789ghi\n\
             Tools • Dart 3.3.0 • DevTools 2.28.0\n"
            .to_string(),
        "Get Dependencies" => "\x1b[36m[oore]\x1b[0m Running flutter pub get...\n\
             Resolving dependencies...\n\
             \x1b[32m+\x1b[0m flutter_bloc 8.1.3\n\
             \x1b[32m+\x1b[0m equatable 2.0.5\n\
             \x1b[32m+\x1b[0m dio 5.4.0\n\
             \x1b[32m+\x1b[0m shared_preferences 2.2.2\n\
             \x1b[32m+\x1b[0m go_router 13.0.0\n\
             Changed 42 dependencies!\n\
             \x1b[32m✓\x1b[0m Dependencies resolved\n"
            .to_string(),
        "Analyze Code" => "\x1b[36m[oore]\x1b[0m Running flutter analyze...\n\
             Analyzing flutter_mobile_app...\n\n\
             \x1b[33minfo\x1b[0m • Unused import: 'package:flutter/foundation.dart' • lib/utils.dart:3:8\n\
             \x1b[33minfo\x1b[0m • Prefer const with constant constructors • lib/widgets/button.dart:15:12\n\n\
             \x1b[32m✓\x1b[0m No errors found! (2 infos)\n"
            .to_string(),
        "Run Tests" => {
            if matches!(step_status, StepStatus::Failure) {
                "\x1b[36m[oore]\x1b[0m Running flutter test...\n\
                     Running tests...\n\n\
                     \x1b[32m✓\x1b[0m Widget renders correctly\n\
                     \x1b[32m✓\x1b[0m Button tap triggers callback\n\
                     \x1b[31m✗\x1b[0m Login form validation fails\n\
                     \x1b[31m  Expected: 'Please enter email'\x1b[0m\n\
                     \x1b[31m  Actual: null\x1b[0m\n\
                     \x1b[31m✗\x1b[0m API error handling test\n\
                     \x1b[31m  TimeoutException after 5000ms\x1b[0m\n\
                     \x1b[32m✓\x1b[0m Navigation test passes\n\n\
                     \x1b[31m3 tests failed\x1b[0m, 15 passed, 0 skipped\n"
                    .to_string()
            } else {
                "\x1b[36m[oore]\x1b[0m Running flutter test...\n\
                     Running tests...\n\n\
                     \x1b[32m✓\x1b[0m Widget renders correctly\n\
                     \x1b[32m✓\x1b[0m Button tap triggers callback\n\
                     \x1b[32m✓\x1b[0m Login form validation\n\
                     \x1b[32m✓\x1b[0m API error handling\n\
                     \x1b[32m✓\x1b[0m Navigation test\n\
                     \x1b[32m✓\x1b[0m State management test\n\
                     \x1b[32m✓\x1b[0m Widget snapshot test\n\n\
                     \x1b[32mAll 18 tests passed!\x1b[0m\n"
                    .to_string()
            }
        }
        "Build Release" => "\x1b[36m[oore]\x1b[0m Building release APK...\n\
             Running Gradle build...\n\
             \x1b[90m> Task :app:compileReleaseKotlin\x1b[0m\n\
             \x1b[90m> Task :app:compileReleaseJavaWithJavac\x1b[0m\n\
             \x1b[90m> Task :app:bundleReleaseResources\x1b[0m\n\
             \x1b[90m> Task :app:packageRelease\x1b[0m\n\n\
             \x1b[32m✓\x1b[0m Built build/app/outputs/flutter-apk/app-release.apk (24.5 MB)\n\
             \x1b[36m[oore]\x1b[0m Build complete!\n"
            .to_string(),
        _ => format!(
            "\x1b[36m[oore]\x1b[0m Running {}...\n\
             \x1b[32m✓\x1b[0m Step completed\n",
            step_name
        ),
    };

    let stderr = if matches!(step_status, StepStatus::Failure) && step_name == "Run Tests" {
        "\x1b[31mError: Test suite failed\x1b[0m\nSee test output above for details.\n".to_string()
    } else {
        String::new()
    };

    (stdout, stderr)
}

/// Gets the appropriate pipeline config format for a repository based on its index.
pub fn get_demo_pipeline_config(repo_index: usize) -> Option<(String, ConfigFormat)> {
    match repo_index % 3 {
        0 => Some((DEMO_YAML_CONFIG.to_string(), ConfigFormat::Yaml)),
        1 => Some((DEMO_HUML_CONFIG.to_string(), ConfigFormat::Huml)),
        _ => None, // Some repos don't have configs
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_status_is_configured() {
        let status = generate_demo_github_status();
        assert!(status.configured);
        assert!(status.app_name.is_some());
        assert!(status.app_id.is_some());
    }

    #[test]
    fn test_gitlab_statuses_has_instances() {
        let statuses = generate_demo_gitlab_statuses();
        assert!(!statuses.is_empty());
        assert!(statuses.iter().all(|s| s.configured));
    }

    #[test]
    fn test_repositories_have_both_providers() {
        let repos = generate_demo_repositories();
        let github_count = repos.iter().filter(|r| r.provider == GitProvider::GitHub).count();
        let gitlab_count = repos.iter().filter(|r| r.provider == GitProvider::GitLab).count();

        assert!(github_count > 0, "Should have GitHub repos");
        assert!(gitlab_count > 0, "Should have GitLab repos");
        assert!(repos.len() >= 10, "Should have at least 10 repos for pagination testing");
    }

    #[test]
    fn test_builds_have_various_statuses() {
        let repos = generate_demo_repositories();
        let builds = generate_demo_builds(&repos);

        let has_success = builds.iter().any(|b| b.status == BuildStatus::Success);
        let has_failure = builds.iter().any(|b| b.status == BuildStatus::Failure);
        let has_running = builds.iter().any(|b| b.status == BuildStatus::Running);

        assert!(has_success, "Should have successful builds");
        assert!(has_failure, "Should have failed builds");
        assert!(has_running, "Should have running builds");
    }

    #[test]
    fn test_build_steps_generated() {
        let repos = generate_demo_repositories();
        let builds = generate_demo_builds(&repos);
        let steps = generate_demo_build_steps(&builds[0]);

        assert!(!steps.is_empty());
        assert!(steps.iter().all(|s| !s.name.is_empty()));
    }

    #[test]
    fn test_log_content_has_ansi() {
        let (stdout, _) = generate_demo_log_content("Checkout", &StepStatus::Success);
        assert!(stdout.contains("\x1b["), "Should contain ANSI escape codes");
    }
}
