use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde::Deserialize;

mod commands;
mod config;

use commands::{
    build::{handle_build_command, BuildCommands},
    config::{handle_config_command, ConfigCommands},
    github::{handle_github_command, GitHubCommands},
    gitlab::{handle_gitlab_command, GitLabCommands},
    pipeline::{handle_pipeline_command, PipelineCommands},
    repo::{handle_repo_command, RepoCommands},
    webhook::{handle_webhook_command, WebhookCommands},
};

#[derive(Parser)]
#[command(name = "oore")]
#[command(about = "CLI for the Oore CI/CD platform", long_about = None)]
struct Cli {
    /// Configuration profile to use
    #[arg(long, global = true)]
    profile: Option<String>,

    /// Server URL (overrides profile)
    #[arg(long, global = true)]
    server: Option<String>,

    /// Admin token for setup endpoints (overrides profile and env)
    #[arg(long, env = "OORE_ADMIN_TOKEN", global = true, hide_env_values = true)]
    admin_token: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check if the server is running
    Health,

    /// Show CLI and server version
    Version,

    /// Repository management
    #[command(subcommand)]
    Repo(RepoCommands),

    /// Webhook event management
    #[command(subcommand)]
    Webhook(WebhookCommands),

    /// Build management
    #[command(subcommand)]
    Build(BuildCommands),

    /// Pipeline configuration management
    #[command(subcommand)]
    Pipeline(PipelineCommands),

    /// GitHub App management
    #[command(subcommand)]
    Github(GitHubCommands),

    /// GitLab OAuth management
    #[command(subcommand)]
    Gitlab(GitLabCommands),

    /// Show setup status
    Setup,

    /// Manage CLI configuration
    #[command(subcommand)]
    Config(ConfigCommands),
}

#[derive(Deserialize)]
struct HealthResponse {
    status: String,
}

#[derive(Deserialize)]
struct VersionResponse {
    version: String,
    name: String,
}

#[derive(Deserialize)]
struct SetupStatusResponse {
    github: GitHubStatus,
    gitlab: Vec<GitLabStatus>,
    encryption_configured: bool,
    admin_token_configured: bool,
}

#[derive(Deserialize)]
struct GitHubStatus {
    configured: bool,
    app_name: Option<String>,
    installations_count: usize,
}

#[derive(Deserialize)]
struct GitLabStatus {
    configured: bool,
    instance_url: Option<String>,
    username: Option<String>,
    enabled_projects_count: usize,
}

async fn check_health(server: &str) -> Result<()> {
    let url = format!("{}/api/health", server);
    let response: HealthResponse = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    println!("Server status: {}", response.status);
    Ok(())
}

async fn get_version(server: &str) -> Result<()> {
    println!("CLI version: {}", oore_core::VERSION);

    let url = format!("{}/api/version", server);
    match reqwest::get(&url).await {
        Ok(resp) => {
            let version: VersionResponse = resp.json().await.context("Failed to parse response")?;
            println!("Server version: {} ({})", version.version, version.name);
        }
        Err(_) => {
            println!("Server: not reachable");
        }
    }

    Ok(())
}

async fn get_setup_status(server: &str, admin_token: &str) -> Result<()> {
    let client = reqwest::Client::new();

    let url = format!("{}/api/setup/status", server);
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Failed to get setup status ({}): {}", status, body);
    }

    let status: SetupStatusResponse = response.json().await.context("Failed to parse response")?;

    println!("Oore Setup Status");
    println!("==================");
    println!();
    println!("Server Configuration:");
    println!("  Encryption key: {}", if status.encryption_configured { "Configured" } else { "Not set" });
    println!("  Admin token:    {}", if status.admin_token_configured { "Configured" } else { "Not set" });
    println!();

    println!("GitHub App:");
    if status.github.configured {
        println!("  Status:        Configured");
        if let Some(name) = &status.github.app_name {
            println!("  App name:      {}", name);
        }
        println!("  Installations: {}", status.github.installations_count);
    } else {
        println!("  Status:        Not configured");
        println!("  Run 'oore github setup' to create a GitHub App");
    }
    println!();

    println!("GitLab OAuth:");
    if status.gitlab.is_empty() {
        println!("  Status:        Not configured");
        println!("  Run 'oore gitlab connect' to set up GitLab OAuth");
    } else {
        for gitlab in &status.gitlab {
            if gitlab.configured {
                println!("  Instance:      {}", gitlab.instance_url.as_deref().unwrap_or("-"));
                println!("  Username:      {}", gitlab.username.as_deref().unwrap_or("-"));
                println!("  Projects:      {} enabled", gitlab.enabled_projects_count);
                println!();
            }
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file if present (doesn't override existing env vars)
    let _ = dotenvy::dotenv();

    // Initialize tracing for better error context
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    // Config commands don't need server connection, handle separately
    if let Commands::Config(cmd) = cli.command {
        return handle_config_command(cmd);
    }

    // Load and resolve configuration
    let file_config = config::load_config()
        .unwrap_or_else(|e| {
            eprintln!("Warning: Failed to load config file: {}", e);
            None
        });

    let resolved = config::resolve_config(
        cli.profile.as_deref(),
        cli.server.as_deref(),
        cli.admin_token.as_deref(),
        file_config,
    )?;

    let server = &resolved.server;
    let admin_token = resolved.admin_token.as_deref().unwrap_or("");

    match cli.command {
        Commands::Health => check_health(server).await?,
        Commands::Version => get_version(server).await?,
        Commands::Repo(cmd) => handle_repo_command(server, cmd).await?,
        Commands::Webhook(cmd) => handle_webhook_command(server, cmd).await?,
        Commands::Build(cmd) => handle_build_command(server, cmd).await?,
        Commands::Pipeline(cmd) => handle_pipeline_command(server, cmd).await?,
        Commands::Github(cmd) => handle_github_command(server, admin_token, cmd).await?,
        Commands::Gitlab(cmd) => handle_gitlab_command(server, admin_token, cmd).await?,
        Commands::Setup => get_setup_status(server, admin_token).await?,
        Commands::Config(_) => unreachable!(), // Handled above
    }

    Ok(())
}
