//! macOS launchd service management

use anyhow::{bail, Context, Result};
use std::path::Path;
use std::process::{Command, Output};

use super::{ServicePaths, ServiceStatus, SERVICE_NAME, SERVICE_USER};

/// Run a launchctl command and return output, showing errors
fn run_launchctl(args: &[&str]) -> Result<Output> {
    let output = Command::new("launchctl")
        .args(args)
        .output()
        .context("Failed to run launchctl")?;

    Ok(output)
}

/// Check if the service is currently loaded in launchd
fn is_service_loaded() -> bool {
    // Try modern command first
    let output = Command::new("launchctl")
        .args(["print", &format!("system/{}", SERVICE_NAME)])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            return true;
        }
    }

    // Try legacy command
    let output = Command::new("launchctl")
        .args(["list", SERVICE_NAME])
        .output();

    matches!(output, Ok(out) if out.status.success())
}

/// Generate launchd plist content
/// Note: Runs as root like cloudflared and most system daemons.
/// A dedicated user can be added later if needed.
fn generate_plist(paths: &ServicePaths) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{service_name}</string>

    <key>ProgramArguments</key>
    <array>
        <string>{binary}</string>
        <string>run</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>OORE_ENV_FILE</key>
        <string>{env_file}</string>
    </dict>

    <key>WorkingDirectory</key>
    <string>{data_dir}</string>

    <key>StandardOutPath</key>
    <string>{log_file}</string>

    <key>StandardErrorPath</key>
    <string>{log_file}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>5</integer>

    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>65536</integer>
    </dict>

    <key>HardResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>65536</integer>
    </dict>
</dict>
</plist>
"#,
        service_name = SERVICE_NAME,
        binary = paths.binary.display(),
        env_file = paths.env_file.display(),
        data_dir = paths.data_dir.display(),
        log_file = paths.log_file.display(),
    )
}

/// Write the launchd plist file
pub fn write_plist(paths: &ServicePaths) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let content = generate_plist(paths);
    std::fs::write(&paths.service_file, content)
        .with_context(|| format!("Failed to write plist to {}", paths.service_file.display()))?;

    // Set proper permissions (644)
    std::fs::set_permissions(&paths.service_file, std::fs::Permissions::from_mode(0o644))?;

    Ok(())
}

/// Write newsyslog configuration for log rotation
pub fn write_newsyslog_config(paths: &ServicePaths) -> Result<()> {
    // Ensure the newsyslog.d directory exists
    let parent = paths.logrotate_config.parent().unwrap();
    if !parent.exists() {
        std::fs::create_dir_all(parent)?;
    }

    let content = format!(
        r#"# Oore server log rotation
# logfilename                              [owner:group]  mode count size when  flags [/pid_file] [sig_num]
{}  root:wheel      644  14    *    $D0   J
"#,
        paths.log_file.display(),
    );

    std::fs::write(&paths.logrotate_config, content)?;
    Ok(())
}

/// Run a dscl command and check it succeeded
fn run_dscl(args: &[&str]) -> Result<()> {
    let output = Command::new("dscl")
        .args(args)
        .output()
        .context("Failed to run dscl")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("dscl {:?} failed: {}", args, stderr.trim());
    }
    Ok(())
}

/// Check if a group has a valid PrimaryGroupID
fn group_has_gid(group: &str) -> bool {
    Command::new("dscl")
        .args([".", "-read", &format!("/Groups/{}", group), "PrimaryGroupID"])
        .output()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false)
}

/// Create the service user on macOS
pub fn create_user() -> Result<()> {
    // Check if user already exists
    let user_exists = Command::new("dscl")
        .args([".", "-read", &format!("/Users/{}", SERVICE_USER)])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    // Check if group exists AND has a valid GID
    let group_exists = Command::new("dscl")
        .args([".", "-read", &format!("/Groups/{}", SERVICE_USER)])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let group_valid = group_exists && group_has_gid(SERVICE_USER);

    if user_exists && group_valid {
        // Both exist and are valid
        bail!("User {} already exists", SERVICE_USER);
    }

    // Find an available UID/GID
    let uid = if user_exists {
        // Get existing UID
        let output = Command::new("dscl")
            .args([".", "-read", &format!("/Users/{}", SERVICE_USER), "UniqueID"])
            .output()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .split_whitespace()
            .last()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or_else(|| find_available_id().unwrap_or(450))
    } else {
        find_available_id()?
    };
    let gid = uid; // Use same value for GID
    let gid_str = gid.to_string();

    // Delete broken group if it exists but has no GID
    if group_exists && !group_valid {
        let _ = Command::new("dscl")
            .args([".", "-delete", &format!("/Groups/{}", SERVICE_USER)])
            .status();
    }

    // Create group if it doesn't exist or was broken
    if !group_valid {
        run_dscl(&[".", "-create", &format!("/Groups/{}", SERVICE_USER)])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Groups/{}", SERVICE_USER),
            "PrimaryGroupID",
            &gid_str,
        ])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Groups/{}", SERVICE_USER),
            "Password",
            "*",
        ])?;
    }

    // Create user if it doesn't exist
    if !user_exists {
        run_dscl(&[".", "-create", &format!("/Users/{}", SERVICE_USER)])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Users/{}", SERVICE_USER),
            "UniqueID",
            &gid_str,
        ])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Users/{}", SERVICE_USER),
            "PrimaryGroupID",
            &gid_str,
        ])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Users/{}", SERVICE_USER),
            "UserShell",
            "/usr/bin/false",
        ])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Users/{}", SERVICE_USER),
            "RealName",
            "Oore CI/CD Service",
        ])?;
        run_dscl(&[
            ".",
            "-create",
            &format!("/Users/{}", SERVICE_USER),
            "NFSHomeDirectory",
            "/var/lib/oore",
        ])?;
        // Hide user from login window
        run_dscl(&[
            ".",
            "-create",
            &format!("/Users/{}", SERVICE_USER),
            "IsHidden",
            "1",
        ])?;
    }

    Ok(())
}

/// Find an available UID/GID pair that's not used by any user or group
fn find_available_id() -> Result<u32> {
    // Start at 450 to avoid common system IDs (400 is often used by Apple)
    for id in 450..550 {
        let id_str = id.to_string();

        // Check if UID is in use
        let uid_check = Command::new("dscl")
            .args([".", "-search", "/Users", "UniqueID", &id_str])
            .output()?;

        if !uid_check.stdout.is_empty() {
            continue;
        }

        // Check if GID is in use
        let gid_check = Command::new("dscl")
            .args([".", "-search", "/Groups", "PrimaryGroupID", &id_str])
            .output()?;

        if !gid_check.stdout.is_empty() {
            continue;
        }

        return Ok(id);
    }
    bail!("Could not find available UID/GID in range 450-550")
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

/// Load the launchd service (called during install)
pub fn load_service(paths: &ServicePaths) -> Result<()> {
    let plist_path = paths.service_file.to_str().unwrap();

    // Try modern bootstrap command first (macOS 10.10+)
    let output = Command::new("launchctl")
        .args(["bootstrap", "system", plist_path])
        .output()
        .context("Failed to run launchctl bootstrap")?;

    if output.status.success() {
        return Ok(());
    }

    // Check if already loaded (error 37 = already loaded)
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("already loaded") || stderr.contains("37:") || stderr.contains("service already loaded") {
        return Ok(());
    }

    // Fall back to legacy load command
    let status = Command::new("launchctl")
        .args(["load", "-w", plist_path])
        .status()
        .context("Failed to run launchctl load")?;

    if !status.success() {
        bail!("Failed to load service. Try: sudo launchctl load -w {}", plist_path);
    }

    Ok(())
}

/// Unload the launchd service (called during uninstall)
pub fn unload_service(paths: &ServicePaths) -> Result<()> {
    let service_target = format!("system/{}", SERVICE_NAME);

    // Try modern bootout command first
    let output = run_launchctl(&["bootout", &service_target])?;

    if output.status.success() {
        return Ok(());
    }

    // Fall back to legacy unload command
    let plist_path = paths.service_file.to_str().unwrap();
    let _ = run_launchctl(&["unload", "-w", plist_path]);

    Ok(())
}

/// Start the launchd service
pub fn start_service(paths: &ServicePaths) -> Result<()> {
    let service_target = format!("system/{}", SERVICE_NAME);

    // First, ensure the service is loaded
    if !is_service_loaded() {
        load_service(paths)?;
        // Give launchd a moment to load the service
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    // Use kickstart to start (or restart if crashed)
    // -k flag kills existing instance first if running
    // -p flag prints the PID
    let status = Command::new("launchctl")
        .args(["kickstart", "-kp", &service_target])
        .status()
        .context("Failed to run launchctl kickstart")?;

    if status.success() {
        // Verify service is running
        std::thread::sleep(std::time::Duration::from_millis(500));
        let status = get_status(paths)?;
        if status.running {
            return Ok(());
        }
        // Service started but immediately exited - check logs
        bail!("Service started but exited immediately. Check logs: oored logs");
    }

    // Try legacy start command
    let status = Command::new("launchctl")
        .args(["start", SERVICE_NAME])
        .status()
        .context("Failed to run launchctl start")?;

    if !status.success() {
        bail!("Failed to start service. Check logs: oored logs");
    }

    Ok(())
}

/// Stop the launchd service
pub fn stop_service(_paths: &ServicePaths) -> Result<()> {
    let service_target = format!("system/{}", SERVICE_NAME);

    // Try to send SIGTERM via launchctl kill
    let output = run_launchctl(&["kill", "SIGTERM", &service_target])?;

    if output.status.success() {
        return Ok(());
    }

    // Fall back to legacy stop command
    let output = run_launchctl(&["stop", SERVICE_NAME])?;

    // Stop might fail if not running, which is fine
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Only error if it's not "service not loaded" type error
        if !stderr.contains("Could not find service") && !stderr.is_empty() {
            // Log but don't fail - service might just not be running
            eprintln!("Note: {}", stderr.trim());
        }
    }

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

    let service_target = format!("system/{}", SERVICE_NAME);

    // Check if service is running via launchctl print
    let output = run_launchctl(&["print", &service_target])?;

    let (running, pid, needs_root) = if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);

        // Check for "state = running" in output
        let running = stdout.contains("state = running");

        // Try to extract PID from "pid = 12345" line
        let pid = stdout
            .lines()
            .find(|line| line.contains("pid ="))
            .and_then(|line| {
                line.split('=')
                    .nth(1)
                    .and_then(|s| s.trim().parse::<u32>().ok())
            });

        (running, pid, false)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Check if failure is due to permissions
        if stderr.contains("Could not find service")
            || stderr.contains("Operation not permitted")
            || stderr.contains("Permission denied")
        {
            // Try legacy list command which might work without root
            let output = run_launchctl(&["list", SERVICE_NAME])?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Format: PID\tStatus\tLabel
                let parts: Vec<&str> = stdout.split_whitespace().collect();
                let pid = parts.first().and_then(|s| s.parse::<u32>().ok());
                (pid.is_some() && pid != Some(0), pid.filter(|&p| p != 0), false)
            } else {
                // Can't determine status without root
                (false, None, true)
            }
        } else {
            (false, None, false)
        }
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
        needs_root_for_details: needs_root,
    })
}

/// View service logs
pub fn view_logs(paths: &ServicePaths, lines: usize, follow: bool) -> Result<()> {
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
