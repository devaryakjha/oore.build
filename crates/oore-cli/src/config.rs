//! CLI configuration loading and resolution.
//!
//! Supports profile-based configuration from `~/.oore/config.huml` with
//! priority order: CLI flags > environment variables > config file > defaults.

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// CLI configuration loaded from config.huml file.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CliConfig {
    /// Name of the default profile to use.
    pub default_profile: String,
    /// Map of profile name to profile configuration.
    pub profiles: HashMap<String, Profile>,
}

/// A named profile containing server connection settings.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Profile {
    /// Server URL (e.g., "https://my-mac.local:8080").
    pub server: String,
    /// Optional admin token for this server.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

/// Resolved configuration after applying priority rules.
#[derive(Debug, Clone)]
pub struct ResolvedConfig {
    /// Server URL to connect to.
    pub server: String,
    /// Admin token (if available).
    pub admin_token: Option<String>,
}

impl Default for CliConfig {
    fn default() -> Self {
        let mut profiles = HashMap::new();
        profiles.insert(
            "default".to_string(),
            Profile {
                server: "http://localhost:8080".to_string(),
                token: None,
            },
        );
        Self {
            default_profile: "default".to_string(),
            profiles,
        }
    }
}

/// Returns the default config file path (~/.oore/config.huml).
pub fn default_config_path() -> Result<PathBuf> {
    dirs::home_dir()
        .map(|h| h.join(".oore/config.huml"))
        .context("Could not determine home directory")
}

/// Returns the config directory path (~/.oore).
pub fn config_dir() -> Result<PathBuf> {
    dirs::home_dir()
        .map(|h| h.join(".oore"))
        .context("Could not determine home directory")
}

/// Load configuration from the config file.
///
/// Returns `Ok(None)` if the config file doesn't exist.
/// Returns an error if the file exists but is invalid.
pub fn load_config() -> Result<Option<CliConfig>> {
    let path = match std::env::var("OORE_CONFIG") {
        Ok(p) => PathBuf::from(p),
        Err(_) => default_config_path()?,
    };

    if !path.exists() {
        return Ok(None);
    }

    let content =
        std::fs::read_to_string(&path).with_context(|| format!("Failed to read {}", path.display()))?;

    let config: CliConfig = huml_rs::serde::from_str(&content)
        .with_context(|| format!("Invalid HUML in {}", path.display()))?;

    validate_config(&config)?;
    check_file_permissions(&path);

    Ok(Some(config))
}

/// Validate that the config has at least one profile and the default profile exists.
fn validate_config(config: &CliConfig) -> Result<()> {
    if config.profiles.is_empty() {
        bail!("Config file must contain at least one profile");
    }

    if !config.profiles.contains_key(&config.default_profile) {
        bail!(
            "Default profile '{}' not found in profiles",
            config.default_profile
        );
    }

    for (name, profile) in &config.profiles {
        if profile.server.is_empty() {
            bail!("Profile '{}' has an empty server URL", name);
        }
    }

    Ok(())
}

/// Warn if config file has overly permissive permissions (on Unix).
#[cfg(unix)]
fn check_file_permissions(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;

    if let Ok(metadata) = std::fs::metadata(path) {
        let mode = metadata.permissions().mode();
        // Check if group or others have any permissions
        if mode & 0o077 != 0 {
            eprintln!(
                "Warning: {} has overly permissive permissions ({:o}). Consider running: chmod 600 {}",
                path.display(),
                mode & 0o777,
                path.display()
            );
        }
    }
}

#[cfg(not(unix))]
fn check_file_permissions(_path: &std::path::Path) {
    // No permission check on non-Unix systems
}

/// Resolve configuration by applying priority rules.
///
/// Priority order (highest to lowest):
/// 1. CLI flags (`--server`, `--admin-token`)
/// 2. Environment variables (`OORE_ADMIN_TOKEN`)
/// 3. Config file profile
/// 4. Hardcoded defaults (`http://localhost:8080`)
pub fn resolve_config(
    profile_flag: Option<&str>,
    server_flag: Option<&str>,
    token_flag: Option<&str>,
    file_config: Option<CliConfig>,
) -> Result<ResolvedConfig> {
    let mut server = "http://localhost:8080".to_string();
    let mut token: Option<String> = None;

    // Apply config file (lowest priority)
    if let Some(config) = file_config {
        let profile_name = profile_flag.unwrap_or(&config.default_profile);
        if let Some(profile) = config.profiles.get(profile_name) {
            server = profile.server.clone();
            token = profile.token.clone();
        } else if profile_flag.is_some() {
            bail!(
                "Profile '{}' not found. Run 'oore config profiles' to see available profiles.",
                profile_name
            );
        }
    } else if let Some(requested_profile) = profile_flag {
        // User requested a specific profile but no config file exists
        if requested_profile != "default" {
            bail!(
                "Profile '{}' not found. No config file exists. Run 'oore config init' to create one.",
                requested_profile
            );
        }
    }

    // Apply environment variable (medium priority)
    if let Ok(env_token) = std::env::var("OORE_ADMIN_TOKEN") {
        token = Some(env_token);
    }

    // Apply CLI flags (highest priority)
    if let Some(s) = server_flag {
        server = s.to_string();
    }
    if let Some(t) = token_flag {
        token = Some(t.to_string());
    }

    Ok(ResolvedConfig {
        server,
        admin_token: token,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = CliConfig::default();
        assert_eq!(config.default_profile, "default");
        assert!(config.profiles.contains_key("default"));
        assert_eq!(
            config.profiles["default"].server,
            "http://localhost:8080"
        );
    }

    #[test]
    fn test_resolve_with_no_config() {
        let resolved = resolve_config(None, None, None, None).unwrap();
        assert_eq!(resolved.server, "http://localhost:8080");
        assert!(resolved.admin_token.is_none());
    }

    #[test]
    fn test_resolve_with_config_file() {
        let mut profiles = HashMap::new();
        profiles.insert(
            "default".to_string(),
            Profile {
                server: "https://my-server.com".to_string(),
                token: Some("secret-token".to_string()),
            },
        );
        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles,
        };

        let resolved = resolve_config(None, None, None, Some(config)).unwrap();
        assert_eq!(resolved.server, "https://my-server.com");
        assert_eq!(resolved.admin_token, Some("secret-token".to_string()));
    }

    #[test]
    fn test_resolve_cli_flags_override() {
        let mut profiles = HashMap::new();
        profiles.insert(
            "default".to_string(),
            Profile {
                server: "https://my-server.com".to_string(),
                token: Some("config-token".to_string()),
            },
        );
        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles,
        };

        let resolved = resolve_config(
            None,
            Some("https://override.com"),
            Some("cli-token"),
            Some(config),
        )
        .unwrap();

        assert_eq!(resolved.server, "https://override.com");
        assert_eq!(resolved.admin_token, Some("cli-token".to_string()));
    }

    #[test]
    fn test_resolve_profile_selection() {
        let mut profiles = HashMap::new();
        profiles.insert(
            "default".to_string(),
            Profile {
                server: "https://default.com".to_string(),
                token: None,
            },
        );
        profiles.insert(
            "work".to_string(),
            Profile {
                server: "https://work.com".to_string(),
                token: Some("work-token".to_string()),
            },
        );
        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles,
        };

        let resolved = resolve_config(Some("work"), None, None, Some(config)).unwrap();
        assert_eq!(resolved.server, "https://work.com");
        assert_eq!(resolved.admin_token, Some("work-token".to_string()));
    }

    #[test]
    fn test_resolve_nonexistent_profile_error() {
        let config = CliConfig::default();
        let result = resolve_config(Some("nonexistent"), None, None, Some(config));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    #[test]
    fn test_validate_empty_profiles() {
        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles: HashMap::new(),
        };
        let result = validate_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_missing_default_profile() {
        let mut profiles = HashMap::new();
        profiles.insert(
            "other".to_string(),
            Profile {
                server: "https://other.com".to_string(),
                token: None,
            },
        );
        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles,
        };
        let result = validate_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_empty_server_url() {
        let mut profiles = HashMap::new();
        profiles.insert(
            "default".to_string(),
            Profile {
                server: "".to_string(),
                token: None,
            },
        );
        let config = CliConfig {
            default_profile: "default".to_string(),
            profiles,
        };
        let result = validate_config(&config);
        assert!(result.is_err());
    }
}
