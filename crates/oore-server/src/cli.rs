use clap::{Parser, Subcommand};
use std::path::PathBuf;

/// Oore CI/CD Server - Self-hosted Flutter build automation
#[derive(Parser, Debug)]
#[command(name = "oored")]
#[command(version = oore_core::VERSION)]
#[command(about = "Oore CI/CD Server daemon", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug, Default)]
pub enum Commands {
    /// Run server in foreground (default if no command given)
    #[default]
    Run,

    /// Install as system service (requires root/sudo)
    Install {
        /// Environment file path (default: /etc/oore/oore.env)
        #[arg(long)]
        env_file: Option<PathBuf>,

        /// Force reinstall even if already installed
        #[arg(long, short)]
        force: bool,
    },

    /// Uninstall system service (requires root/sudo)
    Uninstall {
        /// Also remove data, logs, and configuration
        #[arg(long)]
        purge: bool,
    },

    /// Start the service (requires root/sudo on macOS)
    Start,

    /// Stop the service (requires root/sudo on macOS)
    Stop,

    /// Restart the service (requires root/sudo on macOS)
    Restart,

    /// Show service status
    Status,

    /// View service logs
    Logs {
        /// Number of lines to show
        #[arg(short = 'n', long, default_value = "50")]
        lines: usize,

        /// Follow log output (tail -f)
        #[arg(short, long)]
        follow: bool,
    },
}
