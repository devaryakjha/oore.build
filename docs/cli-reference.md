# CLI Reference

The `oore` CLI is a client for interacting with the Oore CI/CD server. It provides commands for managing repositories, builds, and integrations.

## Installation

```bash
# Build from source
cargo build --release -p oore-cli

# The binary is at ./target/release/oore
# Optionally copy to your PATH
sudo cp ./target/release/oore /usr/local/bin/
```

## Global Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--server <URL>` | - | `http://localhost:8080` | Server URL |
| `--admin-token <TOKEN>` | `OORE_ADMIN_TOKEN` | - | Admin token for protected endpoints |

## Commands

- [`oore health`](#oore-health) - Check server health
- [`oore version`](#oore-version) - Show version information
- [`oore setup`](#oore-setup) - Show setup status
- [`oore init`](#oore-init) - Initialize development environment
- [`oore repo`](#oore-repo) - Repository management
- [`oore build`](#oore-build) - Build management
- [`oore webhook`](#oore-webhook) - Webhook event management
- [`oore github`](#oore-github) - GitHub App management
- [`oore gitlab`](#oore-gitlab) - GitLab integration

---

## `oore health`

Check if the server is running.

```bash
oore health
```

**Output:**
```
Server status: ok
```

---

## `oore version`

Show CLI and server version information.

```bash
oore version
```

**Output:**
```
CLI version: 0.1.0
Server version: 0.1.0 (oored)
```

---

## `oore setup`

Show the current setup status including GitHub App and GitLab OAuth configuration.

```bash
oore setup --admin-token YOUR_TOKEN
```

**Output:**
```
Oore Setup Status
==================

Server Configuration:
  Encryption key: Configured
  Admin token:    Configured

GitHub App:
  Status:        Configured
  App name:      my-oore-app
  Installations: 2

GitLab OAuth:
  Instance:      https://gitlab.com
  Username:      myuser
  Projects:      5 enabled
```

---

## `oore init`

Initialize a local development environment.

```bash
oore init
```

This command helps set up a new development instance of Oore.

---

## `oore repo`

Repository management commands.

### `oore repo list`

List all registered repositories.

```bash
oore repo list
```

**Output:**
```
ID                           PROVIDER   NAME                           ACTIVE
--------------------------------------------------------------------------------
01HNJX5Q9T3WP2V6Z8K4M7YRBF   github     my-flutter-app                 yes
01HNJX7K2N4RM8P3Y5W6T9HSVE   gitlab     backend-api                    yes
```

### `oore repo add`

Add a new repository.

```bash
oore repo add --provider <PROVIDER> --owner <OWNER> --repo <REPO> [OPTIONS]
```

**Required arguments:**
| Argument | Description |
|----------|-------------|
| `--provider <PROVIDER>` | Git provider: `github` or `gitlab` |
| `--owner <OWNER>` | Repository owner (user or organization) |
| `--repo <REPO>` | Repository name |

**Optional arguments:**
| Option | Default | Description |
|--------|---------|-------------|
| `--name <NAME>` | `owner/repo` | Custom display name |
| `--branch <BRANCH>` | `main` | Default branch |
| `--webhook-secret <SECRET>` | - | Webhook secret (GitLab) |
| `--github-repo-id <ID>` | - | GitHub repository ID (numeric) |
| `--github-installation-id <ID>` | - | GitHub App installation ID |
| `--gitlab-project-id <ID>` | - | GitLab project ID (numeric) |

**Examples:**

```bash
# Add a GitHub repository
oore repo add --provider github --owner myorg --repo my-app

# Add a GitLab repository with webhook secret
oore repo add --provider gitlab --owner myuser --repo backend \
  --webhook-secret "my-secret-token" \
  --gitlab-project-id 12345678

# Add with custom name and branch
oore repo add --provider github --owner myorg --repo my-app \
  --name "Production App" \
  --branch develop
```

### `oore repo show`

Show details of a specific repository.

```bash
oore repo show <REPO_ID>
```

**Output:**
```
ID:             01HNJX5Q9T3WP2V6Z8K4M7YRBF
Name:           my-flutter-app
Provider:       github
Owner:          myorg
Repository:     my-app
Clone URL:      https://github.com/myorg/my-app.git
Default Branch: main
Active:         yes
GitHub Repo ID: 123456789
GitHub Install: 87654321
Created:        2024-01-15T10:30:00Z
```

### `oore repo remove`

Remove a repository from Oore.

```bash
oore repo remove <REPO_ID>
```

**Note:** This only removes the repository from Oore tracking. It does not delete the repository from GitHub/GitLab.

### `oore repo webhook-url`

Get the webhook URL for a repository.

```bash
oore repo webhook-url <REPO_ID>
```

**Output (GitHub):**
```
Provider: github
Webhook URL: https://ci.example.com/api/webhooks/github

Configure in your GitHub App settings:
  1. Go to your GitHub App settings
  2. Set the Webhook URL to: https://ci.example.com/api/webhooks/github
  3. Ensure Content type is: application/json
```

**Output (GitLab):**
```
Provider: gitlab
Webhook URL: https://ci.example.com/api/webhooks/gitlab/01HNJX7K2N4RM8P3Y5W6T9HSVE

Configure in your GitLab project:
  1. Go to Settings > Webhooks
  2. Add webhook URL: https://ci.example.com/api/webhooks/gitlab/01HNJX7K2N4RM8P3Y5W6T9HSVE
  3. Enter your Secret Token
  4. Select triggers: Push events, Merge request events
```

---

## `oore build`

Build management commands.

### `oore build list`

List all builds.

```bash
oore build list [--repo <REPO_ID>]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--repo <REPO_ID>` | Filter by repository ID |

**Output:**
```
ID                           STATUS       TRIGGER         BRANCH     COMMIT
--------------------------------------------------------------------------------
01HNJX9P2K4TM8Q6V5W3Y7ZRAD   running      webhook         main       abc1234
01HNJXA3N7RP5M2K8T4W6Y9HBC   success      manual          develop    def5678
01HNJXB8K2TN4M7P9R3W5Y6ZDE   failed       webhook         main       ghi9012
```

### `oore build show`

Show details of a specific build.

```bash
oore build show <BUILD_ID>
```

**Output:**
```
ID:           01HNJX9P2K4TM8Q6V5W3Y7ZRAD
Repository:   01HNJX5Q9T3WP2V6Z8K4M7YRBF
Status:       running
Trigger:      webhook
Branch:       main
Commit:       abc1234567890abcdef1234567890abcdef12345
Webhook:      01HNJX8M2K4TN6P9R3W5Y7ZQEF
Created:      2024-01-15T10:35:00Z
Started:      2024-01-15T10:35:02Z
```

### `oore build trigger`

Manually trigger a build.

```bash
oore build trigger <REPO_ID> [OPTIONS]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--branch <BRANCH>` | Repository default | Branch to build |
| `--commit <SHA>` | HEAD | Specific commit SHA |

**Examples:**

```bash
# Build default branch at HEAD
oore build trigger 01HNJX5Q9T3WP2V6Z8K4M7YRBF

# Build specific branch
oore build trigger 01HNJX5Q9T3WP2V6Z8K4M7YRBF --branch feature/login

# Build specific commit
oore build trigger 01HNJX5Q9T3WP2V6Z8K4M7YRBF --commit abc1234567890
```

### `oore build cancel`

Cancel a running build.

```bash
oore build cancel <BUILD_ID>
```

---

## `oore webhook`

Webhook event management commands.

### `oore webhook list`

List received webhook events.

```bash
oore webhook list
```

### `oore webhook show`

Show details of a webhook event.

```bash
oore webhook show <EVENT_ID>
```

---

## `oore github`

GitHub App management commands.

### `oore github setup`

Set up a new GitHub App.

```bash
oore github setup --admin-token YOUR_TOKEN
```

This command guides you through creating a GitHub App for your Oore installation.

### `oore github status`

Check GitHub App configuration status.

```bash
oore github status --admin-token YOUR_TOKEN
```

---

## `oore gitlab`

GitLab integration commands.

### `oore gitlab connect`

Connect a GitLab account via OAuth.

```bash
oore gitlab connect --admin-token YOUR_TOKEN
```

### `oore gitlab status`

Check GitLab connection status.

```bash
oore gitlab status --admin-token YOUR_TOKEN
```

---

## Examples

### Complete Workflow

```bash
# 1. Check server is running
oore health

# 2. Add a repository
oore repo add --provider github --owner myorg --repo my-app

# 3. Get the webhook URL
oore repo webhook-url 01HNJX5Q9T3WP2V6Z8K4M7YRBF
# Configure this in GitHub

# 4. Trigger a manual build
oore build trigger 01HNJX5Q9T3WP2V6Z8K4M7YRBF

# 5. Watch the build
oore build show 01HNJX9P2K4TM8Q6V5W3Y7ZRAD

# 6. List all builds
oore build list --repo 01HNJX5Q9T3WP2V6Z8K4M7YRBF
```

### Using with a Custom Server

```bash
# Production server
oore --server https://ci.example.com repo list

# Using environment variable
export OORE_ADMIN_TOKEN="your-token"
oore --server https://ci.example.com setup
```
