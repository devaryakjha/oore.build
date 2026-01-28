//! Build execution infrastructure.
//!
//! Provides the trait for build execution and a shell-based implementation.

use async_trait::async_trait;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::watch;

use crate::error::{OoreError, Result};

/// Result of executing a single step.
#[derive(Debug)]
pub struct StepResult {
    /// Exit code of the process (0 = success).
    pub exit_code: i32,
    /// Path to stdout log file.
    pub stdout_path: PathBuf,
    /// Path to stderr log file.
    pub stderr_path: PathBuf,
    /// Number of lines written to stdout.
    pub stdout_lines: i32,
    /// Number of lines written to stderr.
    pub stderr_lines: i32,
}

/// Build execution limits configuration.
#[derive(Debug, Clone)]
pub struct BuildLimits {
    /// Maximum build duration in seconds (default: 3600 = 1 hour).
    pub max_build_duration_secs: u64,
    /// Maximum step duration in seconds (default: 1800 = 30 min).
    pub max_step_duration_secs: u64,
    /// Maximum log file size in bytes (default: 50MB).
    pub max_log_size_bytes: u64,
    /// Maximum concurrent builds (default: 2).
    pub max_concurrent_builds: usize,
    /// Workspace retention in hours (default: 24).
    pub workspace_retention_hours: u64,
}

impl Default for BuildLimits {
    fn default() -> Self {
        Self {
            max_build_duration_secs: 3600,
            max_step_duration_secs: 1800,
            max_log_size_bytes: 50 * 1024 * 1024,
            max_concurrent_builds: 2,
            workspace_retention_hours: 24,
        }
    }
}

impl BuildLimits {
    /// Loads limits from environment variables with defaults.
    pub fn from_env() -> Self {
        let mut limits = Self::default();

        if let Ok(val) = std::env::var("OORE_MAX_BUILD_DURATION_SECS") {
            if let Ok(v) = val.parse() {
                limits.max_build_duration_secs = v;
            }
        }

        if let Ok(val) = std::env::var("OORE_MAX_STEP_DURATION_SECS") {
            if let Ok(v) = val.parse() {
                limits.max_step_duration_secs = v;
            }
        }

        if let Ok(val) = std::env::var("OORE_MAX_LOG_SIZE_BYTES") {
            if let Ok(v) = val.parse() {
                limits.max_log_size_bytes = v;
            }
        }

        if let Ok(val) = std::env::var("OORE_MAX_CONCURRENT_BUILDS") {
            if let Ok(v) = val.parse() {
                limits.max_concurrent_builds = v;
            }
        }

        if let Ok(val) = std::env::var("OORE_WORKSPACE_RETENTION_HOURS") {
            if let Ok(v) = val.parse() {
                limits.workspace_retention_hours = v;
            }
        }

        limits
    }
}

/// Trait for build execution.
///
/// Implementations can be:
/// - ShellExecutor: Direct execution on host (current implementation)
/// - ContainerExecutor: Execution in Docker/Podman container (future)
/// - SandboxExecutor: Execution with additional isolation (future)
#[async_trait]
pub trait BuildExecutor: Send + Sync {
    /// Clones a repository to the workspace directory.
    ///
    /// # Arguments
    /// * `clone_url` - Git clone URL (HTTPS or SSH)
    /// * `commit_sha` - Specific commit to checkout
    /// * `workspace` - Target directory for the clone
    /// * `auth_token` - Optional authentication token (for private repos)
    async fn clone_repo(
        &self,
        clone_url: &str,
        commit_sha: &str,
        workspace: &Path,
        auth_token: Option<&str>,
    ) -> Result<()>;

    /// Executes a single script step.
    ///
    /// # Arguments
    /// * `workspace` - Working directory for script execution
    /// * `script` - Shell script to execute
    /// * `env` - Environment variables to set
    /// * `timeout_secs` - Maximum execution time in seconds
    /// * `log_dir` - Directory to write log files
    /// * `step_index` - Step index for log file naming
    /// * `cancel_rx` - Receiver for cancellation signal
    async fn execute_step(
        &self,
        workspace: &Path,
        script: &str,
        env: &HashMap<String, String>,
        timeout_secs: u64,
        log_dir: &Path,
        step_index: i32,
        cancel_rx: &mut watch::Receiver<bool>,
    ) -> Result<StepResult>;

    /// Cleans up the workspace directory.
    async fn cleanup(&self, workspace: &Path) -> Result<()>;
}

/// Shell-based build executor.
///
/// Executes scripts directly on the host using /bin/bash.
/// This is the simplest executor implementation.
///
/// **Security note**: Builds execute repository scripts with server privileges.
/// Only connect trusted repositories.
pub struct ShellExecutor {
    limits: BuildLimits,
}

impl ShellExecutor {
    /// Creates a new shell executor with default limits.
    pub fn new() -> Self {
        Self {
            limits: BuildLimits::from_env(),
        }
    }

    /// Creates a new shell executor with custom limits.
    pub fn with_limits(limits: BuildLimits) -> Self {
        Self { limits }
    }
}

impl Default for ShellExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BuildExecutor for ShellExecutor {
    async fn clone_repo(
        &self,
        clone_url: &str,
        commit_sha: &str,
        workspace: &Path,
        auth_token: Option<&str>,
    ) -> Result<()> {
        // Create workspace directory
        tokio::fs::create_dir_all(workspace).await?;

        // Build the clone URL with auth if provided
        let effective_url = if let Some(token) = auth_token {
            inject_token_into_url(clone_url, token)?
        } else {
            clone_url.to_string()
        };

        // Clone with partial clone for efficiency
        // Using --filter=blob:none fetches commits/trees immediately but defers blobs
        let clone_output = Command::new("git")
            .args([
                "clone",
                "--filter=blob:none",
                &effective_url,
                workspace.to_str().ok_or_else(|| {
                    OoreError::GitClone("Invalid workspace path".to_string())
                })?,
            ])
            .output()
            .await?;

        if !clone_output.status.success() {
            let stderr = String::from_utf8_lossy(&clone_output.stderr);
            // Sanitize error message to remove any auth tokens
            let sanitized = sanitize_git_error(&stderr);
            return Err(OoreError::GitClone(format!("Clone failed: {}", sanitized)));
        }

        // Fetch the specific commit (in case it's not in the initial clone)
        let fetch_output = Command::new("git")
            .current_dir(workspace)
            .args(["fetch", "origin", commit_sha])
            .output()
            .await?;

        // fetch may fail if commit is already present, that's OK
        if !fetch_output.status.success() {
            tracing::debug!(
                "git fetch for specific commit returned non-zero (may be OK): {}",
                String::from_utf8_lossy(&fetch_output.stderr)
            );
        }

        // Checkout the specific commit
        let checkout_output = Command::new("git")
            .current_dir(workspace)
            .args(["checkout", commit_sha])
            .output()
            .await?;

        if !checkout_output.status.success() {
            let stderr = String::from_utf8_lossy(&checkout_output.stderr);
            return Err(OoreError::GitClone(format!(
                "Checkout of {} failed: {}",
                &commit_sha[..7.min(commit_sha.len())],
                stderr
            )));
        }

        tracing::debug!(
            "Cloned repository to {} at commit {}",
            workspace.display(),
            &commit_sha[..7.min(commit_sha.len())]
        );

        Ok(())
    }

    async fn execute_step(
        &self,
        workspace: &Path,
        script: &str,
        env: &HashMap<String, String>,
        timeout_secs: u64,
        log_dir: &Path,
        step_index: i32,
        cancel_rx: &mut watch::Receiver<bool>,
    ) -> Result<StepResult> {
        // Ensure log directory exists
        tokio::fs::create_dir_all(log_dir).await?;

        // Create log files
        let stdout_path = log_dir.join(format!("step-{}-stdout.log", step_index));
        let stderr_path = log_dir.join(format!("step-{}-stderr.log", step_index));

        let stdout_file = tokio::fs::File::create(&stdout_path).await?;
        let stderr_file = tokio::fs::File::create(&stderr_path).await?;

        // Spawn the process
        let mut child = Command::new("/bin/bash")
            .arg("-c")
            .arg(script)
            .current_dir(workspace)
            .envs(env)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let child_stdout = child.stdout.take().unwrap();
        let child_stderr = child.stderr.take().unwrap();

        // Create writers for log files
        let mut stdout_writer = tokio::io::BufWriter::new(stdout_file);
        let mut stderr_writer = tokio::io::BufWriter::new(stderr_file);

        let stdout_lines: i32;
        let stderr_lines: i32;

        let timeout = std::time::Duration::from_secs(
            timeout_secs.min(self.limits.max_step_duration_secs),
        );

        // Stream output to files in background tasks
        let max_bytes = self.limits.max_log_size_bytes;

        let stdout_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(child_stdout);
            let mut line = String::new();
            let mut bytes_written = 0u64;
            let mut lines = 0i32;

            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(n) => {
                        bytes_written += n as u64;
                        if bytes_written <= max_bytes {
                            use tokio::io::AsyncWriteExt;
                            let _ = stdout_writer.write_all(line.as_bytes()).await;
                            lines += 1;
                        }
                    }
                    Err(_) => break,
                }
            }
            use tokio::io::AsyncWriteExt;
            let _ = stdout_writer.flush().await;
            lines
        });

        let stderr_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(child_stderr);
            let mut line = String::new();
            let mut bytes_written = 0u64;
            let mut lines = 0i32;

            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(n) => {
                        bytes_written += n as u64;
                        if bytes_written <= max_bytes {
                            use tokio::io::AsyncWriteExt;
                            let _ = stderr_writer.write_all(line.as_bytes()).await;
                            lines += 1;
                        }
                    }
                    Err(_) => break,
                }
            }
            use tokio::io::AsyncWriteExt;
            let _ = stderr_writer.flush().await;
            lines
        });

        // Wait for process with timeout and cancellation
        let wait_result = tokio::select! {
            _ = tokio::time::sleep(timeout) => {
                // Timeout - kill the process
                let _ = child.kill().await;
                Err(OoreError::BuildTimeout(format!(
                    "Step exceeded timeout of {} seconds",
                    timeout_secs
                )))
            }
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    // Cancellation requested - kill the process
                    let _ = child.kill().await;
                    Err(OoreError::BuildCancelled)
                } else {
                    // False alarm, wait for process
                    match child.wait().await {
                        Ok(status) => Ok(status),
                        Err(e) => Err(OoreError::Io(e)),
                    }
                }
            }
            status = child.wait() => {
                match status {
                    Ok(s) => Ok(s),
                    Err(e) => Err(OoreError::Io(e)),
                }
            }
        };

        // Wait for output handlers to finish
        stdout_lines = stdout_handle.await.unwrap_or(0);
        stderr_lines = stderr_handle.await.unwrap_or(0);

        match wait_result {
            Ok(status) => {
                Ok(StepResult {
                    exit_code: status.code().unwrap_or(-1),
                    stdout_path,
                    stderr_path,
                    stdout_lines,
                    stderr_lines,
                })
            }
            Err(e) => Err(e),
        }
    }

    async fn cleanup(&self, workspace: &Path) -> Result<()> {
        if workspace.exists() {
            tokio::fs::remove_dir_all(workspace).await?;
            tracing::debug!("Cleaned up workspace: {}", workspace.display());
        }
        Ok(())
    }
}

/// Injects an auth token into a git URL.
///
/// For HTTPS URLs: `https://token@github.com/...`
/// For SSH URLs: Returns unchanged (SSH uses keys)
fn inject_token_into_url(url: &str, token: &str) -> Result<String> {
    if url.starts_with("https://") {
        // Parse and reconstruct with token
        let without_scheme = &url[8..];
        Ok(format!("https://x-access-token:{}@{}", token, without_scheme))
    } else if url.starts_with("http://") {
        // Don't inject token into plain HTTP (insecure)
        tracing::warn!("Refusing to inject token into insecure HTTP URL");
        Ok(url.to_string())
    } else {
        // SSH or other protocol - return unchanged
        Ok(url.to_string())
    }
}

/// Sanitizes git error messages to remove potential auth tokens.
fn sanitize_git_error(error: &str) -> String {
    // Remove anything that looks like a token in URLs
    let re = regex_lite::Regex::new(r"(https?://)[^@]+@").unwrap_or_else(|_| {
        regex_lite::Regex::new(r"$^").unwrap() // Never matches
    });
    re.replace_all(error, "$1***@").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_token_https() {
        let url = "https://github.com/user/repo.git";
        let result = inject_token_into_url(url, "my_token").unwrap();
        assert_eq!(result, "https://x-access-token:my_token@github.com/user/repo.git");
    }

    #[test]
    fn test_inject_token_ssh() {
        let url = "git@github.com:user/repo.git";
        let result = inject_token_into_url(url, "my_token").unwrap();
        assert_eq!(result, url); // Unchanged
    }

    #[test]
    fn test_sanitize_git_error() {
        let error = "fatal: Authentication failed for 'https://token123@github.com/user/repo.git'";
        let sanitized = sanitize_git_error(error);
        assert!(!sanitized.contains("token123"));
        assert!(sanitized.contains("***@"));
    }

    #[test]
    fn test_build_limits_default() {
        let limits = BuildLimits::default();
        assert_eq!(limits.max_build_duration_secs, 3600);
        assert_eq!(limits.max_step_duration_secs, 1800);
        assert_eq!(limits.max_concurrent_builds, 2);
    }

    #[test]
    fn test_inject_token_gitlab_https() {
        let url = "https://gitlab.com/user/repo.git";
        let result = inject_token_into_url(url, "glpat-xxx").unwrap();
        assert_eq!(result, "https://x-access-token:glpat-xxx@gitlab.com/user/repo.git");
    }

    #[test]
    fn test_inject_token_http_refused() {
        let url = "http://insecure.example.com/repo.git";
        let result = inject_token_into_url(url, "secret").unwrap();
        // Should return unchanged (no token injection)
        assert_eq!(result, url);
    }

    #[test]
    fn test_inject_token_with_existing_auth() {
        let url = "https://olduser:oldpass@github.com/user/repo.git";
        let result = inject_token_into_url(url, "newtoken").unwrap();
        // Should prepend new token, but the URL will have double auth - this is expected behavior
        // Git will use the first credentials it finds
        assert!(result.starts_with("https://x-access-token:newtoken@"));
    }

    #[test]
    fn test_inject_token_file_protocol() {
        let url = "file:///path/to/repo";
        let result = inject_token_into_url(url, "token").unwrap();
        // File protocol unchanged
        assert_eq!(result, url);
    }

    #[test]
    fn test_sanitize_git_error_multiple_tokens() {
        let error = "Error: https://abc123@github.com and https://xyz789@gitlab.com both failed";
        let sanitized = sanitize_git_error(error);
        assert!(!sanitized.contains("abc123"));
        assert!(!sanitized.contains("xyz789"));
        assert_eq!(sanitized.matches("***@").count(), 2);
    }

    #[test]
    fn test_sanitize_git_error_no_token() {
        let error = "fatal: remote not found";
        let sanitized = sanitize_git_error(error);
        assert_eq!(sanitized, error);
    }

    #[test]
    fn test_sanitize_git_error_preserves_url_structure() {
        let error = "Cloning into 'repo'...\nfatal: https://secret123@github.com/user/repo.git not found";
        let sanitized = sanitize_git_error(error);
        assert!(sanitized.contains("https://***@github.com/user/repo.git"));
        assert!(sanitized.contains("Cloning into"));
    }

    #[test]
    fn test_build_limits_all_fields() {
        let limits = BuildLimits {
            max_build_duration_secs: 7200,
            max_step_duration_secs: 3600,
            max_log_size_bytes: 100 * 1024 * 1024,
            max_concurrent_builds: 4,
            workspace_retention_hours: 48,
        };
        assert_eq!(limits.max_build_duration_secs, 7200);
        assert_eq!(limits.max_step_duration_secs, 3600);
        assert_eq!(limits.max_log_size_bytes, 100 * 1024 * 1024);
        assert_eq!(limits.max_concurrent_builds, 4);
        assert_eq!(limits.workspace_retention_hours, 48);
    }

    #[test]
    fn test_shell_executor_new() {
        let executor = ShellExecutor::new();
        // Should use default limits from env (which will be defaults in test)
        assert!(executor.limits.max_build_duration_secs > 0);
    }

    #[test]
    fn test_shell_executor_with_limits() {
        let limits = BuildLimits {
            max_build_duration_secs: 100,
            max_step_duration_secs: 50,
            max_log_size_bytes: 1024,
            max_concurrent_builds: 1,
            workspace_retention_hours: 1,
        };
        let executor = ShellExecutor::with_limits(limits);
        assert_eq!(executor.limits.max_build_duration_secs, 100);
        assert_eq!(executor.limits.max_step_duration_secs, 50);
    }

    #[test]
    fn test_shell_executor_default() {
        let executor = ShellExecutor::default();
        // Default should be same as new()
        assert!(executor.limits.max_build_duration_secs > 0);
    }

    #[test]
    fn test_step_result_fields() {
        let result = StepResult {
            exit_code: 0,
            stdout_path: PathBuf::from("/tmp/stdout.log"),
            stderr_path: PathBuf::from("/tmp/stderr.log"),
            stdout_lines: 100,
            stderr_lines: 5,
        };
        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout_path, PathBuf::from("/tmp/stdout.log"));
        assert_eq!(result.stderr_path, PathBuf::from("/tmp/stderr.log"));
        assert_eq!(result.stdout_lines, 100);
        assert_eq!(result.stderr_lines, 5);
    }

    // Async tests for actual execution
    #[tokio::test]
    async fn test_execute_step_simple_command() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-workspace");
        let log_dir = std::env::temp_dir().join("oore-test-logs");

        // Create directories
        let _ = tokio::fs::create_dir_all(&workspace).await;
        let _ = tokio::fs::create_dir_all(&log_dir).await;

        let env = HashMap::new();
        let (_, mut cancel_rx) = tokio::sync::watch::channel(false);

        let result = executor
            .execute_step(
                &workspace,
                "echo 'Hello, World!'",
                &env,
                60,
                &log_dir,
                0,
                &mut cancel_rx,
            )
            .await;

        assert!(result.is_ok());
        let step_result = result.unwrap();
        assert_eq!(step_result.exit_code, 0);
        assert!(step_result.stdout_lines >= 1);

        // Clean up
        let _ = tokio::fs::remove_dir_all(&workspace).await;
        let _ = tokio::fs::remove_dir_all(&log_dir).await;
    }

    #[tokio::test]
    async fn test_execute_step_with_env_vars() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-workspace-env");
        let log_dir = std::env::temp_dir().join("oore-test-logs-env");

        let _ = tokio::fs::create_dir_all(&workspace).await;
        let _ = tokio::fs::create_dir_all(&log_dir).await;

        let mut env = HashMap::new();
        env.insert("MY_VAR".to_string(), "test_value".to_string());

        let (_, mut cancel_rx) = tokio::sync::watch::channel(false);

        let result = executor
            .execute_step(
                &workspace,
                "echo $MY_VAR",
                &env,
                60,
                &log_dir,
                0,
                &mut cancel_rx,
            )
            .await;

        assert!(result.is_ok());
        let step_result = result.unwrap();
        assert_eq!(step_result.exit_code, 0);

        // Check that the log contains the env var value
        let stdout_content = tokio::fs::read_to_string(&step_result.stdout_path).await.unwrap();
        assert!(stdout_content.contains("test_value"));

        // Clean up
        let _ = tokio::fs::remove_dir_all(&workspace).await;
        let _ = tokio::fs::remove_dir_all(&log_dir).await;
    }

    #[tokio::test]
    async fn test_execute_step_failing_command() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-workspace-fail");
        let log_dir = std::env::temp_dir().join("oore-test-logs-fail");

        let _ = tokio::fs::create_dir_all(&workspace).await;
        let _ = tokio::fs::create_dir_all(&log_dir).await;

        let env = HashMap::new();
        let (_, mut cancel_rx) = tokio::sync::watch::channel(false);

        let result = executor
            .execute_step(
                &workspace,
                "exit 1",
                &env,
                60,
                &log_dir,
                0,
                &mut cancel_rx,
            )
            .await;

        assert!(result.is_ok());
        let step_result = result.unwrap();
        assert_eq!(step_result.exit_code, 1);

        // Clean up
        let _ = tokio::fs::remove_dir_all(&workspace).await;
        let _ = tokio::fs::remove_dir_all(&log_dir).await;
    }

    #[tokio::test]
    async fn test_execute_step_stderr_output() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-workspace-stderr");
        let log_dir = std::env::temp_dir().join("oore-test-logs-stderr");

        let _ = tokio::fs::create_dir_all(&workspace).await;
        let _ = tokio::fs::create_dir_all(&log_dir).await;

        let env = HashMap::new();
        let (_, mut cancel_rx) = tokio::sync::watch::channel(false);

        let result = executor
            .execute_step(
                &workspace,
                "echo 'error message' >&2",
                &env,
                60,
                &log_dir,
                0,
                &mut cancel_rx,
            )
            .await;

        assert!(result.is_ok());
        let step_result = result.unwrap();
        assert_eq!(step_result.exit_code, 0);
        assert!(step_result.stderr_lines >= 1);

        // Check stderr content
        let stderr_content = tokio::fs::read_to_string(&step_result.stderr_path).await.unwrap();
        assert!(stderr_content.contains("error message"));

        // Clean up
        let _ = tokio::fs::remove_dir_all(&workspace).await;
        let _ = tokio::fs::remove_dir_all(&log_dir).await;
    }

    #[tokio::test]
    async fn test_execute_step_multiline_script() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-workspace-multiline");
        let log_dir = std::env::temp_dir().join("oore-test-logs-multiline");

        let _ = tokio::fs::create_dir_all(&workspace).await;
        let _ = tokio::fs::create_dir_all(&log_dir).await;

        let env = HashMap::new();
        let (_, mut cancel_rx) = tokio::sync::watch::channel(false);

        let script = r#"
echo "Line 1"
echo "Line 2"
echo "Line 3"
"#;

        let result = executor
            .execute_step(
                &workspace,
                script,
                &env,
                60,
                &log_dir,
                0,
                &mut cancel_rx,
            )
            .await;

        assert!(result.is_ok());
        let step_result = result.unwrap();
        assert_eq!(step_result.exit_code, 0);
        assert_eq!(step_result.stdout_lines, 3);

        // Clean up
        let _ = tokio::fs::remove_dir_all(&workspace).await;
        let _ = tokio::fs::remove_dir_all(&log_dir).await;
    }

    #[tokio::test]
    async fn test_cleanup_removes_directory() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-cleanup");

        // Create workspace with some content
        tokio::fs::create_dir_all(&workspace).await.unwrap();
        tokio::fs::write(workspace.join("test.txt"), "test content").await.unwrap();

        assert!(workspace.exists());

        // Cleanup
        executor.cleanup(&workspace).await.unwrap();

        assert!(!workspace.exists());
    }

    #[tokio::test]
    async fn test_cleanup_nonexistent_directory() {
        let executor = ShellExecutor::new();
        let workspace = std::env::temp_dir().join("oore-test-nonexistent-cleanup");

        // Directory doesn't exist
        assert!(!workspace.exists());

        // Cleanup should succeed without error
        let result = executor.cleanup(&workspace).await;
        assert!(result.is_ok());
    }
}
