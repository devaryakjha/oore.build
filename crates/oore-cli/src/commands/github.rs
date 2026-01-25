//! GitHub App management commands.

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Subcommand)]
pub enum GitHubCommands {
    /// Initiate GitHub App setup via manifest flow
    Setup,

    /// Complete GitHub App setup with callback URL
    Callback {
        /// Full redirect URL from GitHub (includes code and state)
        redirect_url: String,
    },

    /// Show current GitHub App configuration
    Status,

    /// List GitHub App installations
    Installations,

    /// Sync installations and repositories from GitHub
    Sync,

    /// Remove GitHub App credentials
    Remove {
        /// Confirm removal
        #[arg(long)]
        force: bool,
    },
}

#[derive(Deserialize)]
struct ManifestResponse {
    create_url: String,
    #[allow(dead_code)]
    state: String,
}

#[derive(Deserialize)]
struct GitHubAppStatus {
    configured: bool,
    app_id: Option<i64>,
    app_name: Option<String>,
    app_slug: Option<String>,
    owner_login: Option<String>,
    owner_type: Option<String>,
    html_url: Option<String>,
    installations_count: usize,
}

#[derive(Deserialize)]
struct InstallationsResponse {
    installations: Vec<InstallationInfo>,
}

#[derive(Deserialize)]
struct InstallationInfo {
    installation_id: i64,
    account_login: String,
    account_type: String,
    repository_selection: String,
    is_active: bool,
}

#[derive(Deserialize)]
struct SyncResponse {
    message: String,
    installations_synced: usize,
    repositories_synced: usize,
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

fn create_client(server: &str, admin_token: &str) -> Result<reqwest::Client> {
    // Validate server URL scheme when using admin token
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

pub async fn handle_github_command(server: &str, admin_token: &str, cmd: GitHubCommands) -> Result<()> {
    match cmd {
        GitHubCommands::Setup => setup(server, admin_token).await,
        GitHubCommands::Callback { redirect_url } => callback(server, admin_token, &redirect_url).await,
        GitHubCommands::Status => status(server, admin_token).await,
        GitHubCommands::Installations => installations(server, admin_token).await,
        GitHubCommands::Sync => sync(server, admin_token).await,
        GitHubCommands::Remove { force } => remove(server, admin_token, force).await,
    }
}

async fn setup(server: &str, admin_token: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/github/manifest", server);
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

    let manifest: ManifestResponse = response.json().await.context("Failed to parse response")?;

    println!("GitHub App Setup");
    println!("================");
    println!();
    println!("Open this URL in your browser to create the GitHub App:");
    println!();
    println!("  {}", manifest.create_url);
    println!();
    println!("After creating the app, GitHub will redirect you to a callback URL.");
    println!("Copy the FULL redirect URL and run:");
    println!();
    println!("  oore github callback \"<REDIRECT_URL>\"");
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

    // Always send to the preconfigured server, never to the URL from user input
    let api_url = format!("{}/api/github/callback", server);
    let request = CallbackRequest { code, state };

    let response = client
        .post(&api_url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    let status: GitHubAppStatus = response.json().await.context("Failed to parse response")?;

    println!("GitHub App configured successfully!");
    println!();
    print_status(&status);

    Ok(())
}

async fn status(server: &str, admin_token: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/github/app", server);
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

    let status: GitHubAppStatus = response.json().await.context("Failed to parse response")?;

    print_status(&status);

    Ok(())
}

fn print_status(status: &GitHubAppStatus) {
    if !status.configured {
        println!("GitHub App: Not configured");
        println!();
        println!("Run 'oore github setup' to create a GitHub App.");
        return;
    }

    println!("GitHub App: Configured");
    println!();
    println!("  App ID:         {}", status.app_id.unwrap_or(0));
    println!("  Name:           {}", status.app_name.as_deref().unwrap_or("-"));
    println!("  Slug:           {}", status.app_slug.as_deref().unwrap_or("-"));
    println!("  Owner:          {} ({})",
        status.owner_login.as_deref().unwrap_or("-"),
        status.owner_type.as_deref().unwrap_or("-")
    );
    println!("  URL:            {}", status.html_url.as_deref().unwrap_or("-"));
    println!("  Installations:  {}", status.installations_count);
}

async fn installations(server: &str, admin_token: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/github/installations", server);
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

    let resp: InstallationsResponse = response.json().await.context("Failed to parse response")?;

    if resp.installations.is_empty() {
        println!("No installations found.");
        println!();
        println!("Install the GitHub App on a user or organization to see installations here.");
        return Ok(());
    }

    println!("GitHub App Installations");
    println!("========================");
    println!();
    println!("{:<12} {:<20} {:<15} {:<10} {:<8}",
        "ID", "ACCOUNT", "TYPE", "REPOS", "ACTIVE"
    );
    println!("{}", "-".repeat(70));

    for inst in &resp.installations {
        println!("{:<12} {:<20} {:<15} {:<10} {:<8}",
            inst.installation_id,
            inst.account_login,
            inst.account_type,
            inst.repository_selection,
            if inst.is_active { "Yes" } else { "No" }
        );
    }

    Ok(())
}

async fn sync(server: &str, admin_token: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    println!("Syncing GitHub installations and repositories...");

    let url = format!("{}/api/github/sync", server);
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

    let resp: SyncResponse = response.json().await.context("Failed to parse response")?;

    println!();
    println!("{}", resp.message);
    println!("  Installations synced: {}", resp.installations_synced);
    println!("  Repositories synced:  {}", resp.repositories_synced);

    Ok(())
}

async fn remove(server: &str, admin_token: &str, force: bool) -> Result<()> {
    if !force {
        bail!("Use --force to confirm removal of GitHub App credentials");
    }

    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/github/app?force=true", server);
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("GitHub App credentials removed successfully.");
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}: {}", error.error.code, error.error.message);
    }

    Ok(())
}
