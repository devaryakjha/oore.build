//! GitHub App management commands.

use std::time::{Duration, Instant};

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use console::style;
use indicatif::{ProgressBar, ProgressStyle};
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
    state: String,
}

#[derive(Deserialize)]
struct SetupStatusResponse {
    status: String,
    message: String,
    app_name: Option<String>,
    app_id: Option<i64>,
    #[allow(dead_code)]
    app_slug: Option<String>,
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

    // 1. Get manifest URL and state
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
    let state = manifest.state.clone();

    // 2. Open browser
    println!(
        "{} Opening browser for GitHub App creation...",
        style("->").color256(214)  // Amber arrow
    );
    println!();

    if let Err(e) = open::that(&manifest.create_url) {
        // Fallback: print URL if browser fails
        println!(
            "{} Could not open browser automatically: {}",
            style("!").yellow(),
            e
        );
        println!();
        println!("Please open this URL manually:");
        println!("  {}", style(&manifest.create_url).cyan().underlined());
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
    spinner.set_message("Waiting for GitHub App creation...");
    spinner.enable_steady_tick(Duration::from_millis(80));

    let timeout = Duration::from_secs(600);  // 10 minutes
    let start = Instant::now();

    loop {
        if start.elapsed() > timeout {
            spinner.finish_and_clear();
            println!("{} Timed out", style("x").red());
            bail!("Setup timed out after 10 minutes. Run 'oore github setup' to try again.");
        }

        // Poll status endpoint
        let status_url = format!("{}/api/github/setup/status?state={}", server, &state);
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
                                "{} GitHub App configured successfully!",
                                style("✓").green().bold()
                            );
                            println!();
                            print_setup_result(&status);
                            println!();
                            println!(
                                "  {}",
                                style("Complete the installation in your browser to select repositories.").dim()
                            );
                            println!(
                                "  {}",
                                style("Repositories will sync automatically via webhooks.").dim()
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
                            bail!("Setup session expired. Run 'oore github setup' to try again.");
                        }
                        "in_progress" => {
                            spinner.set_message("Processing GitHub callback...");
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
    if let Some(ref app_name) = status.app_name {
        println!(
            "  {} {}",
            style("Name:").dim(),
            style(app_name).color256(214)  // Amber
        );
    }
    if let Some(app_id) = status.app_id {
        println!("  {} {}", style("App ID:").dim(), app_id);
    }
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
