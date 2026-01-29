//! `oored init` command for server environment initialization.

use anyhow::{Context, Result};
use rand::RngCore;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Environment variable entry with metadata.
struct EnvEntry {
    key: &'static str,
    value: String,
    comment: Option<&'static str>,
}

/// Generate a random hex string of specified byte length (output will be 2x bytes in chars).
fn generate_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(&buf)
}

/// Generate a random base64 string of specified byte length.
fn generate_base64(bytes: usize) -> String {
    use base64::Engine;
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::STANDARD.encode(&buf)
}

/// Parse existing env file into a HashMap.
fn parse_env_file(path: &Path) -> Result<HashMap<String, String>> {
    let mut map = HashMap::new();

    if !path.exists() {
        return Ok(map);
    }

    let file = fs::File::open(path).context("Failed to open env file")?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = line.context("Failed to read line")?;
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse KEY=VALUE
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            // Remove surrounding quotes if present (must be matching pairs)
            let value = value.trim();
            let value = if value.len() >= 2 {
                let bytes = value.as_bytes();
                let first = bytes[0];
                let last = bytes[value.len() - 1];
                if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
                    value[1..value.len() - 1].to_string()
                } else {
                    value.to_string()
                }
            } else {
                value.to_string()
            };
            map.insert(key, value);
        }
    }

    Ok(map)
}

/// Set file permissions to 0600 (owner read/write only).
#[cfg(unix)]
fn set_secure_permissions(path: &Path) -> Result<()> {
    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions).context("Failed to set file permissions")?;
    Ok(())
}

#[cfg(not(unix))]
fn set_secure_permissions(_path: &Path) -> Result<()> {
    Ok(())
}

/// Handle the init command to create /etc/oore/oore.env.
pub fn handle_init(base_url: String, database_url: String, force: bool, dry_run: bool) -> Result<()> {
    let env_dir = Path::new("/etc/oore");
    let env_path = env_dir.join("oore.env");

    // Check for existing file
    if env_path.exists() && !force && !dry_run {
        anyhow::bail!(
            "Environment file already exists at {}. Use --force to overwrite.",
            env_path.display()
        );
    }

    let existing = parse_env_file(&env_path)?;

    // Normalize base URL (remove trailing slash)
    let base_url = base_url.trim_end_matches('/').to_string();

    // Determine which values to use (existing vs generated)
    let get_value = |key: &str, generate: fn() -> String| -> String {
        if force {
            generate()
        } else if let Some(existing_value) = existing.get(key) {
            existing_value.clone()
        } else {
            generate()
        }
    };

    // Build environment entries
    let entries = vec![
        EnvEntry {
            key: "DATABASE_URL",
            value: if force || !existing.contains_key("DATABASE_URL") {
                database_url.clone()
            } else {
                existing.get("DATABASE_URL").cloned().unwrap_or(database_url.clone())
            },
            comment: None,
        },
        EnvEntry {
            key: "OORE_BASE_URL",
            value: if force || !existing.contains_key("OORE_BASE_URL") {
                base_url.clone()
            } else {
                existing.get("OORE_BASE_URL").cloned().unwrap_or(base_url.clone())
            },
            comment: None,
        },
        EnvEntry {
            key: "OORE_ADMIN_TOKEN",
            value: get_value("OORE_ADMIN_TOKEN", || generate_hex(32)),
            comment: Some("Admin authentication (keep secret!)"),
        },
        EnvEntry {
            key: "ENCRYPTION_KEY",
            value: get_value("ENCRYPTION_KEY", || generate_base64(32)),
            comment: Some("Encryption key for stored OAuth credentials\n# WARNING: Changing this will make existing encrypted data unreadable!"),
        },
        EnvEntry {
            key: "GITLAB_SERVER_PEPPER",
            value: get_value("GITLAB_SERVER_PEPPER", || generate_hex(16)),
            comment: Some("GitLab webhook verification pepper\n# WARNING: Changing this will invalidate existing webhook configurations!"),
        },
    ];

    // Generate timestamp
    let timestamp = chrono::Utc::now().to_rfc3339();

    // Build file content
    let mut content = String::new();
    content.push_str("# Oore Server Environment\n");
    content.push_str("# Generated by: oored init\n");
    content.push_str("# WARNING: This file contains secrets - keep it secure!\n");
    content.push_str(&format!("# Generated at: {}\n", timestamp));
    content.push('\n');

    let mut prev_had_comment = false;
    for entry in &entries {
        if let Some(comment) = entry.comment {
            if !prev_had_comment {
                content.push('\n');
            }
            for line in comment.lines() {
                if line.starts_with('#') {
                    content.push_str(&format!("{}\n", line));
                } else {
                    content.push_str(&format!("# {}\n", line));
                }
            }
            prev_had_comment = true;
        } else {
            prev_had_comment = false;
        }
        content.push_str(&format!("{}={}\n", entry.key, entry.value));
    }

    // Handle dry run
    if dry_run {
        println!("Dry run - would create {} with:", env_path.display());
        println!("-------------------------------------------");
        // Print content with secrets masked
        for line in content.lines() {
            if line.contains("OORE_ADMIN_TOKEN=")
                || line.contains("ENCRYPTION_KEY=")
                || line.contains("GITLAB_SERVER_PEPPER=")
            {
                let (key, _) = line.split_once('=').unwrap();
                println!("{}=<generated>", key);
            } else {
                println!("{}", line);
            }
        }
        println!("-------------------------------------------");
        return Ok(());
    }

    // Check for root privileges on Unix
    #[cfg(unix)]
    {
        if unsafe { libc::geteuid() } != 0 {
            anyhow::bail!(
                "This command requires root privileges.\n\
                Run with: sudo oored init"
            );
        }
    }

    // Create directory if needed
    if !env_dir.exists() {
        fs::create_dir_all(env_dir).with_context(|| format!("Failed to create {}", env_dir.display()))?;
        #[cfg(unix)]
        {
            let permissions = fs::Permissions::from_mode(0o755);
            fs::set_permissions(env_dir, permissions)?;
        }
    }

    // Check if file exists and we're not forcing
    let file_existed = env_path.exists();
    let keys_preserved: Vec<&str> = if file_existed && !force {
        entries
            .iter()
            .filter(|e| existing.contains_key(e.key))
            .map(|e| e.key)
            .collect()
    } else {
        vec![]
    };

    // Write the file
    fs::write(&env_path, &content).with_context(|| format!("Failed to write {}", env_path.display()))?;

    // Set secure permissions
    set_secure_permissions(&env_path)?;

    // Print results
    if file_existed {
        if force {
            println!("Regenerated {} (--force: all keys regenerated)", env_path.display());
        } else if keys_preserved.is_empty() {
            println!("Created {} with secure defaults", env_path.display());
        } else {
            println!("Updated {} (preserved existing keys)", env_path.display());
        }
    } else {
        println!("Created {} with secure defaults", env_path.display());
    }

    println!();
    println!("Next steps:");
    println!("  1. Install the service: sudo oored install");
    println!("  2. Start the service:   sudo oored start");
    println!("  3. Check status:        oored status");

    Ok(())
}
