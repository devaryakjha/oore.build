//! Oore TUI/CLI client.
//!
//! Provides both interactive TUI mode and non-interactive CLI commands.
//!
//! - No arguments: launches interactive TUI
//! - With subcommand: runs CLI command and exits

use anyhow::Result;
use clap::Parser;

mod cli;
mod shared;
mod tui;

use cli::args::{Cli, Commands};
use shared::config;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file if present (doesn't override existing env vars)
    let _ = dotenvy::dotenv();

    let cli = Cli::parse();

    // Config commands don't need server connection, handle separately
    if let Some(Commands::Config(cmd)) = &cli.command {
        return cli::commands::config::handle_config_command(cmd.clone());
    }

    // Load and resolve configuration
    let file_config = config::load_config().unwrap_or_else(|e| {
        eprintln!("Warning: Failed to load config file: {}", e);
        None
    });

    let resolved = config::resolve_config(
        cli.profile.as_deref(),
        cli.server.as_deref(),
        cli.admin_token.as_deref(),
        file_config,
    )?;

    // Create HTTP client
    let client = shared::client::OoreClient::new(resolved.server, resolved.admin_token);

    match cli.command {
        Some(cmd) => {
            // CLI mode: run command and exit
            cli::run_command(&client, cmd).await
        }
        None => {
            // TUI mode: launch interactive interface
            tui::run(client).await
        }
    }
}
