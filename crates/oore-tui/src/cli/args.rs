//! Command-line argument definitions.

use clap::{Parser, Subcommand};

/// Oore TUI/CLI client.
///
/// Run without arguments to launch interactive TUI mode.
/// Run with a subcommand for non-interactive CLI mode.
#[derive(Parser)]
#[command(name = "oore")]
#[command(about = "TUI/CLI for the Oore CI/CD platform", long_about = None)]
pub struct Cli {
    /// Configuration profile to use
    #[arg(long, global = true)]
    pub profile: Option<String>,

    /// Server URL (overrides profile)
    #[arg(long, global = true)]
    pub server: Option<String>,

    /// Admin token for setup endpoints (overrides profile and env)
    #[arg(long, env = "OORE_ADMIN_TOKEN", global = true, hide_env_values = true)]
    pub admin_token: Option<String>,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

/// Available commands.
#[derive(Subcommand, Clone)]
pub enum Commands {
    /// Check if the server is running
    Health,

    /// Show CLI and server version
    Version,

    /// Repository management
    #[command(subcommand)]
    Repo(RepoCommands),

    /// Show setup status
    Setup,

    /// Manage CLI configuration
    #[command(subcommand)]
    Config(ConfigCommands),
}

/// Repository subcommands.
#[derive(Subcommand, Clone)]
pub enum RepoCommands {
    /// List all repositories
    List,

    /// Add a new repository
    Add {
        /// Git provider (github or gitlab)
        #[arg(long)]
        provider: String,

        /// Repository owner (user or organization)
        #[arg(long)]
        owner: String,

        /// Repository name
        #[arg(long)]
        repo: String,

        /// Custom name for the repository
        #[arg(long)]
        name: Option<String>,

        /// Default branch
        #[arg(long, default_value = "main")]
        branch: String,

        /// Webhook secret (for GitLab)
        #[arg(long)]
        webhook_secret: Option<String>,

        /// GitHub repository ID (numeric)
        #[arg(long)]
        github_repo_id: Option<i64>,

        /// GitHub App installation ID
        #[arg(long)]
        github_installation_id: Option<i64>,

        /// GitLab project ID (numeric)
        #[arg(long)]
        gitlab_project_id: Option<i64>,
    },

    /// Show repository details
    Show {
        /// Repository ID
        id: String,
    },

    /// Remove a repository
    Remove {
        /// Repository ID
        id: String,
    },

    /// Get webhook URL for a repository
    WebhookUrl {
        /// Repository ID
        id: String,
    },
}

/// Configuration subcommands.
#[derive(Subcommand, Clone)]
pub enum ConfigCommands {
    /// Show current configuration
    Show,

    /// List available profiles
    Profiles,

    /// Initialize a new config file
    Init {
        /// Overwrite existing config file
        #[arg(long)]
        force: bool,
    },

    /// Show config file path
    Path,
}
