# Oore QA Checklist

Manual testing checklist for release validation. Check each item and note any issues.

**Version:** ___________
**Tester:** ___________
**Date:** ___________
**Platform:** ☐ macOS ☐ Linux

---

## 1. First-Time Setup

### 1.1 Server Initialization
- [ ] `sudo oored init` creates `/etc/oore/oore.env`
- [ ] Environment file contains valid ENCRYPTION_KEY (64 hex chars)
- [ ] Environment file contains OORE_ADMIN_TOKEN
- [ ] `sudo oored init --base-url https://example.com` sets correct URL
- [ ] `oored init` without sudo fails with permission error
- [ ] `sudo oored init` on existing config prompts or fails
- [ ] `sudo oored init --force` overwrites existing config

### 1.2 Service Installation
- [ ] `sudo oored install` creates service file
  - macOS: `/Library/LaunchDaemons/build.oore.oored.plist`
  - Linux: `/etc/systemd/system/oored.service`
- [ ] `sudo oored install` without init fails appropriately
- [ ] `sudo oored install --force` replaces existing service

### 1.3 Service Management
- [ ] `sudo oored start` starts the service
- [ ] `oored status` shows "running"
- [ ] Server accessible at http://localhost:8080
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] `sudo oored stop` stops the service
- [ ] `oored status` shows "stopped"
- [ ] `sudo oored restart` restarts successfully
- [ ] `oored logs` shows recent entries
- [ ] `oored logs -f` streams logs in real-time

### 1.4 CLI Configuration
- [ ] `oore config init --server http://localhost:8080 --token <token>` creates `~/.oore/config.huml`
- [ ] Config file has secure permissions (0600)
- [ ] `oore config show` displays config with masked token
- [ ] `oore config show --show-token` displays full token
- [ ] `oore config profiles` lists available profiles
- [ ] `oore config path` shows config file location

### 1.5 Basic Connectivity
- [ ] `oore health` returns healthy status
- [ ] `oore version` shows CLI and server versions
- [ ] `oore setup` shows setup status (requires admin token)

**Notes:**
```


```

---

## 2. GitHub Integration

### 2.1 GitHub App Setup (CLI)
- [ ] `oore github setup` generates manifest URL
- [ ] Browser opens to GitHub (or shows URL in headless mode)
- [ ] CLI polls for completion
- [ ] After GitHub App creation, CLI shows success message
- [ ] `oore github status` shows app details

### 2.2 GitHub App Setup (Web UI)
- [ ] Settings > GitHub shows "Connect GitHub" when not configured
- [ ] Clicking "Connect GitHub" opens GitHub in new tab
- [ ] After completion, redirected to success page
- [ ] Settings > GitHub shows app details

### 2.3 GitHub Installations
- [ ] `oore github installations` lists installations
- [ ] Installing app on GitHub org triggers webhook
- [ ] Repositories auto-sync to Oore
- [ ] `oore github sync` manually refreshes
- [ ] `oore repo list` shows GitHub repos

### 2.4 GitHub Removal
- [ ] `oore github remove` fails without --force
- [ ] `oore github remove --force` removes credentials
- [ ] `oore github status` shows not configured

**Notes:**
```


```

---

## 3. GitLab Integration

### 3.1 GitLab OAuth Setup (CLI)
- [ ] `oore gitlab setup` initiates OAuth
- [ ] Browser opens to GitLab authorization
- [ ] After authorization, CLI shows success
- [ ] `oore gitlab status` shows connection details

### 3.2 Self-Hosted GitLab
- [ ] `oore gitlab register --instance <url> --client-id <id> --client-secret <secret>` stores app
- [ ] `oore gitlab setup --instance <url>` uses registered app
- [ ] OAuth flow works with self-hosted instance

### 3.3 GitLab Projects
- [ ] `oore gitlab projects` lists accessible projects
- [ ] `oore gitlab enable <project_id>` creates webhook
- [ ] `oore gitlab disable <project_id>` removes webhook
- [ ] Enabled projects appear in `oore repo list`

### 3.4 GitLab Token Refresh
- [ ] `oore gitlab refresh` refreshes OAuth token
- [ ] Expired tokens auto-refresh on API calls

### 3.5 GitLab Removal
- [ ] `oore gitlab remove <id>` fails without --force
- [ ] `oore gitlab remove <id> --force` removes credentials

**Notes:**
```


```

---

## 4. Repository Management

### 4.1 Repository Listing
- [ ] `oore repo list` shows all repositories
- [ ] Output includes ID, provider, name, active status
- [ ] Web UI /repositories shows same repos

### 4.2 Repository Details
- [ ] `oore repo show <id>` shows full details
- [ ] `oore repo webhook-url <id>` shows webhook URL
- [ ] Web UI repository page shows details

### 4.3 Manual Repository Add
- [ ] `oore repo add --provider github --owner <o> --repo <r>` works
- [ ] Webhook secret generated if not provided
- [ ] Repository appears in list

### 4.4 Repository Deletion
- [ ] `oore repo remove <id>` deletes repository
- [ ] Repository no longer appears in list

**Notes:**
```


```

---

## 5. Pipeline Configuration

### 5.1 Pipeline Validation
- [ ] `oore pipeline validate <file>` validates YAML
- [ ] `oore pipeline validate <file>` validates HUML
- [ ] Invalid config shows parse error
- [ ] Valid config shows success with workflow names

### 5.2 Stored Pipeline Config
- [ ] `oore pipeline set <repo_id> --file <path>` stores config
- [ ] `oore pipeline show <repo_id>` displays stored config
- [ ] `oore pipeline delete <repo_id>` removes stored config

### 5.3 Web UI Pipeline Editor
- [ ] Repository page shows Pipeline tab
- [ ] Can edit pipeline in code editor
- [ ] Validate button shows errors/success
- [ ] Save button stores configuration

**Notes:**
```


```

---

## 6. Build Execution

### 6.1 Webhook-Triggered Builds (GitHub)
- [ ] Push to repository triggers build
- [ ] `oore webhook list` shows received webhook
- [ ] Build created with status "pending"
- [ ] Build executes and completes
- [ ] GitHub status check updated on PR

### 6.2 Webhook-Triggered Builds (GitLab)
- [ ] Push to repository triggers build
- [ ] Merge request triggers build
- [ ] GitLab pipeline status updated

### 6.3 Manual Build Trigger
- [ ] `oore build trigger <repo_id>` creates build
- [ ] `oore build trigger <repo_id> --branch <name>` uses specific branch
- [ ] Web UI "Trigger Build" button works
- [ ] Build starts executing

### 6.4 Build Monitoring
- [ ] `oore build list` shows builds
- [ ] `oore build show <id>` shows details
- [ ] `oore build steps <id>` shows step list
- [ ] `oore build logs <id>` shows logs
- [ ] Web UI build page shows real-time updates

### 6.5 Build Cancellation
- [ ] `oore build cancel <id>` cancels pending build
- [ ] `oore build cancel <id>` cancels running build
- [ ] Web UI cancel button works
- [ ] Cancelled build shows correct status

### 6.6 Build States
- [ ] Successful build shows status "success"
- [ ] Failed step causes build status "failure"
- [ ] Cancelled build shows status "cancelled"
- [ ] Skipped steps show status "skipped"

**Notes:**
```


```

---

## 7. Web UI

### 7.1 Dashboard
- [ ] Dashboard loads at /
- [ ] Setup status cards visible
- [ ] Recent builds list shown
- [ ] Quick action buttons work

### 7.2 Authentication
- [ ] /login page loads
- [ ] Invalid token shows error
- [ ] Valid token grants access
- [ ] Session persists on refresh

### 7.3 Repositories Page
- [ ] /repositories shows repo list
- [ ] Filter by provider works
- [ ] Click row navigates to details
- [ ] Add repository button works

### 7.4 Builds Page
- [ ] /builds shows build list
- [ ] Filter by status works
- [ ] Filter by repository works
- [ ] Click row navigates to details

### 7.5 Webhooks Page
- [ ] /webhooks shows events
- [ ] Can expand to see payload
- [ ] Shows processing status

### 7.6 Settings Pages
- [ ] /settings/github shows GitHub config
- [ ] /settings/gitlab shows GitLab config
- [ ] Connect/disconnect buttons work

### 7.7 Responsive Design
- [ ] Pages render correctly on mobile
- [ ] Navigation works on small screens

**Notes:**
```


```

---

## 8. Error Handling

### 8.1 Connection Errors
- [ ] CLI shows clear error when server unreachable
- [ ] Web UI shows error state when API fails

### 8.2 Authentication Errors
- [ ] 401 returned for missing auth
- [ ] 401 returned for invalid token
- [ ] Error message doesn't leak info

### 8.3 Validation Errors
- [ ] Invalid IDs return 400
- [ ] Missing fields return 422
- [ ] Error messages are helpful

### 8.4 Not Found Errors
- [ ] Non-existent resources return 404
- [ ] Error message identifies resource type

**Notes:**
```


```

---

## 9. Demo Mode

### 9.1 Demo Mode Activation
- [ ] Setting OORE_DEMO_MODE=true enables demo mode
- [ ] Dashboard shows demo indicator
- [ ] Fake data appears in lists

### 9.2 Demo Mode Features
- [ ] Can browse fake repositories
- [ ] Can view fake builds
- [ ] Can view fake webhook events
- [ ] Real webhooks not processed

**Notes:**
```


```

---

## 10. Edge Cases

### 10.1 Data Handling
- [ ] Unicode repository names handled
- [ ] Long branch names truncated in UI
- [ ] Large log files handled gracefully

### 10.2 Concurrency
- [ ] Multiple simultaneous webhooks processed
- [ ] Concurrent API requests work
- [ ] Build queue manages concurrent limits

### 10.3 Recovery
- [ ] Server restart recovers pending builds
- [ ] Server restart re-processes unprocessed webhooks
- [ ] Service auto-restarts on crash

**Notes:**
```


```

---

## Summary

| Section | Passed | Failed | Skipped |
|---------|--------|--------|---------|
| 1. First-Time Setup | | | |
| 2. GitHub Integration | | | |
| 3. GitLab Integration | | | |
| 4. Repository Management | | | |
| 5. Pipeline Configuration | | | |
| 6. Build Execution | | | |
| 7. Web UI | | | |
| 8. Error Handling | | | |
| 9. Demo Mode | | | |
| 10. Edge Cases | | | |
| **Total** | | | |

**Overall Status:** ☐ PASS ☐ FAIL

**Critical Issues:**
```


```

**Minor Issues:**
```


```

**Recommendations:**
```


```
