//! Mock data generators for demo mode.

use chrono::{Duration, Utc};
use ulid::Ulid;

use crate::models::{
    Build, BuildId, BuildStatus, BuildStep, BuildStepId, ConfigSource, GitProvider, Repository,
    RepositoryId, StepStatus, TriggerType,
};
use crate::oauth::github::GitHubAppStatus;
use crate::oauth::gitlab::GitLabCredentialsStatus;

/// Demo mode marker name for GitHub App.
pub const DEMO_GITHUB_APP_NAME: &str = "Demo GitHub App";

/// Generate demo repositories.
pub fn generate_demo_repositories() -> Vec<Repository> {
    let now = Utc::now();

    vec![
        // GitHub repositories
        create_repo(
            "01JFRP0000DEMO0001FLUTTER",
            "flutter-mobile-app",
            GitProvider::GitHub,
            "demo-org",
            "flutter-mobile-app",
            "main",
            Some(100001),
            Some(1001),
            None,
            now - Duration::days(30),
        ),
        create_repo(
            "01JFRP0000DEMO0002FLUTTER",
            "flutter-web-dashboard",
            GitProvider::GitHub,
            "demo-org",
            "flutter-web-dashboard",
            "main",
            Some(100002),
            Some(1001),
            None,
            now - Duration::days(25),
        ),
        create_repo(
            "01JFRP0000DEMO0003REACT",
            "react-admin-panel",
            GitProvider::GitHub,
            "demo-user",
            "react-admin-panel",
            "develop",
            Some(100003),
            Some(1002),
            None,
            now - Duration::days(20),
        ),
        create_repo(
            "01JFRP0000DEMO0004PYTHON",
            "python-api-service",
            GitProvider::GitHub,
            "demo-org",
            "python-api-service",
            "main",
            Some(100004),
            Some(1001),
            None,
            now - Duration::days(15),
        ),
        create_repo(
            "01JFRP0000DEMO0005GOAPI",
            "go-microservice",
            GitProvider::GitHub,
            "demo-user",
            "go-microservice",
            "main",
            Some(100005),
            Some(1002),
            None,
            now - Duration::days(10),
        ),
        create_repo(
            "01JFRP0000DEMO0006RUST",
            "rust-cli-tool",
            GitProvider::GitHub,
            "demo-org",
            "rust-cli-tool",
            "main",
            Some(100006),
            Some(1001),
            None,
            now - Duration::days(7),
        ),
        create_repo(
            "01JFRP0000DEMO0007NODE",
            "node-backend",
            GitProvider::GitHub,
            "demo-org",
            "node-backend",
            "main",
            Some(100007),
            Some(1001),
            None,
            now - Duration::days(5),
        ),
        // GitLab repositories
        create_repo(
            "01JFRP0000DEMO0008FLUTLAB",
            "flutter-ecommerce",
            GitProvider::GitLab,
            "demo-group",
            "flutter-ecommerce",
            "main",
            None,
            None,
            Some(200001),
            now - Duration::days(28),
        ),
        create_repo(
            "01JFRP0000DEMO0009PYLAB",
            "python-ml-pipeline",
            GitProvider::GitLab,
            "demo-group",
            "python-ml-pipeline",
            "develop",
            None,
            None,
            Some(200002),
            now - Duration::days(22),
        ),
        create_repo(
            "01JFRP0000DEMO0010GOLAB",
            "go-grpc-server",
            GitProvider::GitLab,
            "demo-user",
            "go-grpc-server",
            "main",
            None,
            None,
            Some(200003),
            now - Duration::days(18),
        ),
        create_repo(
            "01JFRP0000DEMO0011TSLAB",
            "typescript-sdk",
            GitProvider::GitLab,
            "demo-group",
            "typescript-sdk",
            "main",
            None,
            None,
            Some(200004),
            now - Duration::days(12),
        ),
        create_repo(
            "01JFRP0000DEMO0012DOCLAB",
            "docs-site",
            GitProvider::GitLab,
            "demo-group",
            "docs-site",
            "main",
            None,
            None,
            Some(200005),
            now - Duration::days(3),
        ),
    ]
}

fn create_repo(
    id: &str,
    name: &str,
    provider: GitProvider,
    owner: &str,
    repo_name: &str,
    branch: &str,
    github_repo_id: Option<i64>,
    github_install_id: Option<i64>,
    gitlab_project_id: Option<i64>,
    created_at: chrono::DateTime<Utc>,
) -> Repository {
    let clone_url = match provider {
        GitProvider::GitHub => format!("https://github.com/{}/{}.git", owner, repo_name),
        GitProvider::GitLab => format!("https://gitlab.com/{}/{}.git", owner, repo_name),
    };

    Repository {
        id: RepositoryId(Ulid::from_string(id).unwrap_or_else(|_| Ulid::new())),
        name: name.to_string(),
        provider,
        owner: owner.to_string(),
        repo_name: repo_name.to_string(),
        clone_url,
        default_branch: branch.to_string(),
        webhook_secret_hmac: None,
        is_active: true,
        github_repository_id: github_repo_id,
        github_installation_id: github_install_id,
        gitlab_project_id,
        created_at,
        updated_at: created_at,
    }
}

/// Generate demo builds for all repositories.
pub fn generate_demo_builds(repositories: &[Repository]) -> Vec<Build> {
    let now = Utc::now();
    let mut builds = Vec::new();

    // Generate builds for first few repos with varied statuses
    let build_configs = [
        // Repo index, status, hours_ago, trigger_type
        (0, BuildStatus::Success, 1, TriggerType::Push),
        (0, BuildStatus::Success, 5, TriggerType::Push),
        (0, BuildStatus::Failure, 12, TriggerType::PullRequest),
        (0, BuildStatus::Success, 24, TriggerType::Push),
        (1, BuildStatus::Running, 0, TriggerType::Push),
        (1, BuildStatus::Success, 3, TriggerType::Push),
        (1, BuildStatus::Success, 8, TriggerType::Manual),
        (2, BuildStatus::Pending, 0, TriggerType::Push),
        (2, BuildStatus::Failure, 2, TriggerType::PullRequest),
        (2, BuildStatus::Success, 6, TriggerType::Push),
        (3, BuildStatus::Success, 4, TriggerType::Push),
        (3, BuildStatus::Success, 10, TriggerType::Push),
        (4, BuildStatus::Cancelled, 1, TriggerType::Manual),
        (4, BuildStatus::Success, 7, TriggerType::Push),
        (5, BuildStatus::Success, 2, TriggerType::Push),
        (6, BuildStatus::Success, 6, TriggerType::Push),
        (7, BuildStatus::Success, 3, TriggerType::Push),
        (7, BuildStatus::Failure, 9, TriggerType::MergeRequest),
        (8, BuildStatus::Success, 5, TriggerType::Push),
        (9, BuildStatus::Success, 8, TriggerType::Push),
    ];

    for (idx, (repo_idx, status, hours_ago, trigger)) in build_configs.iter().enumerate() {
        if *repo_idx >= repositories.len() {
            continue;
        }

        let repo = &repositories[*repo_idx];
        let created = now - Duration::hours(*hours_ago as i64);
        let started = if *status != BuildStatus::Pending {
            Some(created + Duration::seconds(5))
        } else {
            None
        };
        let finished = match status {
            BuildStatus::Success | BuildStatus::Failure | BuildStatus::Cancelled => {
                Some(created + Duration::minutes(3) + Duration::seconds(idx as i64 * 10))
            }
            _ => None,
        };

        let build_id = format!("01JFRP0000DEMO0BUILD{:04}", idx + 1);
        // Use predefined realistic commit SHAs
        let commit_shas = [
            "a1b2c3d4e5f6789012345678901234567890abcd",
            "b2c3d4e5f6789012345678901234567890abcde",
            "c3d4e5f6789012345678901234567890abcdef1",
            "d4e5f6789012345678901234567890abcdef12",
            "e5f6789012345678901234567890abcdef123",
            "f6789012345678901234567890abcdef1234a",
            "789012345678901234567890abcdef1234ab",
            "89012345678901234567890abcdef1234abc",
            "9012345678901234567890abcdef1234abcd",
            "012345678901234567890abcdef1234abcde",
            "12345678901234567890abcdef1234abcdef",
            "2345678901234567890abcdef1234abcdef0",
            "345678901234567890abcdef1234abcdef01",
            "45678901234567890abcdef1234abcdef012",
            "5678901234567890abcdef1234abcdef0123",
            "678901234567890abcdef1234abcdef01234",
            "78901234567890abcdef1234abcdef012345",
            "8901234567890abcdef1234abcdef0123456",
            "901234567890abcdef1234abcdef01234567",
            "01234567890abcdef1234abcdef012345678",
        ];
        let commit_sha = commit_shas[idx % commit_shas.len()].to_string();

        builds.push(Build {
            id: BuildId(Ulid::from_string(&build_id).unwrap_or_else(|_| Ulid::new())),
            repository_id: repo.id.clone(),
            webhook_event_id: None,
            commit_sha,
            branch: repo.default_branch.clone(),
            trigger_type: *trigger,
            status: *status,
            started_at: started,
            finished_at: finished,
            created_at: created,
            workflow_name: Some("default".to_string()),
            config_source: Some(ConfigSource::Repository),
            error_message: if *status == BuildStatus::Failure {
                Some("Test failed: 2 tests failed".to_string())
            } else {
                None
            },
        });
    }

    // Sort by created_at descending
    builds.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    builds
}

/// Generate demo build steps.
pub fn generate_demo_build_steps(build_id: &BuildId, status: BuildStatus) -> Vec<BuildStep> {
    let now = Utc::now();
    let base_time = now - Duration::minutes(5);

    let step_configs = [
        ("Clone Repository", 10, StepStatus::Success),
        ("Install Dependencies", 45, StepStatus::Success),
        ("Analyze Code", 20, StepStatus::Success),
        ("Run Tests", 60, StepStatus::Success),
        ("Build Application", 90, StepStatus::Success),
        ("Archive Artifacts", 5, StepStatus::Success),
    ];

    let mut steps = Vec::new();
    let mut current_time = base_time;

    for (idx, (name, duration_secs, default_status)) in step_configs.iter().enumerate() {
        let step_status = match status {
            BuildStatus::Pending => StepStatus::Pending,
            BuildStatus::Running if idx == 3 => StepStatus::Running,
            BuildStatus::Running if idx > 3 => StepStatus::Pending,
            BuildStatus::Failure if idx == 3 => StepStatus::Failure,
            BuildStatus::Failure if idx > 3 => StepStatus::Skipped,
            BuildStatus::Cancelled if idx >= 2 => StepStatus::Cancelled,
            _ => *default_status,
        };

        let started = if step_status != StepStatus::Pending && step_status != StepStatus::Skipped {
            Some(current_time)
        } else {
            None
        };

        let finished = if step_status.is_terminal() && step_status != StepStatus::Skipped {
            Some(current_time + Duration::seconds(*duration_secs as i64))
        } else {
            None
        };

        let exit_code = match step_status {
            StepStatus::Success => Some(0),
            StepStatus::Failure => Some(1),
            _ => None,
        };

        let step_id = format!("01JFRP0000DEMOSTEP{:05}", idx);

        steps.push(BuildStep {
            id: BuildStepId(Ulid::from_string(&step_id).unwrap_or_else(|_| Ulid::new())),
            build_id: build_id.clone(),
            step_index: idx as i32,
            name: name.to_string(),
            script: Some(format!("# Demo script for {}", name)),
            timeout_secs: Some(600),
            ignore_failure: false,
            status: step_status,
            exit_code,
            started_at: started,
            finished_at: finished,
            created_at: base_time,
        });

        if step_status != StepStatus::Pending && step_status != StepStatus::Skipped {
            current_time = current_time + Duration::seconds(*duration_secs as i64 + 2);
        }
    }

    steps
}

/// Generate demo log content for a build step with ANSI colors.
pub fn generate_demo_log_content(step_index: i32) -> (String, String) {
    let stdout = match step_index {
        0 => generate_clone_logs(),
        1 => generate_dependencies_logs(),
        2 => generate_analyze_logs(),
        3 => generate_test_logs(),
        4 => generate_build_logs(),
        5 => generate_archive_logs(),
        _ => "No logs available.\n".to_string(),
    };

    let stderr = String::new(); // Typically empty for successful steps

    (stdout, stderr)
}

fn generate_clone_logs() -> String {
    r#"[90m$ git clone https://github.com/demo-org/flutter-mobile-app.git[0m
Cloning into 'flutter-mobile-app'...
[32mremote: Enumerating objects: 1247, done.[0m
[32mremote: Counting objects: 100% (1247/1247), done.[0m
[32mremote: Compressing objects: 100% (892/892), done.[0m
[32mremote: Total 1247 (delta 423), reused 1089 (delta 312), pack-reused 0[0m
Receiving objects: 100% (1247/1247), 2.34 MiB | 12.45 MiB/s, done.
Resolving deltas: 100% (423/423), done.
[33mChecking out files: 100% (156/156), done.[0m
[90m$ git checkout abc1234567890abcdef1234567890abcdef1234[0m
HEAD is now at abc1234 feat: add new login screen
"#
    .to_string()
}

fn generate_dependencies_logs() -> String {
    r#"[90m$ flutter pub get[0m
[32mResolving dependencies...[0m
[32m+ flutter_bloc 8.1.3[0m
[32m+ equatable 2.0.5[0m
[32m+ dio 5.4.0[0m
[32m+ get_it 7.6.4[0m
[32m+ injectable 2.3.2[0m
[32m+ freezed_annotation 2.4.1[0m
[32m+ json_annotation 4.8.1[0m
[32m+ shared_preferences 2.2.2[0m
[32m+ flutter_secure_storage 9.0.0[0m
[32m+ cached_network_image 3.3.0[0m
[36mDownloading packages...[0m
[32mGot dependencies![0m
[90m$ flutter pub get (in ./packages/core)[0m
[32mResolving dependencies...[0m
[32mGot dependencies![0m
[90m$ flutter pub get (in ./packages/ui)[0m
[32mResolving dependencies...[0m
[32mGot dependencies![0m
"#
    .to_string()
}

fn generate_analyze_logs() -> String {
    r#"[90m$ flutter analyze[0m
[36mAnalyzing flutter-mobile-app...[0m

[33minfo • Avoid `print` calls in production code • lib/utils/debug.dart:12:5 • avoid_print[0m
[33minfo • Prefer const with constant constructors • lib/widgets/button.dart:8:12 • prefer_const_constructors[0m

[32mNo issues found! (ran in 8.2s)[0m
"#
    .to_string()
}

fn generate_test_logs() -> String {
    r#"[90m$ flutter test --coverage[0m
[36m00:00 +0: loading /flutter-mobile-app/test/unit/auth_bloc_test.dart[0m
[36m00:01 +0: loading /flutter-mobile-app/test/unit/user_repository_test.dart[0m
[36m00:02 +0: loading /flutter-mobile-app/test/widget/login_screen_test.dart[0m

[32m00:05 +1: AuthBloc emits [AuthLoading, AuthAuthenticated] on successful login[0m
[32m00:05 +2: AuthBloc emits [AuthLoading, AuthError] on failed login[0m
[32m00:06 +3: AuthBloc clears state on logout[0m
[32m00:07 +4: UserRepository returns user on valid token[0m
[32m00:07 +5: UserRepository throws on invalid token[0m
[32m00:08 +6: UserRepository caches user data[0m
[32m00:10 +7: LoginScreen shows email field[0m
[32m00:10 +8: LoginScreen shows password field[0m
[32m00:11 +9: LoginScreen validates empty email[0m
[32m00:12 +10: LoginScreen validates invalid email format[0m
[32m00:13 +11: LoginScreen navigates on successful login[0m
[32m00:14 +12: LoginScreen shows error message on failure[0m

[32m00:14 +12: All tests passed![0m
[36mTest Coverage: 87.3%[0m
[32m✓ Coverage threshold met (minimum: 80%)[0m
"#
    .to_string()
}

fn generate_build_logs() -> String {
    r#"[90m$ flutter build apk --release[0m
[36mBuilding with Flutter 3.19.0[0m

[90mRunning Gradle task 'assembleRelease'...[0m
[32m✓ Built build/app/outputs/flutter-apk/app-release.apk (28.4MB).[0m

[90m$ flutter build ios --release --no-codesign[0m
[36mBuilding com.demo.flutterApp for device (ios-release)...[0m
[32m✓ Built build/ios/iphoneos/Runner.app (45.2MB).[0m

[90m$ flutter build web --release[0m
[36mCompiling lib/main.dart for the Web...[0m
[32m✓ Built build/web (8.7MB).[0m

[32mAll builds completed successfully![0m
"#
    .to_string()
}

fn generate_archive_logs() -> String {
    r#"[90m$ mkdir -p artifacts[0m
[90m$ cp build/app/outputs/flutter-apk/app-release.apk artifacts/[0m
[90m$ cp -r build/ios/iphoneos/Runner.app artifacts/[0m
[90m$ tar -czvf artifacts/web-build.tar.gz build/web[0m
a build/web
a build/web/index.html
a build/web/main.dart.js
a build/web/flutter.js
a build/web/assets/
[32m✓ Artifacts archived successfully[0m

[36mArtifacts:[0m
  - artifacts/app-release.apk (28.4MB)
  - artifacts/Runner.app (45.2MB)
  - artifacts/web-build.tar.gz (2.1MB)
"#
    .to_string()
}

/// Generate demo GitHub App status.
pub fn generate_demo_github_status() -> GitHubAppStatus {
    GitHubAppStatus {
        configured: true,
        app_id: Some(123456),
        app_name: Some(DEMO_GITHUB_APP_NAME.to_string()),
        app_slug: Some("demo-oore-ci".to_string()),
        owner_login: Some("demo-org".to_string()),
        owner_type: Some("Organization".to_string()),
        html_url: Some("https://github.com/apps/demo-oore-ci".to_string()),
        installations_count: 2,
    }
}

/// Generate demo GitLab credentials status.
pub fn generate_demo_gitlab_statuses() -> Vec<GitLabCredentialsStatus> {
    vec![
        GitLabCredentialsStatus {
            id: "01JFRP0000DEMOGITLAB001".to_string(),
            configured: true,
            instance_url: Some("https://gitlab.com".to_string()),
            username: Some("demo-user".to_string()),
            user_id: Some(12345),
            token_expires_at: Some((Utc::now() + Duration::days(30)).to_rfc3339()),
            needs_refresh: false,
            enabled_projects_count: 5,
        },
    ]
}
