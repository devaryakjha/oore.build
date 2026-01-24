use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde::Deserialize;

#[derive(Parser)]
#[command(name = "oore")]
#[command(about = "CLI for the Oore CI/CD platform", long_about = None)]
struct Cli {
    /// Server URL
    #[arg(long, default_value = "http://localhost:8080", global = true)]
    server: String,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check if the server is running
    Health,
    /// Show CLI and server version
    Version,
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

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Health => check_health(&cli.server).await?,
        Commands::Version => get_version(&cli.server).await?,
    }

    Ok(())
}
