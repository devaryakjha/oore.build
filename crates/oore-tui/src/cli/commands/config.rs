//! Configuration command handlers.

use anyhow::{bail, Result};
use std::fs;

use crate::cli::args::ConfigCommands;
use crate::cli::output::{print_key_value, print_success, print_warning};
use crate::shared::config::{config_dir, default_config_path, load_config, CliConfig};

/// Handle config subcommands.
pub fn handle_config_command(cmd: ConfigCommands) -> Result<()> {
    match cmd {
        ConfigCommands::Show => show_config(),
        ConfigCommands::Profiles => list_profiles(),
        ConfigCommands::Init { force } => init_config(force),
        ConfigCommands::Path => show_path(),
    }
}

fn show_config() -> Result<()> {
    let config = load_config()?;

    match config {
        Some(cfg) => {
            println!("Current configuration:");
            println!();
            print_key_value("Default profile", &cfg.default_profile);
            println!();

            if let Some(profile) = cfg.profiles.get(&cfg.default_profile) {
                println!("Active profile settings:");
                print_key_value("Server", &profile.server);
                print_key_value(
                    "Token",
                    if profile.token.is_some() {
                        "***configured***"
                    } else {
                        "not set"
                    },
                );
            }
        }
        None => {
            println!("No config file found.");
            println!("Using defaults: server=http://localhost:8080");
            println!();
            println!("Run 'oore config init' to create a config file.");
        }
    }

    Ok(())
}

fn list_profiles() -> Result<()> {
    let config = load_config()?;

    match config {
        Some(cfg) => {
            println!("Available profiles:");
            println!();

            for (name, profile) in &cfg.profiles {
                let is_default = name == &cfg.default_profile;
                let marker = if is_default { " (default)" } else { "" };
                println!("  {}{}", name, marker);
                println!("    Server: {}", profile.server);
                println!(
                    "    Token:  {}",
                    if profile.token.is_some() {
                        "configured"
                    } else {
                        "not set"
                    }
                );
                println!();
            }
        }
        None => {
            println!("No config file found.");
            println!("Run 'oore config init' to create a config file.");
        }
    }

    Ok(())
}

fn init_config(force: bool) -> Result<()> {
    let path = default_config_path()?;

    if path.exists() && !force {
        bail!(
            "Config file already exists at {}. Use --force to overwrite.",
            path.display()
        );
    }

    // Create config directory if it doesn't exist
    let dir = config_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }

    // Write default config
    let config = CliConfig::default();
    let content = huml_rs::serde::to_string(&config)?;
    fs::write(&path, content)?;

    // Set restrictive permissions on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms)?;
    }

    print_success(&format!("Created config file at {}", path.display()));
    println!();
    println!("Edit this file to add server URLs and tokens for your profiles.");

    if cfg!(unix) {
        print_warning("Config file permissions set to 600 (owner only).");
    }

    Ok(())
}

fn show_path() -> Result<()> {
    let path = default_config_path()?;
    println!("{}", path.display());
    Ok(())
}
