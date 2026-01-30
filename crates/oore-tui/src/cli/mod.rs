//! Non-interactive CLI mode.

pub mod args;
pub mod commands;
pub mod output;

use anyhow::Result;

use crate::shared::api::{HealthResponse, SetupStatusResponse, VersionResponse};
use crate::shared::client::OoreClient;
use args::Commands;

/// Run a CLI command and exit.
pub async fn run_command(client: &OoreClient, command: Commands) -> Result<()> {
    match command {
        Commands::Health => check_health(client).await,
        Commands::Version => get_version(client).await,
        Commands::Setup => get_setup_status(client).await,
        Commands::Repo(cmd) => commands::repo::handle_repo_command(client, cmd).await,
        Commands::Config(_) => unreachable!("Config commands handled in main.rs"),
    }
}

/// Check if the server is running.
async fn check_health(client: &OoreClient) -> Result<()> {
    let response: HealthResponse = client.get("/health").await?;
    println!("Server status: {}", response.status);
    Ok(())
}

/// Show CLI and server version.
async fn get_version(client: &OoreClient) -> Result<()> {
    println!("CLI version: {}", oore_core::VERSION);

    match client.get::<VersionResponse>("/version").await {
        Ok(version) => {
            println!("Server version: {} ({})", version.version, version.name);
        }
        Err(_) => {
            println!("Server: not reachable");
        }
    }

    Ok(())
}

/// Show setup status.
async fn get_setup_status(client: &OoreClient) -> Result<()> {
    let status: SetupStatusResponse = client.get("/setup/status").await?;

    println!("Oore Setup Status");
    println!("==================");
    println!();
    println!("Server Configuration:");
    println!(
        "  Encryption key: {}",
        if status.encryption_configured {
            "Configured"
        } else {
            "Not set"
        }
    );
    println!(
        "  Admin token:    {}",
        if status.admin_token_configured {
            "Configured"
        } else {
            "Not set"
        }
    );
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
                println!(
                    "  Instance:      {}",
                    gitlab.instance_url.as_deref().unwrap_or("-")
                );
                println!("  Username:      {}", gitlab.username.as_deref().unwrap_or("-"));
                println!("  Projects:      {} enabled", gitlab.enabled_projects_count);
                println!();
            }
        }
    }

    Ok(())
}
