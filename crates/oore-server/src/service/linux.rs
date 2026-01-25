//! Linux systemd service management

use anyhow::{bail, Context, Result};
use std::path::Path;
use std::process::Command;

use super::{ServicePaths, ServiceStatus, SERVICE_USER};

/// Generate systemd unit file content
fn generate_unit(paths: &ServicePaths) -> String {
    format!(
        r#"[Unit]
Description=Oore CI/CD Server
Documentation=https://github.com/devaryakjha/oore.build
After=network.target

[Service]
Type=simple
User={user}
Group={user}
ExecStart={binary} run
WorkingDirectory={data_dir}
EnvironmentFile={env_file}
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths={data_dir} {log_dir}

# Resource limits
LimitNOFILE=65536

# Logging
StandardOutput=append:{log_file}
StandardError=append:{log_file}

[Install]
WantedBy=multi-user.target
"#,
        user = SERVICE_USER,
        binary = paths.binary.display(),
        data_dir = paths.data_dir.display(),
        env_file = paths.env_file.display(),
        log_dir = paths.log_dir.display(),
        log_file = paths.log_file.display(),
    )
}

/// Write the systemd unit file
pub fn write_unit(paths: &ServicePaths) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let content = generate_unit(paths);
    std::fs::write(&paths.service_file, content)
        .with_context(|| format!("Failed to write unit file to {}", paths.service_file.display()))?;

    // Set proper permissions (644)
    std::fs::set_permissions(&paths.service_file, std::fs::Permissions::from_mode(0o644))?;

    // Reload systemd
    Command::new("systemctl")
        .args(["daemon-reload"])
        .status()?;

    Ok(())
}

/// Write logrotate configuration
pub fn write_logrotate_config(paths: &ServicePaths) -> Result<()> {
    let content = format!(
        r#"{}/*.log {{
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    create 640 {} {}
}}
"#,
        paths.log_dir.display(),
        SERVICE_USER,
        SERVICE_USER,
    );

    std::fs::write(&paths.logrotate_config, content)?;
    Ok(())
}

/// Create the service user on Linux
pub fn create_user() -> Result<()> {
    // Check if user already exists
    let output = Command::new("id")
        .arg(SERVICE_USER)
        .output()?;

    if output.status.success() {
        bail!("User {} already exists", SERVICE_USER);
    }

    // Create system user
    let status = Command::new("useradd")
        .args([
            "--system",
            "--no-create-home",
            "--shell",
            "/usr/sbin/nologin",
            "--comment",
            "Oore CI/CD Service",
            SERVICE_USER,
        ])
        .status()
        .context("Failed to create service user")?;

    if !status.success() {
        bail!("Failed to create user {}", SERVICE_USER);
    }

    Ok(())
}

/// Change ownership of a path to the service user
pub fn chown_to_service_user(path: &Path) -> Result<()> {
    Command::new("chown")
        .args(["-R", &format!("{}:{}", SERVICE_USER, SERVICE_USER)])
        .arg(path)
        .status()
        .with_context(|| format!("Failed to chown {}", path.display()))?;
    Ok(())
}

/// Change group ownership of a path to the service user
pub fn chgrp_to_service_user(path: &Path) -> Result<()> {
    Command::new("chgrp")
        .arg(SERVICE_USER)
        .arg(path)
        .status()
        .with_context(|| format!("Failed to chgrp {}", path.display()))?;
    Ok(())
}

/// Enable the systemd service
pub fn enable_service() -> Result<()> {
    let status = Command::new("systemctl")
        .args(["enable", "oored.service"])
        .status()?;

    if !status.success() {
        bail!("Failed to enable service");
    }
    Ok(())
}

/// Disable the systemd service
pub fn disable_service() -> Result<()> {
    let _ = Command::new("systemctl")
        .args(["disable", "oored.service"])
        .status();
    Ok(())
}

/// Start the systemd service
pub fn start_service() -> Result<()> {
    let status = Command::new("systemctl")
        .args(["start", "oored.service"])
        .status()?;

    if !status.success() {
        bail!("Failed to start service");
    }
    Ok(())
}

/// Stop the systemd service
pub fn stop_service() -> Result<()> {
    let _ = Command::new("systemctl")
        .args(["stop", "oored.service"])
        .status();
    Ok(())
}

/// Get service status
pub fn get_status(paths: &ServicePaths) -> Result<ServiceStatus> {
    let installed = paths.service_file.exists();

    if !installed {
        return Ok(ServiceStatus {
            installed: false,
            running: false,
            pid: None,
            binary_path: None,
            log_path: None,
            needs_root_for_details: false,
        });
    }

    // Check if service is running
    let output = Command::new("systemctl")
        .args(["is-active", "oored.service"])
        .output()?;

    let running = output.status.success();

    // Get PID if running
    let pid = if running {
        let output = Command::new("systemctl")
            .args(["show", "oored.service", "--property=MainPID", "--value"])
            .output()?;

        String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<u32>()
            .ok()
            .filter(|&pid| pid > 0)
    } else {
        None
    };

    Ok(ServiceStatus {
        installed,
        running,
        pid,
        binary_path: if paths.binary.exists() {
            Some(paths.binary.clone())
        } else {
            None
        },
        log_path: Some(paths.log_file.clone()),
        needs_root_for_details: false,
    })
}

/// View service logs
pub fn view_logs(paths: &ServicePaths, lines: usize, follow: bool) -> Result<()> {
    // First try journalctl (if logging to journal)
    let mut cmd = Command::new("journalctl");
    cmd.args(["--unit=oored.service", "--no-pager"]);

    if follow {
        cmd.arg("--follow");
    }

    cmd.args(["--lines", &lines.to_string()]);

    let output = cmd.output()?;

    // If journalctl has output, use it
    if output.status.success() && !output.stdout.is_empty() {
        print!("{}", String::from_utf8_lossy(&output.stdout));
        return Ok(());
    }

    // Fall back to log file
    if !paths.log_file.exists() {
        println!("No log file found at {}", paths.log_file.display());
        println!("The service may not have been started yet.");
        return Ok(());
    }

    let mut cmd = Command::new("tail");

    if follow {
        cmd.arg("-f");
    }

    cmd.args(["-n", &lines.to_string()]);
    cmd.arg(&paths.log_file);

    let status = cmd.status()?;

    if !status.success() {
        bail!("Failed to view logs");
    }

    Ok(())
}
