# Oore Complete Flow Testing Plan

This document provides a step-by-step testing plan for the Oore CI/CD platform. Follow each section in order.

---

## Prerequisites

Before testing, ensure you have:

- [ ] Rust toolchain installed (`cargo --version`)
- [ ] Bun installed (`bun --version`)
- [ ] SQLite available (`sqlite3 --version`)
- [ ] A GitHub account with permission to create GitHub Apps
- [ ] A GitLab account (gitlab.com or self-hosted)
- [ ] A way to expose localhost to internet (ngrok, cloudflared, or similar) for webhook testing

---

## Phase 1: Development Environment Setup

### 1.1 Build the Project

```bash
# Build all crates
cargo build

# Expected: Compiles without errors
# Verify: target/debug/oored and target/debug/oore exist
ls -la target/debug/oore*
```

### 1.2 Initialize Development Environment

```bash
# Generate .env file with secrets
cargo run -p oore-cli -- init

# Expected output:
# - Creates .env file
# - Generates OORE_ADMIN_TOKEN (32-byte hex)
# - Generates ENCRYPTION_KEY (base64 32 bytes)
# - Generates GITLAB_SERVER_PEPPER (16-byte hex)
# - Sets DATABASE_URL=sqlite:oore.db
# - Sets OORE_BASE_URL=http://localhost:8080
```

**Verify:**
```bash
cat .env
# Should contain: DATABASE_URL, OORE_BASE_URL, OORE_ADMIN_TOKEN,
# ENCRYPTION_KEY, GITLAB_SERVER_PEPPER
```

**Industry Standard Check:**
- [ ] `.env` file permissions are 0600 (owner read/write only)
- [ ] `.env` is in `.gitignore`
- [ ] No secrets printed to terminal output

### 1.3 Start the Server

```bash
# Terminal 1: Start server
cargo run -p oore-server

# Expected output:
# - Migrations run successfully
# - Server listening on http://0.0.0.0:8080
# - Background worker started
```

### 1.4 Basic Health Checks

```bash
# Terminal 2: Test CLI connectivity
cargo run -p oore-cli -- health

# Expected: Server is healthy, version info shown

cargo run -p oore-cli -- version

# Expected: CLI version and server version displayed

cargo run -p oore-cli -- setup

# Expected: Shows setup status
# - Encryption: Configured
# - Admin Token: Configured
# - GitHub App: Not configured (or configured)
# - GitLab: Not configured (or lists credentials)
```

**Industry Standard Check:**
- [ ] Health endpoint responds quickly (<100ms)
- [ ] Version includes git commit hash or build info
- [ ] Setup status clearly shows what's missing

---

## Phase 2: GitHub App Integration

### 2.1 Expose Server for GitHub Callbacks

Before GitHub setup, expose your local server:

```bash
# Option A: ngrok
ngrok http 8080
# Note the HTTPS URL: https://abc123.ngrok.io

# Option B: cloudflared
cloudflared tunnel --url http://localhost:8080
```

Update `.env`:
```bash
# Change OORE_BASE_URL to your tunnel URL
OORE_BASE_URL="https://abc123.ngrok.io"
```

Restart the server after changing `.env`.

### 2.2 Initiate GitHub App Setup

```bash
cargo run -p oore-cli -- github setup

# Expected output:
# - Instructions to visit a URL
# - URL format: https://github.com/settings/apps/new?state=...&manifest=...
# - State token displayed for reference
```

**Verify:**
- [ ] URL is valid and opens in browser
- [ ] Manifest contains correct callback URL (your tunnel URL + /setup/github/callback)

### 2.3 Create GitHub App in Browser

1. Visit the URL from step 2.2
2. Review the pre-filled app settings:
   - [ ] Name: Should be "oore-ci" or similar
   - [ ] Webhook URL: Points to your server
   - [ ] Permissions: Should include repository, pull requests, contents
   - [ ] Events: push, pull_request
3. Click "Create GitHub App"
4. GitHub redirects to your callback URL
5. Page displays: `oore github callback "<URL>"`

**Industry Standard Check:**
- [ ] Manifest requests minimum necessary permissions
- [ ] Webhook secret is auto-generated (not user-provided)
- [ ] App description is professional

### 2.4 Complete GitHub Setup

```bash
# Copy the full URL from the browser and run:
cargo run -p oore-cli -- github callback "https://your-server/setup/github/callback?code=...&state=..."

# Expected output:
# - "GitHub App configured successfully"
# - App ID displayed
# - No sensitive data (private key) shown in output
```

**Verify:**
```bash
cargo run -p oore-cli -- github status

# Expected:
# - App ID shown
# - App name shown
# - "Credentials stored (encrypted)"
# - Installation count (0 initially)
```

### 2.5 Install GitHub App on Repository

1. Go to GitHub App settings: `https://github.com/settings/apps/<your-app-name>`
2. Click "Install App"
3. Select account/organization
4. Choose repositories (specific repos or all)
5. Complete installation

### 2.6 Sync Installations

```bash
cargo run -p oore-cli -- github sync

# Expected output:
# - Lists installations synced
# - Shows which repos were found

cargo run -p oore-cli -- github installations

# Expected:
# - Lists all installations with account names
# - Shows which repos are accessible
```

**Industry Standard Check:**
- [ ] Sync is idempotent (running twice produces same result)
- [ ] Handles "all repositories" vs "selected repositories" correctly
- [ ] Shows meaningful progress during sync

---

## Phase 3: Repository Management

### 3.1 Add a Repository (GitHub)

```bash
# First, get the GitHub repo ID and installation ID
# You'll need these from the sync output or GitHub API

cargo run -p oore-cli -- repo add \
  --provider github \
  --owner YOUR_GITHUB_USERNAME \
  --repo YOUR_REPO_NAME \
  --github-repo-id 123456789 \
  --github-installation-id 12345678

# Expected:
# - Repository created with ULID
# - Shows clone URL, default branch
```

### 3.2 List and Verify Repository

```bash
cargo run -p oore-cli -- repo list

# Expected:
# - Table showing ID, Provider, Owner, Repo, Branch

cargo run -p oore-cli -- repo show <REPO_ID>

# Expected:
# - Full repository details
# - Provider-specific IDs (github_repo_id, github_installation_id)
```

### 3.3 Get Webhook Configuration

```bash
cargo run -p oore-cli -- repo webhook-url <REPO_ID>

# Expected for GitHub:
# - Webhook URL: https://your-server/api/webhooks/github
# - Instructions for configuring in GitHub
# - Note that GitHub App already handles webhooks

# Expected for GitLab:
# - Webhook URL: https://your-server/api/webhooks/gitlab/<REPO_ID>
# - Secret token to use
# - Instructions for configuring in GitLab
```

**Industry Standard Check:**
- [ ] Clear instructions for each provider
- [ ] Warns if URL is HTTP (insecure)
- [ ] Explains which events to enable

---

## Phase 4: GitLab Integration

### 4.1 Initiate GitLab Connection

```bash
cargo run -p oore-cli -- gitlab connect

# For self-hosted GitLab:
cargo run -p oore-cli -- gitlab connect --instance https://gitlab.example.com

# Expected:
# - Authorization URL displayed
# - Instructions to visit URL
```

**Note:** For self-hosted GitLab, you may need to register an OAuth app first:
```bash
cargo run -p oore-cli -- gitlab register \
  --instance https://gitlab.example.com \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET
```

### 4.2 Authorize in Browser

1. Visit the authorization URL
2. Log in to GitLab if needed
3. Click "Authorize"
4. Redirected to callback page with command

### 4.3 Complete GitLab Setup

```bash
cargo run -p oore-cli -- gitlab callback "https://your-server/setup/gitlab/callback?code=...&state=..."

# Expected:
# - "GitLab credentials stored successfully"
# - Instance URL shown
```

### 4.4 Verify GitLab Status

```bash
cargo run -p oore-cli -- gitlab status

# Expected:
# - Lists connected GitLab instances
# - Shows token expiry
# - Shows encryption status
```

### 4.5 List GitLab Projects

```bash
cargo run -p oore-cli -- gitlab projects

# Expected:
# - Table of accessible projects
# - Shows project ID, name, path

# For self-hosted:
cargo run -p oore-cli -- gitlab projects --instance https://gitlab.example.com
```

### 4.6 Enable CI for a Project

```bash
cargo run -p oore-cli -- gitlab enable <PROJECT_ID>

# Expected:
# - "CI enabled for project <name>"
# - Webhook configured automatically (or instructions shown)
```

### 4.7 Add GitLab Repository

```bash
cargo run -p oore-cli -- repo add \
  --provider gitlab \
  --owner YOUR_GITLAB_NAMESPACE \
  --repo YOUR_REPO_NAME \
  --gitlab-project-id 12345678

# Expected:
# - Repository created with ULID
# - Webhook URL shown
```

**Industry Standard Check:**
- [ ] Token refresh works before expiry
- [ ] Handles multiple GitLab instances
- [ ] Clear error if token is expired

---

## Phase 5: Webhook Testing

### 5.1 Verify Webhook Endpoint is Ready

```bash
# Check server logs for webhook worker status
# Should see: "Webhook processor started"
```

### 5.2 Test GitHub Webhook (Manual)

Push to your GitHub repository:
```bash
cd /path/to/your/github/repo
echo "test" >> test.txt
git add test.txt
git commit -m "Test webhook"
git push
```

**Monitor server logs for:**
- [ ] Webhook received log entry
- [ ] Signature verification passed
- [ ] Webhook event stored
- [ ] Background worker processed event
- [ ] Build created

### 5.3 Verify Webhook Event

```bash
cargo run -p oore-cli -- webhook list

# Expected:
# - Recent webhook event shown
# - Event type (push)
# - Repository ID matched
# - Processed status: true

cargo run -p oore-cli -- webhook show <EVENT_ID>

# Expected:
# - Full event details
# - Payload visible (or size shown)
# - Processing result
```

### 5.4 Verify Build Created

```bash
cargo run -p oore-cli -- build list

# Expected:
# - Build from webhook shown
# - Status: pending (builds don't actually run yet)
# - Trigger type: push
# - Commit SHA matches your push

cargo run -p oore-cli -- build show <BUILD_ID>

# Expected:
# - Full build details
# - Repository info
# - Webhook event ID linked
```

### 5.5 Test GitLab Webhook (Manual)

Push to your GitLab repository and verify similar flow.

**Industry Standard Check:**
- [ ] Invalid signatures rejected with 401
- [ ] Duplicate webhooks handled (idempotent)
- [ ] Unknown repos handled gracefully
- [ ] Payload too large handled
- [ ] Returns 200 quickly (async processing)

---

## Phase 6: Build Management

### 6.1 Trigger Manual Build

```bash
cargo run -p oore-cli -- build trigger <REPO_ID>

# Expected:
# - Build created with trigger_type: manual
# - Status: pending
# - Uses default branch

cargo run -p oore-cli -- build trigger <REPO_ID> --branch feature-branch --commit abc123

# Expected:
# - Build with specified branch and commit
```

### 6.2 Cancel Build

```bash
cargo run -p oore-cli -- build cancel <BUILD_ID>

# Expected:
# - Build status changed to cancelled
# - Only works for pending/running builds
```

### 6.3 List Builds with Filters

```bash
cargo run -p oore-cli -- build list --repo <REPO_ID>

# Expected:
# - Only builds for specified repo shown
```

**Industry Standard Check:**
- [ ] Cannot cancel already completed builds
- [ ] Build history is retained
- [ ] Filtering works correctly

---

## Phase 7: Service Management (Production Mode)

**Note:** These tests require sudo and affect system services.

### 7.1 Install Service

```bash
# Build release version first
cargo build --release

# Install as system service
sudo ./target/release/oored install

# Expected:
# - Binary copied to /usr/local/bin/oored
# - Config directory created at /etc/oore/
# - Data directory created at /var/lib/oore/
# - Log directory created at /var/log/oore/
# - Service file created (launchd plist or systemd unit)
```

**Verify files:**
```bash
ls -la /usr/local/bin/oored
ls -la /etc/oore/
ls -la /var/lib/oore/
ls -la /var/log/oore/

# macOS
ls -la /Library/LaunchDaemons/build.oore.oored.plist

# Linux
ls -la /etc/systemd/system/oored.service
```

### 7.2 Configure Service

```bash
# Edit config
sudo nano /etc/oore/oore.env

# Ensure all required variables are set:
# - OORE_BASE_URL (your production URL)
# - OORE_ADMIN_TOKEN
# - ENCRYPTION_KEY
# - GITLAB_SERVER_PEPPER
```

### 7.3 Start Service

```bash
sudo oored start

# Expected:
# - Service starts successfully
# - Server listening on port 8080

oored status

# Expected:
# - Service running
# - PID shown
# - Uptime shown
```

### 7.4 View Logs

```bash
oored logs

# Show recent logs

oored logs -f

# Follow logs in real-time
```

### 7.5 Stop and Restart

```bash
sudo oored stop
# Expected: Service stopped

sudo oored start
# Expected: Service started again
```

### 7.6 Uninstall (Cleanup)

```bash
# Remove service but keep data
sudo oored uninstall

# Remove everything including data
sudo oored uninstall --purge
```

**Industry Standard Check:**
- [ ] Service starts on boot
- [ ] Service restarts on crash
- [ ] Logs are rotated
- [ ] Config file permissions are secure (600 or 640)
- [ ] PID file management works correctly

---

## Phase 8: Error Handling & Edge Cases

### 8.1 Invalid Admin Token

```bash
# Temporarily unset admin token
OORE_ADMIN_TOKEN="" cargo run -p oore-cli -- github status

# Expected:
# - Clear error: "Admin token required" or similar
# - No stack trace exposed
```

### 8.2 Missing Encryption Key

Test behavior when ENCRYPTION_KEY is missing or invalid (requires fresh database).

### 8.3 Invalid Webhook Signature

```bash
# Send a webhook with bad signature
curl -X POST http://localhost:8080/api/webhooks/github \
  -H "X-Hub-Signature-256: sha256=invalid" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"ref": "refs/heads/main"}'

# Expected: 401 Unauthorized
```

### 8.4 Duplicate Webhook

```bash
# Send same webhook twice (same delivery ID)
# Second request should be deduplicated

# Expected: 200 OK but no duplicate processing
```

### 8.5 Unknown Repository

```bash
# Send webhook for repo not in system
# Expected: Handled gracefully, logged as unknown
```

### 8.6 Network Errors

Test behavior when:
- GitHub API is unreachable during sync
- GitLab API is unreachable during project list
- Database file is locked

**Industry Standard Check:**
- [ ] All errors have user-friendly messages
- [ ] No secrets or stack traces in error responses
- [ ] Transient errors suggest retry
- [ ] Fatal errors explain what's wrong

---

## Phase 9: Security Verification

### 9.1 Credential Storage

```bash
# Check database directly
sqlite3 oore.db "SELECT * FROM github_app_credentials;"

# Expected:
# - private_key_encrypted is NOT plaintext (should be base64 gibberish)
# - webhook_secret_encrypted is NOT plaintext
```

### 9.2 HMAC Tokens

```bash
sqlite3 oore.db "SELECT webhook_secret_hmac FROM repositories WHERE provider='gitlab';"

# Expected:
# - HMAC value, not the actual secret
```

### 9.3 OAuth State Protection

```bash
sqlite3 oore.db "SELECT * FROM oauth_state;"

# Expected:
# - States expire (check expires_at)
# - Used states are marked (used_at not null)
```

### 9.4 API Authentication

```bash
# Admin endpoints without token
curl http://localhost:8080/api/setup/status

# Expected: 401 Unauthorized

# With valid token
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:8080/api/setup/status

# Expected: 200 OK with status
```

**Industry Standard Check:**
- [ ] No credentials logged anywhere
- [ ] Encryption at rest for all secrets
- [ ] HTTPS enforced in production (or warned)
- [ ] Admin endpoints properly protected
- [ ] Rate limiting on sensitive endpoints

---

## Phase 10: Frontend Testing (Optional)

### 10.1 Start Frontend

```bash
cd web
bun dev

# Expected: Next.js dev server on http://localhost:3000
```

### 10.2 Verify API Connection

- [ ] Dashboard loads
- [ ] Can see repository list (if any)
- [ ] Can see build history (if any)
- [ ] CORS works correctly (check browser console)

---

## Issues Checklist

Use this to track issues found during testing:

### Setup & Init
- [ ] Issue:
- [ ] Issue:

### GitHub Integration
- [ ] Issue:
- [ ] Issue:

### GitLab Integration
- [ ] Issue:
- [ ] Issue:

### Repository Management
- [ ] Issue:
- [ ] Issue:

### Webhook Handling
- [ ] Issue:
- [ ] Issue:

### Build Management
- [ ] Issue:
- [ ] Issue:

### Service Management
- [ ] Issue:
- [ ] Issue:

### Error Handling
- [ ] Issue:
- [ ] Issue:

### Security
- [ ] Issue:
- [ ] Issue:

### UX / Polish
- [ ] Issue:
- [ ] Issue:

---

## Industry Standard Comparison

### What Codemagic Does Well (to match)
- [ ] GitHub App auto-configures webhooks on installation
- [ ] Clear build pipeline visualization
- [ ] Automatic retry on transient failures
- [ ] Build artifact storage and download
- [ ] Slack/email notifications
- [ ] Team management and permissions
- [ ] Build caching for faster builds

### MVP Gaps to Address
After testing, prioritize these gaps:

1. **Critical (blocks usage):**
   - [ ] Actual build execution (currently just records)
   - [ ] Build logs and output

2. **Important (poor UX without):**
   - [ ] Web dashboard for non-CLI users
   - [ ] Build notifications
   - [ ] Clear setup wizard

3. **Nice to have:**
   - [ ] Multiple build pipelines per repo
   - [ ] Build matrix (iOS + Android)
   - [ ] PR status checks
