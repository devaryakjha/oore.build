# Configuration Reference

Oore is configured through environment variables. These can be set in a `.env` file or passed directly to the process.

## Environment File Locations

| Context | Location |
|---------|----------|
| Development | `.env` in working directory |
| Installed Service | `/etc/oore/oore.env` |
| Custom | `--env-file` flag or `OORE_ENV_FILE` variable |

## Configuration Variables

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | SQLite connection string |

**Examples:**
```bash
# Development (relative path)
DATABASE_URL=sqlite:oore.db

# Production (absolute path - set automatically during install)
DATABASE_URL=sqlite:/var/lib/oore/oore.db
```

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | `0.0.0.0` | IP address to bind to |
| `PORT` | No | `8080` | Port to listen on |
| `BASE_URL` | No | - | Public URL for webhook callbacks |

**Examples:**
```bash
# Listen only on localhost
HOST=127.0.0.1
PORT=8080

# Public URL for webhooks
BASE_URL=https://ci.example.com
```

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OORE_ADMIN_TOKEN` | No | - | Token for admin API authentication |
| `ENCRYPTION_KEY` | No | - | 32-byte hex key for encrypting credentials |

**Generating an encryption key:**
```bash
openssl rand -hex 32
```

**Example:**
```bash
OORE_ADMIN_TOKEN=your-secure-token-here
ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DASHBOARD_ORIGIN` | No | - | Allowed origin for CORS (web dashboard) |

**Example:**
```bash
DASHBOARD_ORIGIN=https://dashboard.example.com
```

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUST_LOG` | No | `info` | Log level filter |

**Log levels:** `error`, `warn`, `info`, `debug`, `trace`

**Examples:**
```bash
# Default production logging
RUST_LOG=oore_server=info,oore_core=info

# Verbose debugging
RUST_LOG=oore_server=debug,oore_core=debug

# Trace everything (very verbose)
RUST_LOG=trace
```

### GitHub Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_APP_ID` | No | - | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | No | - | GitHub App private key (PEM format) |
| `GITHUB_WEBHOOK_SECRET` | No | - | Shared secret for webhook verification |

**Example:**
```bash
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
```

### GitLab Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITLAB_TOKEN` | No | - | GitLab personal access token |

**Note:** GitLab webhook tokens are stored per-repository in the database.

---

## Example Configurations

### Minimal Development

```bash
# .env
DATABASE_URL=sqlite:oore.db
RUST_LOG=debug
```

### Production

```bash
# /etc/oore/oore.env
DATABASE_URL=sqlite:/var/lib/oore/oore.db
BASE_URL=https://ci.example.com
OORE_ADMIN_TOKEN=secure-random-token-32-chars-min
ENCRYPTION_KEY=64-hex-characters-here
DASHBOARD_ORIGIN=https://dashboard.example.com
RUST_LOG=oore_server=info,oore_core=info
```

### With GitHub App

```bash
# /etc/oore/oore.env
DATABASE_URL=sqlite:/var/lib/oore/oore.db
BASE_URL=https://ci.example.com
OORE_ADMIN_TOKEN=secure-random-token-here
ENCRYPTION_KEY=64-hex-characters-here

# GitHub
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=webhook-secret-from-github
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your private key...
-----END RSA PRIVATE KEY-----"

RUST_LOG=oore_server=info
```

---

## File Permissions

When installed as a service, the environment file should only be readable by root:

```bash
sudo chmod 600 /etc/oore/oore.env
sudo chown root:root /etc/oore/oore.env  # Linux
sudo chown root:wheel /etc/oore/oore.env # macOS
```

This is done automatically by `oored install`.

---

## Applying Configuration Changes

After editing the configuration:

```bash
# For installed service
sudo oored restart

# For development
# Just restart the server (Ctrl+C and run again)
```
