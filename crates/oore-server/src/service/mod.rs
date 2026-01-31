//! Service management for oored daemon.
//!
//! Supports installation as a system service on macOS (launchd).
//! Note: Linux is not supported - iOS builds require macOS.

use anyhow::{bail, Context, Result};
use std::path::PathBuf;

#[cfg(target_os = "macos")]
mod macos;

/// Service name identifier
pub const SERVICE_NAME: &str = "build.oore.oored";

/// Service user name (reserved for future use when running as dedicated user)
#[allow(dead_code)]
pub const SERVICE_USER: &str = "oore";

/// Paths for service installation
pub struct ServicePaths {
    /// Service definition file (plist)
    pub service_file: PathBuf,
    /// Binary installation path
    pub binary: PathBuf,
    /// Data directory
    pub data_dir: PathBuf,
    /// Log directory
    pub log_dir: PathBuf,
    /// Log file path
    pub log_file: PathBuf,
    /// Configuration directory
    pub config_dir: PathBuf,
    /// Environment file
    pub env_file: PathBuf,
    /// Log rotation config
    pub logrotate_config: PathBuf,
}

impl ServicePaths {
    #[cfg(target_os = "macos")]
    pub fn new() -> Self {
        Self {
            service_file: PathBuf::from("/Library/LaunchDaemons/build.oore.oored.plist"),
            binary: PathBuf::from("/usr/local/bin/oored"),
            data_dir: PathBuf::from("/var/lib/oore"),
            log_dir: PathBuf::from("/var/log/oore"),
            log_file: PathBuf::from("/var/log/oore/oored.log"),
            config_dir: PathBuf::from("/etc/oore"),
            env_file: PathBuf::from("/etc/oore/oore.env"),
            logrotate_config: PathBuf::from("/etc/newsyslog.d/oore.conf"),
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn new() -> Self {
        // Fallback for non-macOS (won't work but allows compilation)
        Self {
            service_file: PathBuf::from("/tmp/oored.plist"),
            binary: PathBuf::from("/usr/local/bin/oored"),
            data_dir: PathBuf::from("/var/lib/oore"),
            log_dir: PathBuf::from("/var/log/oore"),
            log_file: PathBuf::from("/var/log/oore/oored.log"),
            config_dir: PathBuf::from("/etc/oore"),
            env_file: PathBuf::from("/etc/oore/oore.env"),
            logrotate_config: PathBuf::from("/tmp/oore.conf"),
        }
    }
}

impl Default for ServicePaths {
    fn default() -> Self {
        Self::new()
    }
}

/// Service status information
#[derive(Debug)]
pub struct ServiceStatus {
    pub installed: bool,
    pub running: bool,
    pub pid: Option<u32>,
    pub binary_path: Option<PathBuf>,
    pub log_path: Option<PathBuf>,
    /// True if we couldn't query full status (needs sudo)
    pub needs_root_for_details: bool,
}

impl std::fmt::Display for ServiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if !self.installed {
            writeln!(f, "Status: Not installed")?;
            writeln!(f, "\nTo install: sudo oored install")?;
            return Ok(());
        }

        writeln!(f, "Status: Installed")?;

        if self.needs_root_for_details {
            writeln!(f, "Running: Unknown (run with sudo for details)")?;
        } else if self.running {
            writeln!(f, "Running: Yes")?;
            if let Some(pid) = self.pid {
                writeln!(f, "PID: {}", pid)?;
            }
        } else {
            writeln!(f, "Running: No")?;
            writeln!(f, "\nTo start: sudo oored start")?;
        }

        if let Some(ref path) = self.binary_path {
            writeln!(f, "Binary: {}", path.display())?;
        }

        if let Some(ref path) = self.log_path {
            writeln!(f, "Logs: {}", path.display())?;
        }

        Ok(())
    }
}

/// Check if running with root privileges
pub fn require_root() -> Result<()> {
    if !is_root() {
        bail!("This command requires root privileges. Please run with sudo.");
    }
    Ok(())
}

/// Check if current user is root
fn is_root() -> bool {
    // SAFETY: geteuid() is always safe to call on Unix systems.
    // It's a pure read-only system call that returns the effective user ID
    // with no side effects or memory access concerns.
    unsafe { libc::geteuid() == 0 }
}

/// Get the path to the currently running binary
fn current_binary_path() -> Result<PathBuf> {
    std::env::current_exe().context("Failed to get current executable path")
}

/// Create a system user for the service (reserved for future use)
#[allow(dead_code)]
fn create_service_user() -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        macos::create_user()
    }

    #[cfg(not(target_os = "macos"))]
    {
        bail!("Service user creation only supported on macOS")
    }
}

/// Install oored as a system service
pub fn install(env_file: Option<PathBuf>, force: bool) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service installation only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        require_root()?;

        let paths = ServicePaths::new();

        // Check if already installed
        if paths.service_file.exists() && !force {
            bail!(
                "Service is already installed at {}. Use --force to reinstall.",
                paths.service_file.display()
            );
        }

        println!("Installing oored as system service...\n");

        // Create directories
        print!("Creating directories... ");
        create_directories(&paths)?;
        println!("done");

        // Copy binary
        print!("Installing binary to {}... ", paths.binary.display());
        copy_binary(&paths)?;
        println!("done");

        // Copy or create env file
        print!("Setting up environment file... ");
        setup_env_file(&paths, env_file)?;
        println!("done");

        // Write service file
        print!("Writing service definition... ");
        macos::write_plist(&paths)?;
        println!("done");

        // Write log rotation config
        print!("Configuring log rotation... ");
        macos::write_newsyslog_config(&paths)?;
        println!("done");

        // Enable and load service
        print!("Enabling service... ");
        macos::load_service(&paths)?;
        println!("done");

        println!("\nInstallation complete!");
        println!("\nNext steps:");
        println!("  1. Edit configuration: sudo nano {}", paths.env_file.display());
        println!("  2. Start the service: sudo oored start");
        println!("  3. Check status: oored status");
        println!("  4. View logs: oored logs -f");

        Ok(())
    }
}

/// Uninstall the system service
pub fn uninstall(purge: bool) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service management only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        require_root()?;

        let paths = ServicePaths::new();

        if !paths.service_file.exists() {
            bail!("Service is not installed");
        }

        println!("Uninstalling oored system service...\n");

        // Stop service if running
        print!("Stopping service... ");
        let _ = macos::stop_service(&paths);
        println!("done");

        // Disable and unload service
        print!("Disabling service... ");
        macos::unload_service(&paths)?;
        println!("done");

        // Remove service file
        print!("Removing service definition... ");
        if paths.service_file.exists() {
            std::fs::remove_file(&paths.service_file)?;
        }
        println!("done");

        // Remove log rotation config
        print!("Removing log rotation config... ");
        if paths.logrotate_config.exists() {
            let _ = std::fs::remove_file(&paths.logrotate_config);
        }
        println!("done");

        if purge {
            print!("Removing binary... ");
            if paths.binary.exists() {
                std::fs::remove_file(&paths.binary)?;
            }
            println!("done");

            print!("Removing data directory... ");
            if paths.data_dir.exists() {
                std::fs::remove_dir_all(&paths.data_dir)?;
            }
            println!("done");

            print!("Removing log directory... ");
            if paths.log_dir.exists() {
                std::fs::remove_dir_all(&paths.log_dir)?;
            }
            println!("done");

            print!("Removing config directory... ");
            if paths.config_dir.exists() {
                std::fs::remove_dir_all(&paths.config_dir)?;
            }
            println!("done");
        }

        println!("\nUninstallation complete!");
        if !purge {
            println!("\nNote: Data, logs, and configuration were preserved.");
            println!("To remove everything, run: sudo oored uninstall --purge");
        }

        Ok(())
    }
}

/// Start the service
pub fn start() -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service management only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        let paths = ServicePaths::new();

        if !paths.service_file.exists() {
            bail!("Service is not installed. Run 'sudo oored install' first.");
        }

        require_root()?;

        println!("Starting oored service...");
        macos::start_service(&paths)?;
        println!("Service started.");

        Ok(())
    }
}

/// Stop the service
pub fn stop() -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service management only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        let paths = ServicePaths::new();

        if !paths.service_file.exists() {
            bail!("Service is not installed.");
        }

        require_root()?;

        println!("Stopping oored service...");
        macos::stop_service(&paths)?;
        println!("Service stopped.");

        Ok(())
    }
}

/// Restart the service
pub fn restart() -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service management only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        let paths = ServicePaths::new();

        if !paths.service_file.exists() {
            bail!("Service is not installed. Run 'sudo oored install' first.");
        }

        require_root()?;

        println!("Restarting oored service...");
        macos::stop_service(&paths)?;
        std::thread::sleep(std::time::Duration::from_secs(1));
        macos::start_service(&paths)?;
        println!("Service restarted.");

        Ok(())
    }
}

/// Show service status
pub fn status() -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service management only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        let paths = ServicePaths::new();
        let status = macos::get_status(&paths)?;
        print!("{}", status);
        Ok(())
    }
}

/// View service logs
pub fn logs(lines: usize, follow: bool) -> Result<()> {
    #[cfg(not(target_os = "macos"))]
    bail!("Service management only supported on macOS");

    #[cfg(target_os = "macos")]
    {
        let paths = ServicePaths::new();
        macos::view_logs(&paths, lines, follow)
    }
}

// Helper functions

fn create_directories(paths: &ServicePaths) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    for dir in [&paths.data_dir, &paths.log_dir, &paths.config_dir] {
        if !dir.exists() {
            std::fs::create_dir_all(dir)
                .with_context(|| format!("Failed to create directory: {}", dir.display()))?;
        }
    }

    // Set appropriate permissions (owned by root, as daemon runs as root)
    std::fs::set_permissions(&paths.data_dir, std::fs::Permissions::from_mode(0o755))?;
    std::fs::set_permissions(&paths.log_dir, std::fs::Permissions::from_mode(0o755))?;
    std::fs::set_permissions(&paths.config_dir, std::fs::Permissions::from_mode(0o755))?;

    Ok(())
}

fn copy_binary(paths: &ServicePaths) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let current = current_binary_path()?;

    // Copy binary
    std::fs::copy(&current, &paths.binary)
        .with_context(|| format!("Failed to copy binary to {}", paths.binary.display()))?;

    // Make executable
    std::fs::set_permissions(&paths.binary, std::fs::Permissions::from_mode(0o755))?;

    Ok(())
}

fn setup_env_file(paths: &ServicePaths, env_file: Option<PathBuf>) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let db_path = paths.data_dir.join("oore.db");
    let absolute_db_url = format!("sqlite:{}", db_path.display());

    // Try to find source env file
    let source = if let Some(ref path) = env_file {
        if path.exists() {
            Some(path.clone())
        } else {
            bail!("Specified env file does not exist: {}", path.display());
        }
    } else {
        // Look for .env in current directory
        let cwd_env = std::env::current_dir()?.join(".env");
        if cwd_env.exists() {
            Some(cwd_env)
        } else {
            None
        }
    };

    if let Some(source) = source {
        // Read source env file
        let content = std::fs::read_to_string(&source)?;

        // Update DATABASE_URL to use absolute path
        let mut lines: Vec<String> = content.lines().map(String::from).collect();
        let mut found_db_url = false;

        for line in &mut lines {
            if line.starts_with("DATABASE_URL=") {
                *line = format!("DATABASE_URL={}", absolute_db_url);
                found_db_url = true;
            }
        }

        // Add DATABASE_URL if not found
        if !found_db_url {
            lines.insert(0, format!("DATABASE_URL={}", absolute_db_url));
        }

        std::fs::write(&paths.env_file, lines.join("\n") + "\n")?;
    } else if !paths.env_file.exists() {
        // Create minimal env file
        let content = format!(
            r#"# Oore Server Configuration
# Generated by oored install

# Database location (SQLite)
DATABASE_URL=sqlite:{}/oore.db

# Server base URL (for webhook callbacks)
# BASE_URL=https://your-domain.com

# Admin authentication token (required for admin API)
# OORE_ADMIN_TOKEN=your-secure-token

# Encryption key for stored credentials (32 bytes, hex encoded)
# Generate with: openssl rand -hex 32
# ENCRYPTION_KEY=

# Optional: Restrict dashboard CORS to specific origin
# DASHBOARD_ORIGIN=https://your-dashboard.com

# Logging level
RUST_LOG=oore_server=info,oore_core=info
"#,
            paths.data_dir.display()
        );
        std::fs::write(&paths.env_file, content)?;
    }

    // Set permissions: readable only by root (contains secrets)
    std::fs::set_permissions(&paths.env_file, std::fs::Permissions::from_mode(0o600))?;

    Ok(())
}
