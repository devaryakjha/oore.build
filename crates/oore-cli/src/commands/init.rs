//! `oore init` command for local development setup.

use anyhow::{Context, Result};
use clap::Args;
use rand::RngCore;
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Initialize local development environment
#[derive(Args)]
pub struct InitArgs {
    /// Base URL for webhooks (no trailing slash)
    #[arg(long, default_value = "http://localhost:8080")]
    base_url: String,

    /// Full database URL
    #[arg(long, default_value = "sqlite:oore.db")]
    database_url: String,

    /// Overwrite ALL existing values (DESTRUCTIVE - regenerates keys!)
    #[arg(long)]
    force: bool,

    /// Print what would be written without creating file
    #[arg(long)]
    dry_run: bool,
}

/// Environment variable entry with metadata
struct EnvEntry {
    key: &'static str,
    value: String,
    comment: Option<&'static str>,
}

/// Generate a random hex string of specified byte length (output will be 2x bytes in chars)
fn generate_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(&buf)
}

/// Generate a random base64 string of specified byte length
fn generate_base64(bytes: usize) -> String {
    use base64::Engine;
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::STANDARD.encode(&buf)
}

/// Parse existing .env file into a HashMap
fn parse_env_file(path: &Path) -> Result<HashMap<String, String>> {
    let mut map = HashMap::new();

    if !path.exists() {
        return Ok(map);
    }

    let file = fs::File::open(path).context("Failed to open .env file")?;
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
            // Remove surrounding quotes if present
            let value = value.trim();
            let value = if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value[1..value.len() - 1].to_string()
            } else {
                value.to_string()
            };
            map.insert(key, value);
        }
    }

    Ok(map)
}

/// Ensure .env is in .gitignore
fn ensure_gitignore(dry_run: bool) -> Result<bool> {
    let gitignore_path = Path::new(".gitignore");

    // Check if .env is already in .gitignore
    if gitignore_path.exists() {
        let content = fs::read_to_string(gitignore_path).context("Failed to read .gitignore")?;
        for line in content.lines() {
            let line = line.trim();
            if line == ".env" || line == ".env*" || line == "*.env" {
                return Ok(false); // Already present
            }
        }
    }

    if dry_run {
        return Ok(true); // Would add
    }

    // Append .env to .gitignore
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(gitignore_path)
        .context("Failed to open .gitignore")?;

    // Add newline before if file exists and doesn't end with newline
    if gitignore_path.exists() {
        let content = fs::read_to_string(gitignore_path).unwrap_or_default();
        if !content.is_empty() && !content.ends_with('\n') {
            writeln!(file)?;
        }
    }

    writeln!(file, ".env")?;

    Ok(true)
}

/// Set file permissions to 0600 (owner read/write only)
#[cfg(unix)]
fn set_secure_permissions(path: &Path) -> Result<()> {
    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions).context("Failed to set file permissions")?;
    Ok(())
}

#[cfg(not(unix))]
fn set_secure_permissions(_path: &Path) -> Result<()> {
    // On non-Unix systems, we can't set permissions the same way
    // Just succeed silently
    Ok(())
}

pub fn handle_init_command(args: InitArgs) -> Result<()> {
    let env_path = Path::new(".env");
    let existing = parse_env_file(env_path)?;

    // Normalize base URL (remove trailing slash)
    let base_url = args.base_url.trim_end_matches('/').to_string();

    // Determine which values to use (existing vs generated)
    let get_value = |key: &str, generate: fn() -> String| -> String {
        if args.force {
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
            value: if args.force || !existing.contains_key("DATABASE_URL") {
                args.database_url.clone()
            } else {
                existing.get("DATABASE_URL").cloned().unwrap_or(args.database_url.clone())
            },
            comment: None,
        },
        EnvEntry {
            key: "OORE_BASE_URL",
            value: if args.force || !existing.contains_key("OORE_BASE_URL") {
                base_url.clone()
            } else {
                existing.get("OORE_BASE_URL").cloned().unwrap_or(base_url.clone())
            },
            comment: None,
        },
        EnvEntry {
            key: "OORE_DEV_MODE",
            value: if args.force || !existing.contains_key("OORE_DEV_MODE") {
                "true".to_string()
            } else {
                existing.get("OORE_DEV_MODE").cloned().unwrap_or("true".to_string())
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
    content.push_str("# Oore Development Environment\n");
    content.push_str("# Generated by: oore init\n");
    content.push_str("# WARNING: DO NOT COMMIT THIS FILE - contains secrets!\n");
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
    if args.dry_run {
        println!("Dry run - would create .env with:");
        println!("─────────────────────────────────────");
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
        println!("─────────────────────────────────────");

        let would_add_gitignore = ensure_gitignore(true)?;
        if would_add_gitignore {
            println!("Would add .env to .gitignore");
        } else {
            println!(".env already in .gitignore");
        }

        return Ok(());
    }

    // Check if file exists and we're not forcing
    let file_existed = env_path.exists();
    let keys_preserved: Vec<&str> = if file_existed && !args.force {
        entries
            .iter()
            .filter(|e| existing.contains_key(e.key))
            .map(|e| e.key)
            .collect()
    } else {
        vec![]
    };

    // Write the file
    fs::write(env_path, &content).context("Failed to write .env file")?;

    // Set secure permissions
    set_secure_permissions(env_path)?;

    // Update .gitignore
    let added_to_gitignore = ensure_gitignore(false)?;

    // Print results
    if file_existed {
        if args.force {
            println!("✓ Regenerated .env file (--force: all keys regenerated)");
        } else if keys_preserved.is_empty() {
            println!("✓ Created .env file with secure defaults");
        } else {
            println!("✓ Updated .env file (preserved existing keys)");
        }
    } else {
        println!("✓ Created .env file with secure defaults");
    }

    if added_to_gitignore {
        println!("✓ Added .env to .gitignore");
    }

    println!();
    println!("To start developing:");
    println!("  Terminal 1: cargo run -p oore-server");
    println!("  Terminal 2: cargo run -p oore-cli -- setup");
    println!();
    println!("Secrets are saved in .env (use --dry-run to preview)");

    Ok(())
}
