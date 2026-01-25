# Oore Server Service Management

This guide explains how to install, configure, and manage the Oore CI/CD server (`oored`) as a system service.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Commands Reference](#commands-reference)
- [Installation Guide](#installation-guide)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)
- [Platform-Specific Details](#platform-specific-details)

---

## Overview

The `oored` binary can run in two modes:

1. **Foreground mode**: Run directly in your terminal for development (`oored run`)
2. **Service mode**: Run as a system daemon that starts at boot

Service mode is recommended for production deployments on dedicated Mac hardware (Mac mini, Mac Studio).

### Why Use Service Mode?

- **Auto-start**: Server starts automatically at boot
- **Auto-restart**: Crashed processes are automatically restarted
- **Log management**: Logs are rotated automatically
- **Clean shutdown**: Graceful handling of system shutdown/restart
- **Easy management**: Simple commands to start/stop/restart

---

## Quick Start

```bash
# Build the server
cargo build --release -p oore-server

# Install as system service
sudo ./target/release/oored install

# Edit configuration
sudo nano /etc/oore/oore.env

# Start the service
sudo oored start

# Check status
oored status

# View logs
oored logs -f
```

---

## Commands Reference

### `oored run`

Run the server in foreground mode. This is the default if no command is specified.

```bash
oored run
# or simply
oored
```

**Use cases:**
- Development and debugging
- Testing configuration changes
- Running in Docker containers

**Behavior:**
- Server binds to `0.0.0.0:8080` by default
- Logs output to stdout/stderr
- Stops on Ctrl+C (SIGINT) or SIGTERM
- Uses environment variables from current shell or `.env` file

---

### `oored install`

Install the server as a system service. Requires root privileges.

```bash
sudo oored install [OPTIONS]
```

**Options:**
- `--env-file <PATH>`: Specify a custom environment file to copy
- `--force, -f`: Force reinstall even if already installed

**What it does:**
1. Creates directories: `/var/lib/oore`, `/var/log/oore`, `/etc/oore`
2. Copies the binary to `/usr/local/bin/oored`
3. Copies or creates environment file at `/etc/oore/oore.env`
4. Writes service definition (launchd plist or systemd unit)
5. Configures log rotation
6. Enables the service (but does not start it)

**Examples:**

```bash
# Basic install
sudo oored install

# Install with custom env file
sudo oored install --env-file /path/to/my.env

# Reinstall (overwrite existing)
sudo oored install --force
```

---

### `oored uninstall`

Remove the system service. Requires root privileges.

```bash
sudo oored uninstall [OPTIONS]
```

**Options:**
- `--purge`: Also remove data, logs, and configuration

**Behavior:**
- Stops the service if running
- Removes the service definition
- Removes log rotation config
- By default, preserves data, logs, and configuration

**Examples:**

```bash
# Uninstall but keep data
sudo oored uninstall

# Complete removal
sudo oored uninstall --purge
```

---

### `oored start`

Start the service. Requires root on macOS.

```bash
sudo oored start  # macOS
oored start       # Linux (if systemd permissions allow)
```

**Behavior:**
- Starts the service if not running
- If already running, has no effect
- Verifies the service starts successfully

---

### `oored stop`

Stop the service. Requires root on macOS.

```bash
sudo oored stop  # macOS
oored stop       # Linux
```

**Behavior:**
- Sends SIGTERM for graceful shutdown
- Waits for in-flight requests to complete

---

### `oored restart`

Restart the service. Requires root on macOS.

```bash
sudo oored restart
```

**Behavior:**
- Stops the service
- Waits 1 second
- Starts the service

---

### `oored status`

Show service status. No root required for basic info.

```bash
oored status
```

**Output example:**
```
Status: Installed
Running: Yes
PID: 12345
Binary: /usr/local/bin/oored
Logs: /var/log/oore/oored.log
```

**Notes:**
- Some details may require root to access
- Shows installation path and running state

---

### `oored logs`

View service logs.

```bash
oored logs [OPTIONS]
```

**Options:**
- `-n, --lines <N>`: Number of lines to show (default: 50)
- `-f, --follow`: Follow log output in real-time

**Examples:**

```bash
# View last 50 lines
oored logs

# View last 100 lines
oored logs -n 100

# Follow logs in real-time
oored logs -f

# Follow with more history
oored logs -n 200 -f
```

---

## Installation Guide

### Prerequisites

- macOS 10.15+ or Linux with systemd
- Rust toolchain (for building from source)
- Root access (for installation)

### Step-by-Step Installation

#### 1. Build the Server

```bash
# Clone the repository
git clone https://github.com/devaryakjha/oore.build.git
cd oore.build

# Build release binary
cargo build --release -p oore-server
```

#### 2. Prepare Configuration

Create an environment file (or the installer will create a template):

```bash
# Copy the example
cp .env.example .env

# Edit with your settings
nano .env
```

Required configuration:
```bash
# Database (SQLite)
DATABASE_URL=sqlite:oore.db

# Base URL for webhooks (your server's public URL)
BASE_URL=https://your-mac.example.com

# Admin token for API access
OORE_ADMIN_TOKEN=your-secure-random-token

# Encryption key for stored secrets
ENCRYPTION_KEY=your-64-char-hex-key
```

Generate an encryption key:
```bash
openssl rand -hex 32
```

#### 3. Install the Service

```bash
# Install with your env file
sudo ./target/release/oored install --env-file .env
```

#### 4. Start the Service

```bash
sudo oored start
```

#### 5. Verify Installation

```bash
# Check status
oored status

# Test the API
curl http://localhost:8080/api/health
```

---

## Configuration

### Environment File Location

When installed as a service, the configuration lives at:
```
/etc/oore/oore.env
```

The service reads this file on startup via the `OORE_ENV_FILE` environment variable.

### Configuration Options

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite database path (auto-converted to absolute path) |
| `BASE_URL` | No | Public URL for webhook callbacks |
| `OORE_ADMIN_TOKEN` | No | Token for admin API authentication |
| `ENCRYPTION_KEY` | No | 32-byte hex key for encrypting stored credentials |
| `DASHBOARD_ORIGIN` | No | CORS origin for web dashboard |
| `RUST_LOG` | No | Logging level (default: `oore_server=info,oore_core=info`) |

### Editing Configuration

```bash
# Edit the configuration
sudo nano /etc/oore/oore.env

# Restart to apply changes
sudo oored restart
```

### File Permissions

The environment file contains secrets and is protected:
- Owner: root
- Mode: 0600 (readable only by root)

---

## Troubleshooting

### Service Won't Start

**Check the logs:**
```bash
oored logs
```

**Common issues:**

1. **Database permission error**
   ```
   Error: unable to open database file
   ```
   Solution: Ensure `/var/lib/oore` exists and is writable

2. **Port already in use**
   ```
   Error: Address already in use
   ```
   Solution: Check if another process is using port 8080:
   ```bash
   sudo lsof -i :8080
   ```

3. **Missing configuration**
   ```
   Error: DATABASE_URL must be set
   ```
   Solution: Edit `/etc/oore/oore.env` and add required variables

### Service Crashes Immediately

If the service exits right after starting:

1. Check logs for error messages
2. Try running in foreground to see output:
   ```bash
   sudo /usr/local/bin/oored run
   ```

### Can't Connect to API

1. **Check if service is running:**
   ```bash
   oored status
   ```

2. **Check if port is listening:**
   ```bash
   curl http://localhost:8080/api/health
   ```

3. **Check firewall (macOS):**
   ```bash
   sudo pfctl -s rules
   ```

### macOS-Specific: "Operation not permitted"

If you see permission errors on macOS:

1. Ensure you're using `sudo`
2. Check Terminal.app has Full Disk Access (System Preferences > Privacy)

### Log Rotation Not Working

**macOS**: Check newsyslog config:
```bash
cat /etc/newsyslog.d/oore.conf
```

**Linux**: Check logrotate config:
```bash
cat /etc/logrotate.d/oore
```

---

## Architecture

### Service Design Decisions

#### Why Run as Root?

After researching industry practices:

- **cloudflared**: Runs as root (Issue #672 suggested a dedicated user but was never implemented)
- **Homebrew services**: `sudo brew services start` runs daemons as root
- **Apple's guidance**: System daemons should be owned by root:wheel

Running as root simplifies installation and avoids macOS-specific user/group management complexity. The service can be hardened later with a dedicated user if needed.

#### Why System Service (Not User Service)?

A CI/CD server needs to:
- Start at boot, even without user login
- Run continuously in the background
- Have system-level permissions for build operations

User-level services (LaunchAgents) only run when a user is logged in.

### File Layout

```
/usr/local/bin/
  oored                          # Binary

/etc/oore/
  oore.env                       # Configuration (secrets)

/var/lib/oore/
  oore.db                        # SQLite database
  (build artifacts, caches)

/var/log/oore/
  oored.log                      # Server logs

/Library/LaunchDaemons/          # macOS
  build.oore.oored.plist         # Service definition

/etc/systemd/system/             # Linux
  oored.service                  # Service definition

/etc/newsyslog.d/                # macOS
  oore.conf                      # Log rotation config

/etc/logrotate.d/                # Linux
  oore                           # Log rotation config
```

---

## Platform-Specific Details

### macOS (launchd)

**Service definition**: LaunchDaemon plist at `/Library/LaunchDaemons/build.oore.oored.plist`

**Key features:**
- `RunAtLoad`: Starts at boot
- `KeepAlive`: Restarts on crash (unless clean exit)
- `ThrottleInterval`: 5 seconds between restart attempts
- High file descriptor limits (65536)

**Commands used:**
- `launchctl bootstrap system /path/to/plist` - Load service
- `launchctl bootout system/build.oore.oored` - Unload service
- `launchctl kickstart -kp system/build.oore.oored` - Start/restart
- `launchctl kill SIGTERM system/build.oore.oored` - Stop

**Log rotation:**
Uses newsyslog (native macOS tool). Config at `/etc/newsyslog.d/oore.conf`.

### Linux (systemd)

**Service definition**: Unit file at `/etc/systemd/system/oored.service`

**Key features:**
- `Type=simple`: Standard daemon
- `Restart=always`: Restart on any exit
- `RestartSec=5`: 5 seconds between restarts
- Security hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`

**Commands used:**
- `systemctl daemon-reload` - Reload unit files
- `systemctl enable oored.service` - Enable at boot
- `systemctl start oored.service` - Start
- `systemctl stop oored.service` - Stop
- `systemctl status oored.service` - Status

**Log rotation:**
Uses logrotate. Config at `/etc/logrotate.d/oore`.

---

## Security Considerations

### Secrets Management

- Environment file is chmod 600 (root-only)
- Encryption key protects stored credentials in database
- Admin token required for management API

### Network Security

- Server binds to `0.0.0.0:8080` by default
- Use a reverse proxy (nginx, Caddy) for HTTPS
- Consider firewall rules to restrict access

### Future Improvements

- Dedicated service user (lower privilege)
- chroot/sandbox isolation
- Audit logging
