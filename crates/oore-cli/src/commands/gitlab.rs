//! GitLab OAuth management commands.

use std::time::{Duration, Instant};

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use console::style;
use indicatif::{ProgressBar, ProgressStyle};
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Subcommand)]
pub enum GitLabCommands {
    /// Set up GitLab OAuth (opens browser, polls for completion)
    Setup {
        /// GitLab instance URL (auto-detected if only one configured, defaults to gitlab.com for new setup)
        #[arg(long)]
        instance: Option<String>,
    },

    /// Show current GitLab credentials
    Status,

    /// List accessible GitLab projects
    Projects {
        /// GitLab instance URL (auto-detected if only one configured)
        #[arg(long)]
        instance: Option<String>,

        /// Page number
        #[arg(long, default_value = "1")]
        page: u32,

        /// Results per page
        #[arg(long, default_value = "20")]
        per_page: u32,
    },

    /// Enable CI for a GitLab project
    Enable {
        /// GitLab project ID
        project_id: i64,

        /// GitLab instance URL (auto-detected if only one configured)
        #[arg(long)]
        instance: Option<String>,
    },

    /// Disable CI for a GitLab project
    Disable {
        /// GitLab project ID
        project_id: i64,

        /// GitLab instance URL (auto-detected if only one configured)
        #[arg(long)]
        instance: Option<String>,
    },

    /// Refresh OAuth token
    Refresh {
        /// GitLab instance URL (auto-detected if only one configured)
        #[arg(long)]
        instance: Option<String>,
    },

    /// Register OAuth app for self-hosted GitLab
    Register {
        /// GitLab instance URL
        #[arg(long)]
        instance: String,

        /// OAuth app client ID
        #[arg(long)]
        client_id: String,

        /// OAuth app client secret
        #[arg(long)]
        client_secret: String,
    },

    /// Remove GitLab credentials
    Remove {
        /// Credentials ID to remove
        id: String,

        /// Confirm removal
        #[arg(long)]
        force: bool,
    },
}

#[derive(Deserialize)]
struct SetupResponse {
    auth_url: String,
    instance_url: String,
    state: String,
}

#[derive(Deserialize)]
struct SetupStatusResponse {
    status: String,
    message: String,
    instance_url: Option<String>,
    username: Option<String>,
}

#[derive(Deserialize)]
struct GitLabCredentialsStatus {
    configured: bool,
    instance_url: Option<String>,
    username: Option<String>,
    user_id: Option<i64>,
    token_expires_at: Option<String>,
    needs_refresh: bool,
    enabled_projects_count: usize,
}

#[derive(Deserialize)]
struct GitLabProjectInfo {
    id: i64,
    #[allow(dead_code)]
    name: String,
    path_with_namespace: String,
    #[allow(dead_code)]
    web_url: String,
    visibility: String,
    ci_enabled: bool,
}

#[derive(Deserialize)]
struct RefreshResponse {
    message: String,
    expires_at: Option<String>,
}

#[derive(Deserialize)]
struct RegisterResponse {
    message: String,
    instance_url: String,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: ErrorDetail,
}

#[derive(Deserialize)]
struct ErrorDetail {
    code: String,
    message: String,
}

#[derive(Serialize)]
struct SetupRequest {
    instance_url: String,
}

#[derive(Serialize)]
struct EnableRequest {
    instance_url: String,
}

#[derive(Serialize)]
struct RegisterRequest {
    instance_url: String,
    client_id: String,
    client_secret: String,
}

fn create_client(server: &str, admin_token: &str) -> Result<reqwest::Client> {
    let server_url = Url::parse(server).context("Invalid server URL")?;

    if !admin_token.is_empty() {
        let is_loopback = matches!(
            server_url.host_str(),
            Some("localhost") | Some("127.0.0.1") | Some("::1")
        );

        if server_url.scheme() != "https" && !is_loopback {
            bail!("Admin token requires HTTPS connection (except for localhost)");
        }
    }

    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .context("Failed to create HTTP client")
}

/// Resolves the GitLab instance URL, auto-detecting if only one is configured.
/// For setup command, defaults to gitlab.com if no instances configured.
async fn resolve_instance(
    server: &str,
    admin_token: &str,
    instance: Option<String>,
    is_setup: bool,
) -> Result<String> {
    // If explicitly provided, use it
    if let Some(inst) = instance {
        return Ok(inst);
    }

    // Fetch configured credentials
    let client = create_client(server, admin_token)?;
    let url = format!("{}/api/gitlab/credentials", server);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        // If we can't fetch credentials, fall back to gitlab.com for setup
        if is_setup {
            return Ok("https://gitlab.com".to_string());
        }
        bail!("Failed to fetch GitLab credentials. Specify --instance explicitly.");
    }

    let credentials: Vec<GitLabCredentialsStatus> = response
        .json()
        .await
        .context("Failed to parse credentials")?;

    match credentials.len() {
        0 => {
            if is_setup {
                // No instances configured, default to gitlab.com for new setup
                Ok("https://gitlab.com".to_string())
            } else {
                bail!("No GitLab instances configured. Run 'oore gitlab setup' first.");
            }
        }
        1 => {
            // Exactly one instance, auto-detect
            let instance_url = credentials[0]
                .instance_url
                .clone()
                .context("Credential missing instance URL")?;
            Ok(instance_url)
        }
        _ => {
            // Multiple instances, require explicit selection
            let instances: Vec<&str> = credentials
                .iter()
                .filter_map(|c| c.instance_url.as_deref())
                .collect();
            bail!(
                "Multiple GitLab instances configured. Specify --instance:\n  {}",
                instances.join("\n  ")
            );
        }
    }
}

pub async fn handle_gitlab_command(server: &str, admin_token: &str, cmd: GitLabCommands) -> Result<()> {
    match cmd {
        GitLabCommands::Setup { instance } => {
            let instance = resolve_instance(server, admin_token, instance, true).await?;
            setup(server, admin_token, &instance).await
        }
        GitLabCommands::Status => status(server, admin_token).await,
        GitLabCommands::Projects { instance, page, per_page } => {
            let instance = resolve_instance(server, admin_token, instance, false).await?;
            projects(server, admin_token, &instance, page, per_page).await
        }
        GitLabCommands::Enable { project_id, instance } => {
            let instance = resolve_instance(server, admin_token, instance, false).await?;
            enable(server, admin_token, &instance, project_id).await
        }
        GitLabCommands::Disable { project_id, instance } => {
            let instance = resolve_instance(server, admin_token, instance, false).await?;
            disable(server, admin_token, &instance, project_id).await
        }
        GitLabCommands::Refresh { instance } => {
            let instance = resolve_instance(server, admin_token, instance, false).await?;
            refresh(server, admin_token, &instance).await
        }
        GitLabCommands::Register { instance, client_id, client_secret } => {
            register(server, admin_token, &instance, &client_id, &client_secret).await
        }
        GitLabCommands::Remove { id, force } => remove(server, admin_token, &id, force).await,
    }
}

async fn setup(server: &str, admin_token: &str, instance: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    // 1. Get setup URL and state
    let url = format!("{}/api/gitlab/setup", server);
    let request = SetupRequest {
        instance_url: instance.to_string(),
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let setup_resp: SetupResponse = response.json().await.context("Failed to parse response")?;
    let state = setup_resp.state.clone();

    // 2. Open browser
    println!(
        "{} Opening browser for GitLab authorization...",
        style("->").color256(214)  // Amber arrow
    );
    println!();
    println!("  {} {}", style("Instance:").dim(), style(&setup_resp.instance_url).color256(214));
    println!();

    if let Err(e) = open::that(&setup_resp.auth_url) {
        // Fallback: print URL if browser fails
        println!(
            "{} Could not open browser automatically: {}",
            style("!").yellow(),
            e
        );
        println!();
        println!("Please open this URL manually:");
        println!("  {}", style(&setup_resp.auth_url).cyan().underlined());
        println!();
    }

    // 3. Poll for completion with branded spinner
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::default_spinner()
            .tick_chars("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏")
            .template("{spinner:.yellow} {msg}")
            .unwrap()
    );
    spinner.set_message("Waiting for GitLab authorization...");
    spinner.enable_steady_tick(Duration::from_millis(80));

    let timeout = Duration::from_secs(600);  // 10 minutes
    let start = Instant::now();

    loop {
        if start.elapsed() > timeout {
            spinner.finish_and_clear();
            println!("{} Timed out", style("x").red());
            bail!("Setup timed out after 10 minutes. Run 'oore gitlab setup' to try again.");
        }

        // Poll status endpoint (public - state token is authorization)
        let status_url = format!("{}/api/gitlab/setup/status?state={}", server, &state);
        let status_response = client
            .get(&status_url)
            .send()
            .await;

        match status_response {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(status) = resp.json::<SetupStatusResponse>().await {
                    match status.status.as_str() {
                        "completed" => {
                            spinner.finish_and_clear();
                            println!(
                                "{} GitLab OAuth connected successfully!",
                                style("✓").green().bold()
                            );
                            println!();
                            print_setup_result(&status);
                            println!();
                            println!(
                                "  {}",
                                style("Run 'oore gitlab projects' to list available projects.").dim()
                            );
                            println!(
                                "  {}",
                                style("Run 'oore gitlab enable <project_id>' to enable CI for a project.").dim()
                            );

                            return Ok(());
                        }
                        "failed" => {
                            spinner.finish_and_clear();
                            println!("{} Setup failed: {}", style("x").red(), status.message);
                            bail!("Setup failed: {}", status.message);
                        }
                        "expired" | "not_found" => {
                            spinner.finish_and_clear();
                            println!("{} Setup session expired", style("x").red());
                            bail!("Setup session expired. Run 'oore gitlab setup' to try again.");
                        }
                        "in_progress" => {
                            spinner.set_message("Processing GitLab authorization...");
                        }
                        _ => {
                            // pending - keep waiting
                        }
                    }
                }
            }
            Ok(_) => {
                // Non-success status, keep polling
            }
            Err(_) => {
                // Network error, keep polling
            }
        }

        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

fn print_setup_result(status: &SetupStatusResponse) {
    if let Some(ref instance_url) = status.instance_url {
        println!(
            "  {} {}",
            style("Instance:").dim(),
            style(instance_url).color256(214)  // Amber
        );
    }
    if let Some(ref username) = status.username {
        println!(
            "  {} {}",
            style("Username:").dim(),
            username
        );
    }
}

async fn status(server: &str, admin_token: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/gitlab/credentials", server);
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let statuses: Vec<GitLabCredentialsStatus> = response.json().await.context("Failed to parse response")?;

    if statuses.is_empty() {
        println!("GitLab: Not configured");
        println!();
        println!("Run 'oore gitlab setup' to set up GitLab OAuth.");
        return Ok(());
    }

    println!("GitLab Credentials");
    println!("==================");

    for status in &statuses {
        println!();
        print_credentials_status(status);
    }

    Ok(())
}

fn print_credentials_status(status: &GitLabCredentialsStatus) {
    if !status.configured {
        println!("Not configured");
        return;
    }

    println!("  Instance:         {}", status.instance_url.as_deref().unwrap_or("-"));
    println!("  Username:         {}", status.username.as_deref().unwrap_or("-"));
    println!("  User ID:          {}", status.user_id.map(|id| id.to_string()).unwrap_or_else(|| "-".to_string()));
    println!("  Token expires:    {}", status.token_expires_at.as_deref().unwrap_or("Never"));
    println!("  Needs refresh:    {}", if status.needs_refresh { "Yes" } else { "No" });
    println!("  Enabled projects: {}", status.enabled_projects_count);
}

async fn projects(server: &str, admin_token: &str, instance: &str, page: u32, per_page: u32) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/gitlab/projects?instance_url={}&page={}&per_page={}",
        server,
        urlencoding::encode(instance),
        page,
        per_page
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let projects: Vec<GitLabProjectInfo> = response.json().await.context("Failed to parse response")?;

    if projects.is_empty() {
        println!("No projects found.");
        return Ok(());
    }

    println!("GitLab Projects (page {})", page);
    println!("========================");
    println!();
    println!("{:<10} {:<40} {:<10} {:<10}",
        "ID", "PATH", "VISIBILITY", "CI"
    );
    println!("{}", "-".repeat(75));

    for project in &projects {
        println!("{:<10} {:<40} {:<10} {:<10}",
            project.id,
            if project.path_with_namespace.len() > 38 {
                format!("{}...", &project.path_with_namespace[..35])
            } else {
                project.path_with_namespace.clone()
            },
            project.visibility,
            if project.ci_enabled { "Enabled" } else { "-" }
        );
    }

    Ok(())
}

async fn enable(server: &str, admin_token: &str, instance: &str, project_id: i64) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/gitlab/projects/{}/enabled", server, project_id);
    let request = EnableRequest {
        instance_url: instance.to_string(),
    };

    let response = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let project: GitLabProjectInfo = response.json().await.context("Failed to parse response")?;

    println!("CI enabled for project: {} (ID: {})", project.path_with_namespace, project.id);

    Ok(())
}

async fn disable(server: &str, admin_token: &str, instance: &str, project_id: i64) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/gitlab/projects/{}/enabled?instance_url={}",
        server,
        project_id,
        urlencoding::encode(instance)
    );

    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("CI disabled for project ID: {}", project_id);
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    Ok(())
}

async fn refresh(server: &str, admin_token: &str, instance: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/gitlab/refresh?instance_url={}",
        server,
        urlencoding::encode(instance)
    );

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let resp: RefreshResponse = response.json().await.context("Failed to parse response")?;

    println!("{}", resp.message);
    if let Some(expires) = resp.expires_at {
        println!("New token expires at: {}", expires);
    }

    Ok(())
}

async fn register(
    server: &str,
    admin_token: &str,
    instance: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/gitlab/apps", server);
    let request = RegisterRequest {
        instance_url: instance.to_string(),
        client_id: client_id.to_string(),
        client_secret: client_secret.to_string(),
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let resp: RegisterResponse = response.json().await.context("Failed to parse response")?;

    println!("{}", resp.message);
    println!("Instance: {}", resp.instance_url);
    println!();
    println!("You can now run 'oore gitlab setup --instance {}' to authenticate.", instance);

    Ok(())
}

async fn remove(server: &str, admin_token: &str, id: &str, force: bool) -> Result<()> {
    if !force {
        bail!("Use --force to confirm removal of GitLab credentials");
    }

    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/gitlab/credentials/{}?force=true", server, id);
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("GitLab credentials removed successfully.");
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    Ok(())
}
