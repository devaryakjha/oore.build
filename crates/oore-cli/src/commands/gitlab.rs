//! GitLab OAuth management commands.

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Subcommand)]
pub enum GitLabCommands {
    /// Initiate GitLab OAuth flow
    Connect {
        /// GitLab instance URL (default: https://gitlab.com)
        #[arg(long, default_value = "https://gitlab.com")]
        instance: String,

        /// Replace existing credentials for this instance
        #[arg(long)]
        replace: bool,
    },

    /// Complete GitLab OAuth with callback URL
    Callback {
        /// Full redirect URL from GitLab (includes code and state)
        redirect_url: String,
    },

    /// Show current GitLab credentials
    Status,

    /// List accessible GitLab projects
    Projects {
        /// GitLab instance URL
        #[arg(long, default_value = "https://gitlab.com")]
        instance: String,

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

        /// GitLab instance URL
        #[arg(long, default_value = "https://gitlab.com")]
        instance: String,
    },

    /// Disable CI for a GitLab project
    Disable {
        /// GitLab project ID
        project_id: i64,

        /// GitLab instance URL
        #[arg(long, default_value = "https://gitlab.com")]
        instance: String,
    },

    /// Refresh OAuth token
    Refresh {
        /// GitLab instance URL
        #[arg(long, default_value = "https://gitlab.com")]
        instance: String,
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
struct ConnectResponse {
    auth_url: String,
    instance_url: String,
    #[allow(dead_code)]
    state: String,
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
struct CallbackRequest {
    code: String,
    state: String,
}

#[derive(Serialize)]
struct ConnectRequest {
    instance_url: String,
    replace: bool,
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

pub async fn handle_gitlab_command(server: &str, admin_token: &str, cmd: GitLabCommands) -> Result<()> {
    match cmd {
        GitLabCommands::Connect { instance, replace } => connect(server, admin_token, &instance, replace).await,
        GitLabCommands::Callback { redirect_url } => callback(server, admin_token, &redirect_url).await,
        GitLabCommands::Status => status(server, admin_token).await,
        GitLabCommands::Projects { instance, page, per_page } => {
            projects(server, admin_token, &instance, page, per_page).await
        }
        GitLabCommands::Enable { project_id, instance } => {
            enable(server, admin_token, &instance, project_id).await
        }
        GitLabCommands::Disable { project_id, instance } => {
            disable(server, admin_token, &instance, project_id).await
        }
        GitLabCommands::Refresh { instance } => refresh(server, admin_token, &instance).await,
        GitLabCommands::Register { instance, client_id, client_secret } => {
            register(server, admin_token, &instance, &client_id, &client_secret).await
        }
        GitLabCommands::Remove { id, force } => remove(server, admin_token, &id, force).await,
    }
}

async fn connect(server: &str, admin_token: &str, instance: &str, replace: bool) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/gitlab/connect", server);
    let request = ConnectRequest {
        instance_url: instance.to_string(),
        replace,
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

    let resp: ConnectResponse = response.json().await.context("Failed to parse response")?;

    println!("GitLab OAuth Setup");
    println!("==================");
    println!();
    println!("Instance: {}", resp.instance_url);
    println!();
    println!("Open this URL in your browser to authorize:");
    println!();
    println!("  {}", resp.auth_url);
    println!();
    println!("After authorizing, GitLab will redirect you to a callback URL.");
    println!("Copy the FULL redirect URL and run:");
    println!();
    println!("  oore gitlab callback \"<REDIRECT_URL>\"");
    println!();

    Ok(())
}

async fn callback(server: &str, admin_token: &str, redirect_url: &str) -> Result<()> {
    // Parse URL to extract code and state - NEVER use the URL's host
    let url = Url::parse(redirect_url).context("Invalid redirect URL")?;

    let code = url
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .context("Missing 'code' parameter in redirect URL")?;

    let state = url
        .query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .context("Missing 'state' parameter in redirect URL")?;

    let client = create_client(server, admin_token)?;

    let api_url = format!("{}/api/gitlab/callback", server);
    let request = CallbackRequest { code, state };

    let response = client
        .post(&api_url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let status: GitLabCredentialsStatus = response.json().await.context("Failed to parse response")?;

    println!("GitLab OAuth connected successfully!");
    println!();
    print_credentials_status(&status);

    Ok(())
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
        println!("Run 'oore gitlab connect' to set up GitLab OAuth.");
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
    println!("You can now run 'oore gitlab connect --instance {}' to authenticate.", instance);

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
