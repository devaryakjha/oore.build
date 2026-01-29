//! `oore config` commands for managing CLI configuration.

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use crate::config::{config_dir, default_config_path, load_config, CliConfig, Profile};

#[derive(Subcommand)]
pub enum ConfigCommands {
    /// Create a new config file with default settings
    Init {
        /// Server URL for the default profile
        #[arg(long)]
        server: Option<String>,

        /// Admin token for the default profile
        #[arg(long)]
        token: Option<String>,

        /// Overwrite existing config file
        #[arg(long)]
        force: bool,
    },

    /// Set profile values (creates profile if it doesn't exist)
    Set {
        /// Profile name to update (defaults to "default")
        #[arg(long, default_value = "default")]
        profile: String,

        /// Server URL
        #[arg(long)]
        server: Option<String>,

        /// Admin token
        #[arg(long)]
        token: Option<String>,

        /// Set this profile as the default
        #[arg(long)]
        default: bool,
    },

    /// Show current configuration
    Show {
        /// Show actual token values (by default tokens are masked)
        #[arg(long)]
        show_token: bool,
    },

    /// List all available profiles
    Profiles,

    /// Show config file path
    Path,
}

pub fn handle_config_command(cmd: ConfigCommands) -> Result<()> {
    match cmd {
        ConfigCommands::Init { server, token, force } => init_config(server, token, force),
        ConfigCommands::Set {
            profile,
            server,
            token,
            default,
        } => set_config(profile, server, token, default),
        ConfigCommands::Show { show_token } => show_config(show_token),
        ConfigCommands::Profiles => list_profiles(),
        ConfigCommands::Path => show_path(),
    }
}

/// Create a new config file.
fn init_config(server: Option<String>, token: Option<String>, force: bool) -> Result<()> {
    let config_path = default_config_path()?;
    let dir = config_dir()?;

    // Check if file already exists
    if config_path.exists() && !force {
        bail!(
            "Config file already exists at {}. Use --force to overwrite.",
            config_path.display()
        );
    }

    // Create config directory if needed
    if !dir.exists() {
        fs::create_dir_all(&dir).with_context(|| format!("Failed to create {}", dir.display()))?;
        #[cfg(unix)]
        {
            let permissions = fs::Permissions::from_mode(0o700);
            fs::set_permissions(&dir, permissions)?;
        }
    }

    // Build config
    let server_url = server.unwrap_or_else(|| "http://localhost:8080".to_string());
    let mut profiles = HashMap::new();
    profiles.insert(
        "default".to_string(),
        Profile {
            server: server_url,
            token,
        },
    );

    let config = CliConfig {
        default_profile: "default".to_string(),
        profiles,
    };

    // Write config file
    write_config(&config_path, &config)?;

    println!("Created config file at {}", config_path.display());
    println!();
    println!("To add more profiles:");
    println!("  oore config set --profile work --server https://ci.company.com");
    println!();
    println!("To set a token:");
    println!("  oore config set --token <your-token>");

    Ok(())
}

/// Update profile values.
fn set_config(
    profile_name: String,
    server: Option<String>,
    token: Option<String>,
    set_default: bool,
) -> Result<()> {
    let config_path = default_config_path()?;

    // Load existing config or create new one
    let mut config = load_config()?.unwrap_or_else(|| {
        // If no config exists, create one
        CliConfig {
            default_profile: "default".to_string(),
            profiles: HashMap::new(),
        }
    });

    // Get or create profile
    let profile = config
        .profiles
        .entry(profile_name.clone())
        .or_insert_with(|| Profile {
            server: "http://localhost:8080".to_string(),
            token: None,
        });

    // Update values if provided
    let mut updated = false;
    if let Some(s) = server {
        profile.server = s;
        updated = true;
    }
    if let Some(t) = token {
        profile.token = Some(t);
        updated = true;
    }

    if set_default && config.default_profile != profile_name {
        config.default_profile = profile_name.clone();
        updated = true;
    }

    if !updated && !set_default {
        println!("No changes specified. Use --server, --token, or --default.");
        return Ok(());
    }

    // Ensure config directory exists
    let dir = config_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir).with_context(|| format!("Failed to create {}", dir.display()))?;
        #[cfg(unix)]
        {
            let permissions = fs::Permissions::from_mode(0o700);
            fs::set_permissions(&dir, permissions)?;
        }
    }

    // Write updated config
    write_config(&config_path, &config)?;

    println!("Updated profile '{}'", profile_name);
    if set_default {
        println!("Set '{}' as default profile", profile_name);
    }

    Ok(())
}

/// Display current configuration.
fn show_config(show_token: bool) -> Result<()> {
    let config_path = default_config_path()?;

    let config = match load_config()? {
        Some(c) => c,
        None => {
            println!("No config file found at {}", config_path.display());
            println!();
            println!("Using defaults:");
            println!("  Server: http://localhost:8080");
            println!();
            println!("Run 'oore config init' to create a config file.");
            return Ok(());
        }
    };

    println!("Config file: {}", config_path.display());
    println!("Default profile: {}", config.default_profile);
    println!();

    for (name, profile) in &config.profiles {
        let is_default = name == &config.default_profile;
        let marker = if is_default { " *" } else { "" };

        println!("[{}]{}", name, marker);
        println!("  Server: {}", profile.server);
        if let Some(ref token) = profile.token {
            if show_token {
                println!("  Token:  {}", token);
            } else {
                let masked = mask_token(token);
                println!("  Token:  {} (use --show-token to reveal)", masked);
            }
        } else {
            println!("  Token:  (not set)");
        }
        println!();
    }

    Ok(())
}

/// List all available profiles.
fn list_profiles() -> Result<()> {
    let config = match load_config()? {
        Some(c) => c,
        None => {
            println!("No config file found. Run 'oore config init' to create one.");
            return Ok(());
        }
    };

    println!("Available profiles:");
    for name in config.profiles.keys() {
        let is_default = name == &config.default_profile;
        if is_default {
            println!("  {} *", name);
        } else {
            println!("  {}", name);
        }
    }
    println!();
    println!("* = default profile");

    Ok(())
}

/// Show the config file path.
fn show_path() -> Result<()> {
    let config_path = default_config_path()?;
    println!("{}", config_path.display());

    if let Ok(env_path) = std::env::var("OORE_CONFIG") {
        println!();
        println!("Note: OORE_CONFIG is set to: {}", env_path);
    }

    Ok(())
}

/// Mask a token for display (show first 4 and last 4 characters).
/// Requires at least 12 characters to show partial content (ensuring 4+ masked in middle).
fn mask_token(token: &str) -> String {
    if token.len() < 12 {
        "*".repeat(token.len())
    } else {
        format!(
            "{}...{}",
            &token[..4],
            &token[token.len() - 4..]
        )
    }
}

/// Write config to file with proper HUML formatting and secure permissions.
fn write_config(path: &Path, config: &CliConfig) -> Result<()> {
    let content = serialize_to_huml(config);

    fs::write(path, &content).with_context(|| format!("Failed to write {}", path.display()))?;

    // Set secure permissions (owner read/write only)
    #[cfg(unix)]
    {
        let permissions = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, permissions)?;
    }

    Ok(())
}

/// Serialize config to HUML format.
///
/// huml-rs may not support serialization, so we manually generate HUML.
fn serialize_to_huml(config: &CliConfig) -> String {
    let mut output = String::new();

    output.push_str("%HUML v0.2.0\n");
    output.push_str(&format!("default_profile: \"{}\"\n", config.default_profile));
    output.push('\n');
    output.push_str("profiles::\n");

    // Sort profiles alphabetically for deterministic output
    let mut profile_names: Vec<_> = config.profiles.keys().collect();
    profile_names.sort();

    for name in profile_names {
        let profile = &config.profiles[name];
        output.push_str(&format!("  {}::\n", name));
        output.push_str(&format!("    server: \"{}\"\n", profile.server));
        if let Some(ref token) = profile.token {
            output.push_str(&format!("    token: \"{}\"\n", token));
        }
        output.push('\n');
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_token_short() {
        assert_eq!(mask_token("abc"), "***");
        assert_eq!(mask_token("abcdefgh"), "********");
        // 11 chars should still be fully masked
        assert_eq!(mask_token("abcdefghijk"), "***********");
    }

    #[test]
    fn test_mask_token_long() {
        // 12+ chars shows first 4 and last 4
        assert_eq!(mask_token("abcdefghijkl"), "abcd...ijkl");
        assert_eq!(
            mask_token("this-is-a-very-long-token-12345"),
            "this...2345"
        );
    }

    #[test]
    fn test_serialize_to_huml() {
        let mut profiles = HashMap::new();
        profiles.insert(
            "default".to_string(),
            Profile {
                server: "http://localhost:8080".to_string(),
                token: None,
            },
        );
        profiles.insert(
            "prod".to_string(),
            Profile {
                server: "https://prod.example.com".to_string(),
                token: Some("secret123".to_string()),
            },
        );

        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles,
        };

        let huml = serialize_to_huml(&config);

        assert!(huml.starts_with("%HUML v0.2.0\n"));
        assert!(huml.contains("default_profile: \"default\""));
        assert!(huml.contains("profiles::"));
        assert!(huml.contains("server: \"http://localhost:8080\""));
        assert!(huml.contains("server: \"https://prod.example.com\""));
        assert!(huml.contains("token: \"secret123\""));
    }
}
