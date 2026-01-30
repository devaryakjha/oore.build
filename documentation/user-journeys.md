# Oore User Journeys

This document describes all user journeys, scenarios, and paths through the Oore platform. Use this for test planning and UX validation.

---

## User Personas

### 1. Solo Developer (Alex)
- Single Mac mini at home
- One Flutter app, personal project
- Uses CLI exclusively
- GitHub for source control

### 2. Team Lead (Jordan)
- Mac Studio in office
- Multiple Flutter apps for clients
- Team of 3 developers
- Uses Web UI primarily, CLI for automation
- Mix of GitHub and GitLab projects

### 3. DevOps Engineer (Sam)
- Enterprise environment
- Self-hosted GitLab instance
- Needs audit trails
- Heavy CLI/scripting user
- Security-conscious

---

## Journey 1: First-Time Setup

### 1.1 CLI: Fresh Installation

**Happy Path**
```
User downloads/builds oored binary
→ Runs `sudo oored init`
→ Environment file created at /etc/oore/oore.env
→ Encryption key auto-generated
→ Admin token auto-generated
→ User runs `sudo oored install`
→ Service plist/unit file created
→ User runs `sudo oored start`
→ Server starts on port 8080
→ User runs `oore config init --server http://localhost:8080 --token <admin_token>`
→ CLI config created at ~/.oore/config.huml
→ User runs `oore health`
→ Server responds healthy
```

**Alternate Scenarios**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| Port already in use | Another service on 8080 | Error message suggesting `--port` flag or env var |
| No sudo | Running install without root | Clear error: "Must run as root" |
| Re-init | Running init when config exists | Prompt to overwrite or use `--force` |
| Custom paths | User wants non-default locations | Support `--data-dir`, `--log-dir` flags |
| Network interface | User wants to bind to specific IP | Support `OORE_BIND_ADDRESS` env var |

**Error Scenarios**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| Disk full | No space for database | Clear error with space requirements |
| Permission denied | /var/lib not writable | Error with required permissions |
| Invalid encryption key | Malformed ENCRYPTION_KEY | Startup fails with validation error |
| Database locked | Multiple oored instances | Error: database is locked |

### 1.2 Web UI: First Visit

**Happy Path**
```
User opens http://localhost:8080 in browser
→ Redirected to /login (if auth enabled)
→ Enters admin token
→ Redirected to dashboard
→ Sees setup checklist:
  [ ] Connect GitHub
  [ ] Connect GitLab
  [ ] Add first repository
→ Clicks "Connect GitHub"
→ Guided through setup
```

**Alternate Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| No admin token set | Dashboard accessible without login |
| Demo mode enabled | Shows demo data with badges |
| Mobile browser | Responsive layout |
| JavaScript disabled | Graceful degradation or clear message |

---

## Journey 2: GitHub Integration

### 2.1 CLI: GitHub App Setup

**Happy Path**
```
User runs `oore github setup`
→ CLI generates manifest URL
→ Opens browser to GitHub
→ User clicks "Create GitHub App"
→ GitHub creates app from manifest
→ GitHub redirects to /setup/github/callback
→ CLI polls /api/github/setup/status
→ Poll succeeds, credentials stored
→ CLI shows "GitHub App created successfully"
→ User installs app on repositories
→ GitHub sends installation webhook
→ Repos automatically imported
```

**Alternate Scenarios**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| Browser doesn't open | headless/SSH environment | Show URL to copy manually |
| User cancels in GitHub | Closes browser/clicks cancel | CLI timeout with retry option |
| Manifest expired | Takes too long | Re-generate manifest |
| Already configured | GitHub App exists | Prompt to reconfigure or show status |
| Organization app | User is org admin | Support org-owned apps |
| Multiple orgs | User belongs to several | Let user choose which org |

**Error Scenarios**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| GitHub API down | 503 from GitHub | Retry with backoff, show status |
| Invalid manifest | Server misconfiguration | Clear error with manifest URL |
| Callback fails | Network issue | Retry mechanism |
| Token encryption fails | Missing encryption key | Fail fast with setup instructions |

### 2.2 Web UI: GitHub Setup

**Happy Path**
```
User clicks "Connect GitHub" on settings page
→ Opens GitHub in new tab
→ User creates app
→ Callback redirects to /setup/github/installed
→ Success message shown
→ User redirected to GitHub settings
→ Shows app details and installations
```

**Alternate Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Popup blocked | Show manual URL with instructions |
| User closes popup | Timeout message with retry button |
| Already connected | Show current app, offer disconnect |

### 2.3 GitHub Installation Events

**Scenarios**

| Event | Expected Behavior |
|-------|-------------------|
| App installed on repo | Repo added to database |
| App installed on all repos | All repos synced |
| App uninstalled | Repos marked inactive or removed |
| Repo added to installation | Single repo synced |
| Repo removed from installation | Repo marked inactive |
| Permissions changed | Update stored permissions |

---

## Journey 3: GitLab Integration

### 3.1 CLI: GitLab OAuth (gitlab.com)

**Happy Path**
```
User runs `oore gitlab setup`
→ CLI initiates OAuth flow
→ Opens browser to GitLab authorization
→ User authorizes application
→ GitLab redirects to /setup/gitlab/callback
→ CLI polls /api/gitlab/setup/status
→ Poll succeeds, tokens stored (encrypted)
→ CLI shows "GitLab connected as @username"
```

### 3.2 CLI: Self-Hosted GitLab

**Happy Path**
```
User runs `oore gitlab register --instance https://gitlab.company.com --client-id XXX --client-secret YYY`
→ OAuth app credentials stored
→ User runs `oore gitlab setup --instance https://gitlab.company.com`
→ Same OAuth flow but against self-hosted instance
→ Tokens stored with instance URL
```

**Alternate Scenarios**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| Multiple instances | Company has staging/prod GitLab | Support multiple credentials per instance |
| Instance offline | Self-hosted GitLab down | Clear error, retry later |
| SSL certificate issue | Self-signed cert | Option to skip verification (with warning) |
| OAuth app not admin-approved | Enterprise GitLab | Clear error about admin approval |

### 3.3 GitLab Project Enablement

**Happy Path**
```
User runs `oore gitlab projects`
→ Lists accessible projects with IDs
→ User runs `oore gitlab enable <project_id>`
→ Webhook created on GitLab project
→ Repository added to Oore database
→ Project ready for builds
```

**Alternate Scenarios**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| No maintainer access | User is developer role | Error: insufficient permissions |
| Webhook already exists | Previously enabled | Detect and update existing webhook |
| Project archived | GitLab project archived | Warning, but allow if user confirms |
| Many projects | Paginated results | Support `--page` and `--per-page` |

### 3.4 GitLab Token Refresh

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Token expires | Auto-refresh before API calls |
| Refresh token invalid | Prompt re-authorization |
| User revokes access | Clear error, prompt re-setup |

---

## Journey 4: Repository Management

### 4.1 CLI: Add Repository

**From GitHub (Auto-synced)**
```
User installs GitHub App on repo
→ Webhook received
→ Repo auto-added with correct settings
→ `oore repo list` shows new repo
```

**From GitLab (Manual Enable)**
```
User runs `oore gitlab enable <project_id>`
→ Webhook created
→ Repo added
→ `oore repo list` shows new repo
```

**Manual Add (Advanced)**
```
User runs `oore repo add --provider github --owner user --repo myapp --webhook-secret XXX`
→ Repo created with manual configuration
→ User must manually configure webhook on GitHub/GitLab
```

### 4.2 Web UI: Repository Management

**Happy Path**
```
User navigates to /repositories
→ Sees list of all repos (GitHub + GitLab)
→ Filters by provider
→ Clicks repo name
→ Sees repo details:
  - Webhook URL for manual setup
  - Recent builds
  - Pipeline configuration
  - Settings
```

**Scenarios**

| Action | Expected Behavior |
|--------|-------------------|
| Delete repo | Confirmation modal, soft delete |
| Repo with active builds | Warning before delete |
| View webhook URL | Copy button, QR code for mobile |
| Toggle repo active/inactive | Pause builds without deleting |

### 4.3 Repository States

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| Active | Receiving webhooks, builds enabled | Trigger, configure, view |
| Inactive | Paused, no builds | Reactivate, view history |
| Error | Webhook verification failing | Debug, reconfigure |
| Pending Setup | Added but no webhook yet | Complete setup |

---

## Journey 5: Pipeline Configuration

### 5.1 CLI: Pipeline from Repository File

**Happy Path**
```
User creates oore.yaml in repo root
→ Commits and pushes
→ Webhook triggers build
→ Build reads config from repo
→ Pipeline executes
```

**oore.yaml Example**
```yaml
workflows:
  build-ios:
    name: iOS Build
    scripts:
      - flutter pub get
      - flutter build ios --release
    artifacts:
      - build/ios/ipa/*.ipa
```

### 5.2 CLI: Stored Pipeline Configuration

**Happy Path**
```
User creates pipeline.yaml locally
→ Runs `oore pipeline validate pipeline.yaml`
→ Validation passes
→ Runs `oore pipeline set <repo_id> --file pipeline.yaml`
→ Config stored in database
→ Subsequent builds use stored config
```

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Both repo file and stored config | Stored config takes precedence (configurable) |
| Invalid YAML | Validation error with line numbers |
| Invalid HUML | Validation error with details |
| Missing required fields | Clear error about what's missing |
| Unknown fields | Warning but accept (forward compatibility) |

### 5.3 Pipeline Configuration Formats

**YAML (Codemagic-compatible)**
```yaml
workflows:
  ios-build:
    name: iOS Build
    max_build_duration: 60
    environment:
      flutter: stable
    scripts:
      - name: Get packages
        script: flutter pub get
      - name: Build
        script: flutter build ios
```

**HUML (Human-friendly)**
```huml
workflows {
  ios-build {
    name "iOS Build"
    max_build_duration 60

    environment {
      flutter "stable"
    }

    scripts [
      { name "Get packages" script "flutter pub get" }
      { name "Build" script "flutter build ios" }
    ]
  }
}
```

### 5.4 Web UI: Pipeline Editor

**Happy Path**
```
User navigates to /repositories/<id>
→ Clicks "Pipeline" tab
→ Sees current configuration (or empty state)
→ Edits in code editor
→ Clicks "Validate"
→ Validation passes
→ Clicks "Save"
→ Config stored
```

**Scenarios**

| Action | Expected Behavior |
|--------|-------------------|
| Syntax error while typing | Real-time validation feedback |
| Switch format (YAML ↔ HUML) | Convert with confirmation |
| Reset to repo file | Option to delete stored config |
| View history | Show previous versions |

---

## Journey 6: Build Execution

### 6.1 Webhook-Triggered Build

**GitHub Push**
```
Developer pushes to main branch
→ GitHub sends push webhook
→ Oore verifies signature (HMAC-SHA256)
→ Webhook stored in database
→ Background worker processes webhook
→ Build record created (status: pending)
→ Build worker picks up job
→ Clones repository
→ Reads pipeline config
→ Executes steps sequentially
→ Logs streamed to files
→ Build completes (status: success/failure)
→ Artifacts stored
```

**GitHub Pull Request**
```
Developer opens PR
→ GitHub sends pull_request webhook
→ Build triggered with PR head commit
→ Status check created on PR
→ Build runs
→ Status check updated (success/failure)
→ PR shows build result
```

**GitLab Merge Request**
```
Developer opens MR
→ GitLab sends merge_request webhook
→ Build triggered
→ Pipeline status updated on GitLab
→ MR shows build result
```

### 6.2 Manual Build Trigger

**CLI**
```
User runs `oore build trigger <repo_id>`
→ Uses default branch
→ Build created with trigger_type=manual
→ Queued for execution
```

```
User runs `oore build trigger <repo_id> --branch feature/xyz --commit abc123`
→ Builds specific commit on specific branch
```

**Web UI**
```
User navigates to repo page
→ Clicks "Trigger Build"
→ Modal: select branch, optional commit
→ Clicks "Start Build"
→ Redirected to build details page
→ Watches progress in real-time
```

### 6.3 Build States & Transitions

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ pending │ ──▶ │ running │ ──▶ │ success │
└─────────┘     └─────────┘     └─────────┘
                    │
                    │           ┌─────────┐
                    └─────────▶ │ failure │
                    │           └─────────┘
                    │
                    │           ┌───────────┐
                    └─────────▶ │ cancelled │
                                └───────────┘
```

| Transition | Trigger |
|------------|---------|
| pending → running | Worker picks up job |
| running → success | All steps exit 0 |
| running → failure | Step exits non-zero (unless ignore_failure) |
| running → cancelled | User cancels |
| pending → cancelled | User cancels before start |

### 6.3.1 Build Step States

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ pending │ ──▶ │ running │ ──▶ │ success │
└─────────┘     └─────────┘     └─────────┘
                    │
                    │           ┌─────────┐
                    └─────────▶ │ failure │
                                └─────────┘

Steps after a failure (unless ignore_failure):
┌─────────┐
│ skipped │
└─────────┘
```

| Step Status | Description |
|-------------|-------------|
| pending | Step not yet started |
| running | Step currently executing |
| success | Step completed with exit code 0 |
| failure | Step completed with non-zero exit |
| skipped | Step not run due to earlier failure |
| cancelled | Step interrupted by cancellation |

### 6.3.2 Pipeline Config Resolution

```
Build starts
→ Check database for stored config
→ If found: use database config (source: database)
→ If not found: check repo for oore.yaml/oore.huml
→ If found in repo: use repo config (source: repository)
→ If not found: use default minimal config (source: default)
```

| Config Source | Description |
|---------------|-------------|
| `database` | Stored via `oore pipeline set` or Web UI |
| `repository` | From oore.yaml or oore.huml in repo root |
| `default` | Minimal default when no config found |

### 6.4 Build Monitoring

**CLI**
```
User runs `oore build list`
→ Shows recent builds with status

User runs `oore build show <id>`
→ Shows build details, steps, durations

User runs `oore build logs <id> --step 2`
→ Streams logs for step 2
```

**Web UI**
```
User navigates to /builds/<id>
→ Sees build header (status, duration, commit)
→ Sees step list with individual statuses
→ Clicks step to expand logs
→ Logs auto-scroll during running builds
→ Can download full logs
```

### 6.5 Build Cancellation

**CLI**
```
User runs `oore build cancel <id>`
→ If pending: immediately cancelled
→ If running: SIGTERM sent to process, grace period, SIGKILL
→ Status updated to cancelled
```

**Web UI**
```
User clicks "Cancel" on build page
→ Confirmation modal
→ Build cancelled
→ UI updates in real-time
```

### 6.6 Build Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Step timeout | Step killed after timeout, build fails |
| Step with ignore_failure | Continue to next step, build can still succeed |
| Environment setup fails | Build fails with clear error |
| Artifact not found | Warning in logs, build continues |
| Disk full during build | Build fails, cleanup attempted |
| Network error during clone | Retry with backoff, then fail |
| Concurrent builds same repo | Queue or run in parallel (configurable) |

---

## Journey 7: Artifact Management

### 7.1 Artifact Collection

**Happy Path**
```
Build completes successfully
→ Artifacts collected based on pipeline config
→ Stored in OORE_BUILD_LOGS_DIR/artifacts/<build_id>/
→ Metadata recorded in database
```

**Pipeline Config**
```yaml
artifacts:
  - build/ios/ipa/*.ipa
  - build/app/outputs/flutter-apk/*.apk
```

### 7.2 Artifact Download

**CLI**
```
User runs `oore build artifacts <id>`
→ Lists artifacts with sizes

User runs `oore build artifacts <id> --download`
→ Downloads all artifacts to current directory

User runs `oore build artifacts <id> --download --output ./releases/`
→ Downloads to specified directory
```

**Web UI**
```
User navigates to /builds/<id>
→ Sees "Artifacts" section
→ Clicks artifact name to download
→ Or "Download All" as zip
```

### 7.3 Artifact Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Large artifacts (>1GB) | Progress indicator, resumable download |
| Artifact cleanup (old builds) | Configurable retention policy |
| Missing artifact file | Error with explanation |
| Symlinks in artifacts | Follow symlinks or skip with warning |

---

## Journey 8: Code Signing Setup

### 8.1 iOS Certificate Upload

**Web UI: Happy Path**
```
User navigates to repository signing settings
→ Clicks "Upload Certificate" button
→ Modal opens with file picker
→ User selects .p12 file from disk
→ User enters certificate password
→ User enters friendly name for certificate
→ Clicks "Upload"
→ System validates certificate format
→ System extracts metadata (subject, issuer, expiration)
→ Certificate encrypted with AES-256-GCM
→ Stored in database
→ User sees certificate in list with:
  - Friendly name
  - Subject (CN)
  - Expiration date
  - Upload date
```

**CLI: Happy Path**
```
User runs `oore signing cert upload --repo <id> --file ~/certs/dist.p12 --password "xxx" --name "Distribution"`
→ File read and validated
→ Password verified against P12
→ Metadata extracted
→ Encrypted and stored
→ Success message with certificate ID
```

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid P12 format | Error: "Invalid PKCS#12 file" |
| Wrong password | Error: "Incorrect certificate password" |
| Expired certificate | Warning shown, but allowed to upload |
| Duplicate name | Error: "Certificate with this name already exists" |
| Certificate about to expire | Warning: "Certificate expires in X days" |
| Large file (>10MB) | Error: "File too large" |

### 8.2 iOS Provisioning Profile Upload

**Web UI: Happy Path**
```
User navigates to repository signing settings
→ Clicks "Upload Profile" button
→ Modal opens with file picker
→ User selects .mobileprovision file
→ Clicks "Upload"
→ System parses profile XML/plist
→ Extracts metadata:
  - UUID
  - Bundle ID
  - Team ID
  - Expiration date
  - Profile type (development/distribution/ad-hoc)
  - Entitlements
→ Profile encrypted and stored
→ User sees profile in list with:
  - Profile name
  - Bundle ID
  - Team ID
  - Expiration date
  - Profile type badge
```

**CLI: Happy Path**
```
User runs `oore signing profile upload --repo <id> --file ~/profiles/AppStore.mobileprovision`
→ File read and parsed
→ Metadata extracted
→ Encrypted and stored
→ Success message with profile ID and details
```

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid profile format | Error: "Invalid provisioning profile" |
| Expired profile | Warning shown, but allowed to upload |
| Profile without matching cert | Warning: "No matching certificate found" |
| Duplicate UUID | Replace existing profile with confirmation |
| Development vs Distribution | Clear badge/indicator in UI |

### 8.3 Android Keystore Upload

**Web UI: Happy Path**
```
User navigates to repository signing settings
→ Clicks "Upload Keystore" button
→ Modal opens with form:
  - File picker for .jks/.keystore
  - Keystore password field
  - Key alias field
  - Key password field
  - Friendly name field
→ User fills in all fields
→ Clicks "Upload"
→ System validates keystore format
→ System verifies passwords work
→ System extracts key metadata
→ Keystore and passwords encrypted
→ Stored in database
→ User sees keystore in list with:
  - Friendly name
  - Key alias
  - Upload date
```

**CLI: Happy Path**
```
User runs `oore signing keystore upload --repo <id> \
  --file ~/keystores/release.jks \
  --store-password "xxx" \
  --key-alias "release" \
  --key-password "yyy" \
  --name "Release Keystore"`
→ File read and validated
→ Passwords verified
→ Encrypted and stored
→ Success message with keystore ID
```

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid keystore format | Error: "Invalid keystore file" |
| Wrong store password | Error: "Incorrect keystore password" |
| Wrong key password | Error: "Incorrect key password" |
| Invalid alias | Error: "Key alias not found in keystore" |
| Duplicate name | Error: "Keystore with this name already exists" |

### 8.4 Signing Configuration in Pipeline

**Pipeline Config Example**
```yaml
workflows:
  ios-release:
    signing:
      certificate: "Distribution"
      profile: "AppStore"
    scripts:
      - flutter build ipa --release

  android-release:
    signing:
      keystore: "Release Keystore"
    scripts:
      - flutter build appbundle --release
```

**Build Execution with Signing**
```
Build starts for ios-release workflow
→ Signing config detected
→ Certificate "Distribution" decrypted to temp location
→ Profile "AppStore" decrypted to temp location
→ Keychain created for build
→ Certificate imported to keychain
→ Profile installed to provisioning profiles
→ Environment variables set:
  - CODE_SIGNING_IDENTITY
  - PROVISIONING_PROFILE_SPECIFIER
→ Build steps execute
→ Keychain removed after build
→ Temp files securely deleted
```

### 8.5 CLI Signing Commands

| Command | Description |
|---------|-------------|
| `oore signing certs --repo <id>` | List certificates |
| `oore signing cert upload --repo <id>` | Upload certificate |
| `oore signing cert remove --repo <id> <cert_id>` | Remove certificate |
| `oore signing profiles --repo <id>` | List profiles |
| `oore signing profile upload --repo <id>` | Upload profile |
| `oore signing profile remove --repo <id> <profile_id>` | Remove profile |
| `oore signing keystores --repo <id>` | List keystores |
| `oore signing keystore upload --repo <id>` | Upload keystore |
| `oore signing keystore remove --repo <id> <keystore_id>` | Remove keystore |

### 8.6 Security Considerations

| Item | Protection |
|------|------------|
| Certificates | AES-256-GCM encrypted at rest |
| P12 passwords | Never stored; used only during upload validation |
| Profiles | AES-256-GCM encrypted at rest |
| Keystores | AES-256-GCM encrypted at rest |
| Keystore passwords | AES-256-GCM encrypted, separate from keystore |
| Temp files during build | Secure deletion after use |
| Build keychain | Created per-build, destroyed after |

---

## Journey 9: Build Artifacts

### 9.1 Viewing Build Artifacts (Web UI)

**Happy Path**
```
User navigates to build detail page (/builds/<id>)
→ Sees "Build Artifacts" section below steps
→ Artifacts listed in table:
  - Name (filename)
  - Type (IPA, APK, AAB, etc.)
  - Size (human-readable)
  - Upload time
→ Each row has download button
→ "Download All" button creates zip of all artifacts
```

**Empty State**
```
User views build with no artifacts
→ "Build Artifacts" section shows:
  "No artifacts collected for this build"
→ Link to pipeline docs for artifact configuration
```

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Single IPA artifact | Shows with iOS icon, size |
| Multiple artifacts | Listed in table, sortable |
| Large artifact (>1GB) | Size shown, download works |
| Failed build | May still have partial artifacts |
| Build in progress | "Artifacts will appear after build completes" |

### 9.2 Downloading Artifacts via CLI

**List Artifacts**
```
User runs `oore build artifacts <build_id>`
→ System displays table:
  ID          Name                     Type   Size
  01HXYZ...   app-release.ipa          IPA    45.2 MB
  01HABC...   app-release.apk          APK    32.1 MB
  01HDEF...   app-release.aab          AAB    28.7 MB
```

**Download Single Artifact**
```
User runs `oore build download <build_id> <artifact_id>`
→ Artifact downloaded to current directory
→ Progress bar shown for large files
→ "Downloaded app-release.ipa (45.2 MB)"
```

**Download All Artifacts**
```
User runs `oore build download <build_id> --all`
→ All artifacts downloaded to current directory
→ Progress shown for each file
→ Summary: "Downloaded 3 artifacts (106 MB total)"
```

**Download to Specific Directory**
```
User runs `oore build download <build_id> --all --output ~/releases/v1.2.0/`
→ Directory created if needed
→ Artifacts downloaded to specified path
```

### 9.3 CLI Artifact Commands

| Command | Description |
|---------|-------------|
| `oore build artifacts <build_id>` | List artifacts for build |
| `oore build download <build_id> <artifact_id>` | Download specific artifact |
| `oore build download <build_id> --all` | Download all artifacts |
| `oore build download <build_id> --all --output <dir>` | Download to directory |

### 9.4 Artifact API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/builds/:id/artifacts` | GET | List artifacts |
| `/api/builds/:id/artifacts/:artifact_id` | GET | Get artifact metadata |
| `/api/builds/:id/artifacts/:artifact_id/download` | GET | Download artifact |

### 9.5 Artifact Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Network timeout during download | Retry with resume support |
| Disk full | Error with space requirements |
| Invalid artifact ID | 404 Not Found |
| Build not found | 404 Not Found |
| Artifact deleted (retention) | 410 Gone with explanation |
| Concurrent downloads | All proceed independently |

---

## Journey 10: Service Management

### 10.1 Service Lifecycle

**Start**
```
User runs `sudo oored start`
→ Service starts
→ Binds to configured port
→ Database migrations run
→ Background workers start
→ Health endpoint available
```

**Stop**
```
User runs `sudo oored stop`
→ Graceful shutdown initiated
→ Active builds allowed to complete (configurable timeout)
→ Workers stop accepting new work
→ Database connections closed
→ Process exits
```

**Restart**
```
User runs `sudo oored restart`
→ Stop + Start
→ Minimal downtime
```

### 10.2 Log Management

**CLI**
```
User runs `oored logs`
→ Shows recent log entries

User runs `oored logs -f`
→ Follows logs in real-time (like tail -f)

User runs `oored logs -n 100`
→ Shows last 100 lines
```

### 10.3 Service Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Crash recovery | Service auto-restarts (launchd/systemd) |
| Unclean shutdown | WAL recovery on next start |
| Upgrade in place | Stop, replace binary, start |
| Config change | Restart to apply changes |
| Log rotation | Automatic rotation by size/date |

---

## Journey 11: Multi-Profile CLI Usage

### 11.1 Profile Setup

**Happy Path**
```
User runs `oore config init --server http://localhost:8080 --token abc`
→ Default profile created

User runs `oore config set --profile staging --server https://staging.oore.local --token xyz`
→ Staging profile created

User runs `oore config set --profile production --server https://prod.oore.local --token 123`
→ Production profile created
```

### 11.2 Profile Usage

```
# Use default profile
oore repo list

# Use specific profile
oore --profile staging repo list

# Switch default profile
oore config set --default staging

# Override with flags
oore --server https://other.host --token abc123 repo list
```

### 11.3 Profile Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| No config file | Prompt to run `oore config init` |
| Missing profile | Error: profile not found |
| Invalid token | 401 Unauthorized with clear message |
| Server unreachable | Connection error with retry suggestion |

---

## Journey 12: Team Collaboration (Web UI)

### 12.1 Dashboard Overview

**Happy Path**
```
User opens dashboard
→ Sees:
  - Setup status (GitHub ✓, GitLab ✓)
  - Recent builds (last 10)
  - Build statistics (success rate, avg duration)
  - Quick actions (trigger build, add repo)
```

### 12.2 Build History & Filtering

```
User navigates to /builds
→ Sees all builds across repos
→ Filters by:
  - Repository
  - Status (pending, running, success, failure)
  - Branch
  - Date range
  - Trigger type (push, PR, manual)
→ Sorts by date, duration
→ Pagination for large histories
```

### 12.3 Webhook Debugging

```
User navigates to /webhooks
→ Sees incoming webhook events
→ Filters by:
  - Repository
  - Provider (GitHub/GitLab)
  - Event type (push, PR, etc.)
  - Processed status
→ Clicks event to see:
  - Full payload (JSON)
  - Processing result
  - Associated build (if any)
  - Error message (if failed)
```

---

## Journey 13: Error Recovery

### 13.1 GitHub Webhook Verification Failures

**Symptoms**
- Builds not triggering
- Webhook events show "error"

**Debug Path**
```
User runs `oore webhook list --repo <id>`
→ Sees events with error status
→ Runs `oore webhook show <event_id>`
→ Sees "HMAC verification failed"
→ Checks webhook secret in GitHub settings
→ Regenerates webhook secret
→ Updates in Oore
→ Tests with redeliver
```

### 13.2 GitLab Token Expired

**Symptoms**
- API calls failing
- "401 Unauthorized" errors

**Recovery Path**
```
User runs `oore gitlab status`
→ Shows "Token expired"
→ Runs `oore gitlab refresh`
→ If refresh token valid: new token obtained
→ If refresh token invalid: `oore gitlab setup` to re-authorize
```

### 13.3 Database Corruption

**Symptoms**
- Server won't start
- "database disk image is malformed"

**Recovery Path**
```
User checks logs: `oored logs`
→ Sees SQLite error
→ Stops service: `sudo oored stop`
→ Backs up database: `cp /var/lib/oore/oore.db /var/lib/oore/oore.db.bak`
→ Runs integrity check: `sqlite3 /var/lib/oore/oore.db "PRAGMA integrity_check"`
→ If recoverable: `sqlite3 /var/lib/oore/oore.db ".recover" | sqlite3 /var/lib/oore/oore-recovered.db`
→ Restarts service
```

### 13.4 Build Stuck in "Running"

**Symptoms**
- Build shows "running" for too long
- No log updates

**Recovery Path**
```
User checks build: `oore build show <id>`
→ Sees running for 2 hours (timeout is 60 min)
→ Checks server: build worker may have crashed
→ Cancels build: `oore build cancel <id>`
→ Restarts service to clear worker state
→ Investigates server logs
```

---

## Journey 14: Security Scenarios

### 14.1 Credential Rotation

**GitHub App Private Key**
```
User generates new private key in GitHub
→ Downloads .pem file
→ Updates via API/CLI (future feature)
→ Old key invalidated
→ New key encrypted and stored
```

**Admin Token**
```
User edits /etc/oore/oore.env
→ Changes OORE_ADMIN_TOKEN
→ Restarts service
→ Updates CLI config: `oore config set --token <new_token>`
```

### 14.2 Audit Trail

```
User navigates to webhooks page
→ Sees all incoming requests
→ Each has timestamp, source IP, payload
→ Can trace: webhook → build → logs
```

### 14.3 Security Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid webhook signature | Reject with 401, log attempt |
| Replay attack (duplicate delivery ID) | Reject as duplicate |
| Unauthorized API access | 401 with no information leak |
| Encrypted field access | Decrypt only when needed, never log |

---

## Journey 15: Demo Mode

### 15.1 Demo Setup

```
User sets OORE_DEMO_MODE=true in /etc/oore/oore.env
→ Restarts service
→ Fake data populated:
  - Sample GitHub App
  - Sample GitLab credentials
  - Sample repositories
  - Sample builds (various statuses)
  - Sample webhook events
```

### 15.2 Demo Usage

**Web UI**
```
User opens dashboard
→ Sees demo badge/indicator
→ All features functional with fake data
→ Can trigger builds (simulated)
→ Can view logs (simulated)
```

**Limitations**
- Real webhooks not processed
- Real builds not executed
- No actual GitHub/GitLab API calls

---

## Test Scenario Matrix

### By User Action

| Action | CLI Test | Web Test | API Test |
|--------|----------|----------|----------|
| Health check | `oore health` | Dashboard loads | `GET /api/health` |
| List repos | `oore repo list` | /repositories page | `GET /api/repositories` |
| Add repo | `oore repo add` | /repositories/new | `POST /api/repositories` |
| Delete repo | `oore repo remove` | Delete button | `DELETE /api/repositories/:id` |
| Trigger build | `oore build trigger` | Trigger button | `POST /api/repositories/:id/trigger` |
| Cancel build | `oore build cancel` | Cancel button | `POST /api/builds/:id/cancel` |
| View logs | `oore build logs` | Log viewer | `GET /api/builds/:id/logs` |
| GitHub setup | `oore github setup` | Settings page | OAuth flow |
| GitLab setup | `oore gitlab setup` | Settings page | OAuth flow |

### By Error Condition

| Condition | Expected Behavior |
|-----------|-------------------|
| Server unreachable | Clear connection error |
| Invalid token | 401 with helpful message |
| Resource not found | 404 with suggestion |
| Validation error | 400 with field-level errors |
| Rate limited | 429 with retry-after |
| Server error | 500 with request ID for debugging |

### By State

| State | Conditions | Allowed Actions |
|-------|------------|-----------------|
| Fresh install | No config | Setup only |
| GitHub connected | App created | Add GitHub repos |
| GitLab connected | OAuth complete | Enable GitLab projects |
| Repo added | Webhook configured | Trigger builds, configure pipeline |
| Build running | Active execution | View logs, cancel |
| Build complete | Finished | View logs, download artifacts |

---

## Edge Cases to Consider

1. **Unicode in repo names** - Handle international characters
2. **Very long branch names** - Truncation in UI
3. **Binary files in logs** - Don't corrupt terminal output
4. **Massive log output** - Streaming, pagination
5. **Concurrent webhooks** - Same commit pushed twice rapidly
6. **Time zones** - All timestamps should be clear
7. **Offline mode** - What works without network?
8. **Mobile browsers** - Responsive design
9. **Slow connections** - Timeouts, progress indicators
10. **Browser refresh during build** - State preserved
11. **Multiple tabs** - Consistent state
12. **Session expiry** - Graceful re-auth
13. **Webhook flood** - Rate limiting, queue management
14. **Disk space exhaustion** - Graceful degradation
15. **Memory pressure** - Build worker limits

---

## Journey 16: Web UI Specific Flows

### 16.1 Login Flow

**Happy Path (Token Auth)**
```
User navigates to any page
→ Not authenticated
→ Redirected to /login
→ Enters admin token
→ Token validated against server
→ Session created (stored in localStorage/cookie)
→ Redirected to original destination
```

**Scenarios**

| Scenario | Behavior |
|----------|----------|
| Invalid token | Error message, stay on login |
| Session expired | Redirect to login |
| Remember me | Longer session duration |
| Logout | Clear session, redirect to login |

### 16.2 Dashboard Page (/)

**Components**
- Setup status cards (GitHub, GitLab)
- Recent builds list (last 10)
- Statistics (success rate, build count)
- Quick actions (trigger build, add repo)

**Scenarios**

| Scenario | Display |
|----------|---------|
| Fresh install | Setup prompts prominent |
| Fully configured | Full dashboard |
| No builds yet | Empty state with CTA |
| Demo mode | Demo badge visible |

### 16.3 Repositories Page (/repositories)

**Features**
- List all repositories
- Filter by provider (GitHub/GitLab/All)
- Search by name
- Sort by name/date
- Add new repository button

**Row Actions**
- Click row → Go to repository details
- Delete button → Confirmation modal

### 16.4 Repository Details (/repositories/[id])

**Tabs**
- Overview: Basic info, webhook URL
- Builds: Build history for this repo
- Pipeline: Configuration editor
- Settings: Repo settings

**Webhook URL Section**
```
User clicks "Show Webhook URL"
→ URL displayed with copy button
→ Instructions for GitHub/GitLab setup
→ Optional QR code for mobile
```

### 16.5 Builds Page (/builds)

**Features**
- List all builds across repos
- Filter by: status, repository, branch, trigger type
- Search by commit SHA
- Sort by date
- Pagination

**Build Row Display**
- Status badge (colored)
- Repository name
- Branch
- Commit SHA (truncated, clickable)
- Trigger type icon
- Duration
- Timestamp

### 16.6 Build Details (/builds/[id])

**Header**
- Build status (large badge)
- Repository link
- Branch and commit
- Trigger type
- Duration / "Running..."
- Cancel button (if running)
- Re-trigger button (always)

**Steps Section**
- Collapsible list of steps
- Each step shows: name, status, duration
- Click to expand logs
- Logs auto-scroll when running

**Logs Display**
- Syntax highlighting
- Stdout (default)
- Stderr (toggle)
- Download full log
- Search within logs

### 16.7 Webhooks Page (/webhooks)

**Features**
- List webhook events
- Filter by: provider, processed status, event type
- Expand to see payload
- Link to associated build

**Event Details**
- Full JSON payload (pretty-printed)
- Processing status
- Error message (if failed)
- Received timestamp

### 16.8 Settings Pages

**GitHub Settings (/settings/github)**
- Current app status
- App name and URL
- Installation list
- Disconnect button

**GitLab Settings (/settings/gitlab)**
- Credentials list (per instance)
- Token expiration status
- Enabled projects count
- Refresh token button
- Disconnect button

### 16.9 Real-Time Updates

**Polling Strategy**
```
Build details page
→ If build is running:
   → Poll every 2 seconds
   → Update step statuses
   → Append new log lines
→ If build completes:
   → Stop polling
   → Show final status
```

**WebSocket (Future)**
```
Connect to /ws/builds/<id>
→ Receive step updates
→ Receive log streams
→ Receive completion event
```

### 16.10 Error States in UI

| Error | UI Display |
|-------|------------|
| Network error | Toast notification with retry |
| 401 Unauthorized | Redirect to login |
| 404 Not Found | "Resource not found" page |
| 500 Server Error | Error page with request ID |
| Build failed | Red status, show error message |
| Webhook failed | Orange status, show reason |

### 16.11 Mobile Responsiveness

| Component | Mobile Adaptation |
|-----------|-------------------|
| Navigation | Hamburger menu |
| Build list | Card layout vs table |
| Logs | Full-width, smaller font |
| Forms | Stacked layout |
| Filters | Collapsible filter panel |

---

## Journey 17: System Status & Health (CLI)

### 17.1 CLI: Setup Status Check

**Happy Path**
```
User runs `oore setup`
→ Shows comprehensive status:
  GitHub App: ✓ Connected (app-name)
  GitLab: ✓ Connected (@username on gitlab.com)
  Encryption: ✓ Key configured
  Admin Token: ✓ Set
  Database: ✓ Connected
```

**Scenarios**

| State | Display |
|-------|---------|
| Fresh install | All items show ✗ Not configured |
| Partial setup | Mix of ✓ and ✗ |
| GitHub only | GitHub ✓, GitLab ✗ |
| Multiple GitLab instances | Lists each instance |

### 17.2 CLI: Version Check

```
User runs `oore version`
→ Shows:
  CLI version: 0.1.0
  Server version: 0.1.0
  API compatibility: ✓
```

**Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Version mismatch | Warning about compatibility |
| Server unreachable | Show CLI version only, error for server |

### 17.3 CLI: Health Check

```
User runs `oore health`
→ Shows:
  Status: healthy
  Uptime: 3d 14h 22m
  Database: connected
  Workers: 2 active
```

---

## Journey 18: Background Processing & Recovery

### 18.1 Webhook Queue Processing

**Normal Operation**
```
Webhook received via HTTP
→ Signature verified
→ Stored in database (status: unprocessed)
→ Pushed to in-memory queue (capacity: 1000)
→ Background worker picks up
→ Processes event → creates build
→ Marks event as processed
```

**Queue Full Scenario**
```
High webhook volume
→ Queue reaches 1000 items
→ New webhooks return 503 Service Unavailable
→ GitHub/GitLab retry with backoff
→ Queue drains, accepts new webhooks
```

### 18.2 Server Restart Recovery

**Webhook Recovery**
```
Server restarts
→ Queries database for unprocessed webhooks
→ Batches of 100 at a time
→ Re-enqueues for processing
→ Processing continues
```

**Build Recovery**
```
Server restarts
→ Finds builds with status=running
→ Marks as failed (interrupted by restart)
→ Sets error_message explaining interruption
→ Finds builds with status=pending
→ Re-enqueues for execution
```

### 18.3 Cleanup Tasks

**Automatic Cleanup (every 5 minutes)**
```
Cleanup task runs
→ Deletes expired OAuth states (>10 min old)
→ Deletes expired webhook deliveries (replay protection)
→ Cleans old workspaces (>24h, configurable)
```

**Scenarios**

| Item | Retention | Cleanup Action |
|------|-----------|----------------|
| OAuth state tokens | 10 minutes | Delete |
| Webhook delivery IDs | 24 hours | Delete |
| Build workspaces | 24 hours (configurable) | Delete directory |
| Build logs | Configurable | Delete files |

---

## Journey 19: Concurrent Build Management

### 19.1 Build Queue Behavior

**Default: 2 Concurrent Builds**
```
Build A triggered → starts immediately
Build B triggered → starts immediately
Build C triggered → queued (pending)
Build A completes → Build C starts
```

**Configuration**
```bash
# In /etc/oore/oore.env
OORE_MAX_CONCURRENT_BUILDS=4  # Allow 4 concurrent builds
```

### 19.2 Same Repository Builds

**Scenarios**

| Scenario | Behavior |
|----------|----------|
| Push to main, then push to feature | Both build concurrently |
| Two pushes to same branch rapidly | Both build, newer commit wins for status |
| PR opened, then updated | Both build, latest shown on PR |

### 19.3 Build Priority

| Priority | Trigger Type |
|----------|--------------|
| 1 (highest) | Manual trigger |
| 2 | Pull/Merge request |
| 3 | Push to default branch |
| 4 | Push to other branches |

---

## Journey 20: Build Environment & Workspace

### 20.1 Workspace Lifecycle

```
Build starts
→ Workspace created: /var/lib/oore/workspaces/<build_id>/
→ Repository cloned into workspace
→ Steps executed in workspace directory
→ Build completes
→ Logs moved to /var/lib/oore/logs/<build_id>/
→ Workspace cleaned up (after retention period)
```

### 20.2 Environment Variables Injected

**Always Available**
```bash
CI=true                          # Standard CI indicator
OORE=true                        # Oore-specific indicator
OORE_BUILD_ID=01HXYZ...          # Build ULID
OORE_COMMIT_SHA=abc123...        # Full commit SHA
OORE_BRANCH=main                 # Branch name
OORE_REPOSITORY_ID=01HABC...     # Repository ULID
OORE_TRIGGER_TYPE=push           # push, pull_request, merge_request, manual
```

**From Pipeline Config**
```yaml
environment:
  vars:
    FLUTTER_VERSION: "3.16.0"
    BUILD_NUMBER: "42"
```

### 20.3 Log File Structure

```
/var/lib/oore/logs/<build_id>/
├── step-0-stdout.log    # Step 0 standard output
├── step-0-stderr.log    # Step 0 standard error
├── step-1-stdout.log    # Step 1 standard output
├── step-1-stderr.log    # Step 1 standard error
└── ...
```

**Log Limits**
- Max file size: 50MB (configurable via `OORE_MAX_LOG_SIZE_BYTES`)
- Truncation: Older lines removed when limit reached

---

## Journey 21: Self-Hosted GitLab (Enterprise)

### 21.1 OAuth App Registration

**Prerequisites**
- Admin access to GitLab instance
- Network access from Oore server to GitLab

**Registration Flow**
```
Admin creates OAuth app in GitLab Admin → Applications
→ Sets callback URL: https://oore.company.com/setup/gitlab/callback
→ Grants scopes: api, read_user, read_repository
→ Copies client ID and secret
→ Runs: oore gitlab register \
    --instance https://gitlab.company.com \
    --client-id XXX \
    --client-secret YYY
→ Credentials stored (encrypted)
```

### 21.2 Security Configuration

**IP Allowlisting**
```bash
# In /etc/oore/oore.env
OORE_GITLAB_ALLOWED_CIDRS=10.0.0.0/8,192.168.1.0/24
```

**Custom CA Certificate**
```bash
# For self-signed certificates
OORE_GITLAB_CA_BUNDLE=/etc/oore/gitlab-ca.pem
```

### 21.3 Multi-Instance Support

```
User has gitlab.company.com (production)
User has gitlab-staging.company.com (staging)

→ Register both instances separately
→ Setup OAuth for each
→ Projects show instance in list
→ Commands accept --instance flag
```

**Scenarios**

| Command | Behavior |
|---------|----------|
| `oore gitlab projects` (one instance) | Uses that instance |
| `oore gitlab projects` (multiple instances) | Error: specify --instance |
| `oore gitlab projects --instance gitlab.company.com` | Uses specified instance |

---

## Journey 22: Webhook Idempotency & Security

### 22.1 Duplicate Webhook Handling

**GitHub**
```
GitHub sends webhook with X-GitHub-Delivery: abc123
→ Oore checks webhook_deliveries table
→ If delivery_id exists: return 200 OK (idempotent)
→ If new: process and store delivery_id
```

**GitLab**
```
GitLab sends webhook (no delivery ID header)
→ Oore generates ID from SHA256(payload)
→ Same deduplication logic
```

### 22.2 Signature Verification

**GitHub (HMAC-SHA256)**
```
Webhook received
→ Read X-Hub-Signature-256 header
→ Compute HMAC-SHA256(payload, webhook_secret)
→ Compare signatures (constant-time)
→ If mismatch: 401 Unauthorized
```

**GitLab (Token)**
```
Webhook received
→ Read X-Gitlab-Token header
→ Compare with stored token HMAC
→ If mismatch: 401 Unauthorized
```

### 22.3 Replay Attack Prevention

| Protection | Implementation |
|------------|----------------|
| Delivery ID uniqueness | Database unique constraint |
| Delivery ID expiration | 24-hour retention, then cleaned |
| Timestamp validation | Reject webhooks >5 min old (optional) |

---

## Journey 23: Encryption & Key Management

### 23.1 Encryption Key Setup

**Initial Generation**
```
oored init
→ Generates 32-byte random key
→ Hex-encodes to 64 characters
→ Writes to /etc/oore/oore.env as ENCRYPTION_KEY
→ Sets file permissions to 0600
```

### 23.2 What Gets Encrypted

| Data | Storage |
|------|---------|
| GitHub App private key | AES-256-GCM encrypted |
| GitHub webhook secret | AES-256-GCM encrypted |
| GitHub client secret | AES-256-GCM encrypted |
| GitLab OAuth access token | AES-256-GCM encrypted |
| GitLab OAuth refresh token | AES-256-GCM encrypted |
| GitLab webhook tokens | HMAC (not encrypted, but hashed) |

### 23.3 Key Validation on Startup

```
Server starts
→ Reads ENCRYPTION_KEY from env
→ Validates length (64 hex chars = 32 bytes)
→ Validates hex format
→ If invalid: startup fails with clear error
→ If missing: startup fails with setup instructions
```

### 23.4 Key Rotation (Future)

```
Generate new key
→ Decrypt all credentials with old key
→ Re-encrypt with new key
→ Update ENCRYPTION_KEY in env
→ Restart server
```

---

## Journey 24: GitHub Installation Sync

### 24.1 Initial Sync

```
User installs GitHub App
→ Installation webhook received
→ Installation record created
→ `oore github sync` fetches repos
→ Repos cached in github_installation_repos table
→ Repositories created in main repos table
```

### 24.2 Repository Selection

**All Repositories**
```
App installed with "All repositories"
→ All current repos synced
→ Future repos auto-added via webhook
```

**Selected Repositories**
```
App installed with specific repos
→ Only selected repos synced
→ User adds more repos in GitHub
→ Webhook triggers incremental sync
```

### 24.3 Sync Scenarios

| Event | Action |
|-------|--------|
| App installed | Create installation + repos |
| App uninstalled | Mark installation inactive |
| Repo added to installation | Add single repo |
| Repo removed from installation | Mark repo inactive |
| Permissions changed | Update installation record |
| Manual sync (`oore github sync`) | Full refresh of all installations |

---

## Journey 25: Request Limits & Backpressure

### 25.1 Webhook Size Limits

```
Webhook received
→ Check Content-Length header
→ If > 10MB: reject with 413 Payload Too Large
→ If within limit: process
```

### 25.2 Queue Backpressure

```
Webhook queue at capacity (1000)
→ New webhook arrives
→ Return 503 Service Unavailable
→ GitHub/GitLab retry with exponential backoff
→ Queue drains below threshold
→ Accept new webhooks
```

### 25.3 Build Backpressure

```
All build slots occupied
→ New build triggered
→ Status: pending
→ Queued for later execution
→ Slot becomes available
→ Pending build starts
```

---

## Journey 26: Graceful Shutdown

### 26.1 Shutdown Sequence

```
SIGTERM received (or `oored stop`)
→ Stop accepting new HTTP requests
→ Stop accepting new webhooks to queue
→ Wait for in-flight requests (30s timeout)
→ Signal build workers to stop
→ Wait for running builds to checkpoint
→ Close database connections
→ Exit cleanly
```

### 26.2 Build Interruption

```
Build running during shutdown
→ Build receives cancellation signal
→ Current step allowed to complete (with timeout)
→ Build marked as "interrupted"
→ On next startup: marked as failed
```

### 26.3 Scenarios

| Scenario | Behavior |
|----------|----------|
| `oored stop` | Graceful shutdown |
| `oored restart` | Stop + Start |
| SIGKILL | Immediate termination (ungraceful) |
| System reboot | Depends on service manager |
| OOM kill | Immediate termination (ungraceful) |

---

## Environment Variable Reference

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OORE_BASE_URL` | `http://localhost:8080` | Public URL for webhooks |
| `OORE_BIND_ADDRESS` | `0.0.0.0:8080` | Listen address |
| `DATABASE_URL` | `/var/lib/oore/oore.db` | SQLite database path |
| `DATABASE_MAX_CONNECTIONS` | `10` | Connection pool size |
| `ENCRYPTION_KEY` | (required) | 64-char hex key for AES-256-GCM |
| `OORE_ADMIN_TOKEN` | (required) | Admin API authentication |
| `OORE_DASHBOARD_ORIGIN` | `http://localhost:3000` | CORS origin for dashboard |

### Build Execution

| Variable | Default | Description |
|----------|---------|-------------|
| `OORE_WORKSPACES_DIR` | `/var/lib/oore/workspaces` | Build workspace directory |
| `OORE_LOGS_DIR` | `/var/lib/oore/logs` | Build log directory |
| `OORE_MAX_CONCURRENT_BUILDS` | `2` | Concurrent build limit |
| `OORE_MAX_BUILD_DURATION_SECS` | `3600` | Max build duration (1 hour) |
| `OORE_MAX_STEP_DURATION_SECS` | `1800` | Max step duration (30 min) |
| `OORE_MAX_LOG_SIZE_BYTES` | `52428800` | Max log file size (50MB) |
| `OORE_WORKSPACE_RETENTION_HOURS` | `24` | Workspace retention |

### GitLab Security

| Variable | Default | Description |
|----------|---------|-------------|
| `OORE_GITLAB_ALLOWED_CIDRS` | (none) | Allowed IP ranges |
| `OORE_ALLOW_BROAD_CIDRS` | `false` | Allow /8 ranges |
| `OORE_GITLAB_CA_BUNDLE` | (none) | Custom CA cert path |

### Demo Mode

| Variable | Default | Description |
|----------|---------|-------------|
| `OORE_DEMO_MODE` | `false` | Enable demo mode |
| `OORE_DEMO_SCENARIO` | `default` | Demo data scenario |

### CLI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OORE_CONFIG` | `~/.oore/config.huml` | Config file path |

---

## API Response Codes Reference

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET/PUT/DELETE |
| 201 | Created | Successful POST creating resource |
| 204 | No Content | Successful DELETE with no body |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing/invalid admin token |
| 403 | Forbidden | Valid token, insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (duplicate) |
| 413 | Payload Too Large | Request body exceeds limit |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Server bug |
| 503 | Service Unavailable | Queue full, maintenance mode |

---

## Complete CLI Command Reference

### Global Flags

| Flag | Description |
|------|-------------|
| `--profile <name>` | Use specific config profile |
| `--server <url>` | Override server URL |
| `--admin-token <token>` | Override admin token |

### Commands

| Command | Description |
|---------|-------------|
| `oore health` | Check server health |
| `oore version` | Show CLI/server versions |
| `oore setup` | Show setup status |

| Command | Description |
|---------|-------------|
| `oore config init` | Create config file |
| `oore config set` | Update profile |
| `oore config show` | Display config |
| `oore config profiles` | List profiles |
| `oore config path` | Show config path |

| Command | Description |
|---------|-------------|
| `oore repo list` | List repositories |
| `oore repo add` | Add repository |
| `oore repo show <id>` | Show repository |
| `oore repo remove <id>` | Delete repository |
| `oore repo webhook-url <id>` | Get webhook URL |

| Command | Description |
|---------|-------------|
| `oore build list` | List builds |
| `oore build show <id>` | Show build details |
| `oore build trigger <repo_id>` | Trigger build |
| `oore build cancel <id>` | Cancel build |
| `oore build steps <id>` | Show build steps |
| `oore build logs <id>` | Show build logs |

| Command | Description |
|---------|-------------|
| `oore pipeline show <repo_id>` | Show pipeline config |
| `oore pipeline set <repo_id>` | Set pipeline config |
| `oore pipeline delete <repo_id>` | Delete pipeline config |
| `oore pipeline validate <file>` | Validate config file |

| Command | Description |
|---------|-------------|
| `oore webhook list` | List webhook events |
| `oore webhook show <id>` | Show webhook details |

| Command | Description |
|---------|-------------|
| `oore github setup` | Create GitHub App |
| `oore github callback <url>` | Manual callback |
| `oore github status` | Show GitHub App info |
| `oore github installations` | List installations |
| `oore github sync` | Sync repos from GitHub |
| `oore github remove` | Remove GitHub App |

| Command | Description |
|---------|-------------|
| `oore gitlab setup` | Start OAuth flow |
| `oore gitlab status` | Show credentials |
| `oore gitlab projects` | List projects |
| `oore gitlab enable <id>` | Enable project |
| `oore gitlab disable <id>` | Disable project |
| `oore gitlab refresh` | Refresh OAuth token |
| `oore gitlab register` | Register self-hosted app |
| `oore gitlab remove <id>` | Remove credentials |

### Server Commands

| Command | Description |
|---------|-------------|
| `oored run` | Run in foreground |
| `oored init` | Initialize environment |
| `oored install` | Install as service |
| `oored uninstall` | Remove service |
| `oored start` | Start service |
| `oored stop` | Stop service |
| `oored restart` | Restart service |
| `oored status` | Show status |
| `oored logs` | View logs |
