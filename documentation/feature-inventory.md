# Oore.build Feature Inventory

> Generated: 2026-01-31
> Purpose: Comprehensive feature tracking for prioritization and development planning

---

## Implemented Features (23 Total)

### 1. Webhook Integration
**Status:** FULL
**Sub-features:**
- GitHub webhook handler (`POST /api/webhooks/github`)
- GitLab webhook handler (`POST /api/webhooks/gitlab/{repo_id}`)
- HMAC-SHA256 signature verification for both providers
- Support for push, pull_request, merge_request events
- GitHub App installation event handling
- Async webhook processing (store immediately, process in background)
- Per-repository webhook URL generation
- Webhook secret management (HMAC-hashed for GitLab)
- Replay detection using delivery IDs
- Payload size limiting (MAX_WEBHOOK_SIZE)
- Webhook event listing and retrieval API
- Unprocessed event recovery on startup

**Files:**
- `crates/oore-core/src/webhook/`
- `crates/oore-server/src/routes/webhooks.rs`
- `crates/oore-server/src/worker/webhook_processor.rs`

---

### 2. GitHub Integration
**Status:** FULL
**Sub-features:**
- GitHub App manifest-based creation (simplified setup)
- OAuth state management with CSRF protection
- Installation access token generation for private repos
- Token refresh mechanism
- Multi-installation support
- Private key encryption (AES-256-GCM)
- Webhook secret encryption
- Installation tracking and listing
- Installation status polling
- Repository selection tracking (all vs selected)
- Permissions and events subscription tracking
- Automatic private repository cloning with injected tokens
- Setup flow via web dashboard

**Files:**
- `crates/oore-core/src/oauth/github.rs`
- `crates/oore-server/src/routes/github_oauth.rs`
- `web/src/app/(auth)/settings/github/page.tsx`

---

### 3. GitLab Integration
**Status:** FULL
**Sub-features:**
- OAuth token-based authentication
- Multi-instance GitLab support (self-hosted + gitlab.com)
- Per-instance OAuth app registration
- Access token encryption (AES-256-GCM)
- Refresh token encryption
- Token expiration tracking
- Token refresh support
- HMAC-based token storage (never plaintext)
- Per-repository project linking
- Webhook ID and token tracking per project
- Private repository cloning with token injection
- Setup flow via web dashboard

**Files:**
- `crates/oore-core/src/oauth/gitlab.rs`
- `crates/oore-server/src/routes/gitlab_oauth.rs`
- `web/src/app/(auth)/settings/gitlab/page.tsx`

---

### 4. Repository Management
**Status:** FULL
**Sub-features:**
- Create repositories (CRUD operations)
- List repositories (with optional filtering by provider)
- Get repository details by ID
- Update repository settings (name, branch, provider IDs)
- Delete repositories
- Track provider-specific IDs (GitHub repo ID, GitLab project ID)
- Active/inactive status toggle
- Default branch configuration
- Webhook URL generation per repository
- Support for both GitHub and GitLab providers

**Files:**
- `crates/oore-server/src/routes/repositories.rs`
- `crates/oore-core/src/models/repository.rs`
- `crates/oore-core/src/db/repository.rs`

---

### 5. Build Execution
**Status:** FULL
**Sub-features:**
- Webhook-triggered builds (automatic on push/MR/PR)
- Manual build triggering via API
- Build status tracking (Pending → Running → Success/Failure/Cancelled)
- Build queue with concurrent build limiting (configurable, default 2)
- Repository cloning with proper authentication
- Step-by-step execution with individual shell commands
- Build cancellation (for pending/running builds)
- Build duration tracking
- Workspace cleanup after builds
- Trigger type tracking (push, pull_request, merge_request, manual)
- Commit SHA and branch specification
- Unprocessed build recovery on startup
- Graceful shutdown support

**System Build Steps:**
- Repository clone step (step -1000)
- Flutter setup/initialization step (step -100)
- User-defined pipeline steps (0+)
- Cleanup step (step i32::MAX - 1)

**Files:**
- `crates/oore-core/src/pipeline/executor.rs`
- `crates/oore-server/src/worker/build_processor.rs`
- `crates/oore-server/src/routes/builds.rs`

---

### 6. Pipeline Configuration
**Status:** FULL
**Sub-features:**
- YAML-based pipeline configuration
- HUML-based pipeline configuration (alternative format)
- Pipeline validation before saving
- Multiple workflows per pipeline
- Per-repository pipeline management
- Active/inactive configuration states
- Pipeline parsing and syntax validation
- Configuration storage in database
- Config versioning with timestamps
- Environment variable injection during builds

**Files:**
- `crates/oore-core/src/pipeline/parser.rs`
- `crates/oore-core/src/pipeline/resolver.rs`
- `crates/oore-server/src/routes/pipelines.rs`
- `crates/oore-core/src/models/pipeline.rs`

---

### 7. Build Logs
**Status:** FULL
**Sub-features:**
- Per-step stdout/stderr capture
- Build log aggregation
- ANSI color code support in logs
- Log retrieval via API (full content)
- Log retrieval with line offset support (for incremental polling)
- Log content streaming
- Step-indexed log access
- Log line counting
- Persistent log storage (/var/lib/oore/logs/)
- Log download as text file
- Demo mode log support
- Timestamp recording for each log entry

**Files:**
- `crates/oore-core/src/models/build_log.rs`
- `crates/oore-core/src/db/pipeline.rs`
- `crates/oore-server/src/routes/builds.rs`

---

### 8. Build Steps & Workflows
**Status:** FULL
**Sub-features:**
- Step-by-step build execution
- Configurable step names
- Individual step status tracking (pending → running → success/failure)
- Step duration tracking
- Step output capture (stdout/stderr)
- Step index tracking
- Workflow support in pipelines
- Build step listing and retrieval
- Multi-step workflow support

**Files:**
- `crates/oore-core/src/models/build_step.rs`
- `crates/oore-core/src/db/pipeline.rs`

---

### 9. Artifact Management
**Status:** FULL
**Sub-features:**
- Artifact collection after successful builds (glob pattern matching)
- Artifact storage with directory structure preservation
- Artifact storage at `/var/lib/oore/artifacts/{build_id}/`
- Build artifact listing (metadata only)
- Build artifact download by artifact ID
- SHA-256 checksum calculation
- MIME type detection
- File size tracking
- Storage path isolation per build
- Unique artifact constraints (per relative path)
- Artifact type detection (.ipa, .apk, .aab, etc.)

**Files:**
- `crates/oore-core/src/models/artifact.rs`
- `crates/oore-core/src/db/artifact.rs`
- `crates/oore-server/src/routes/builds.rs`
- `web/src/lib/api/artifacts.ts`

---

### 10. iOS Code Signing
**Status:** FULL
**Sub-features:**
- iOS certificate (.p12) import and storage
- Encrypted certificate storage (AES-256-GCM)
- Password-protected certificate handling
- Certificate metadata extraction (CN, team ID, serial, expiration)
- Certificate type support (development, distribution)
- Import to macOS Keychain
- Provisioning profile (.mobileprovision) import
- Profile metadata extraction (bundle ID, team ID, UUID, app ID name)
- Profile type support (development, adhoc, appstore, enterprise)
- Expiration date tracking
- Certificate/profile listing per repository
- Certificate/profile deletion
- Active/inactive status management
- Duplicate profile prevention (by UUID)
- Environment variable injection during builds (CODE_SIGN_IDENTITY, PROVISIONING_PROFILE_SPECIFIER)
- Web UI for certificate/profile management

**Files:**
- `crates/oore-core/src/models/signing.rs`
- `crates/oore-core/src/signing/ios.rs`
- `crates/oore-core/src/signing/keychain.rs`
- `crates/oore-core/src/db/signing.rs`
- `crates/oore-server/src/routes/signing.rs`

---

### 11. Android Code Signing
**Status:** FULL
**Sub-features:**
- Android keystore (.jks/.pkcs12) import and storage
- Encrypted keystore storage (AES-256-GCM)
- Keystore password protection
- Key alias and key password management
- Keystore type support (jks, pkcs12)
- Keystore validation
- Keystore metadata tracking
- Keystore listing per repository
- Keystore deletion
- Unique keystore constraint per name per repository
- Active/inactive status management
- Environment variable injection during builds (KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD)
- Web UI for keystore management

**Files:**
- `crates/oore-core/src/models/signing.rs`
- `crates/oore-core/src/signing/android.rs`
- `crates/oore-core/src/db/signing.rs`
- `crates/oore-server/src/routes/signing.rs`

---

### 12. App Store Connect API Keys
**Status:** PARTIAL
**Sub-features:**
- Upload App Store Connect API key files
- Store API key data (encrypted with AES-256-GCM)
- Extract API key metadata
- List API keys per repository
- Activate/deactivate API keys
- Delete API keys

**Missing:**
- TestFlight distribution integration
- App Store submission workflow
- API key validation

**Files:**
- `crates/oore-server/src/routes/signing.rs`
- `crates/oore-core/src/models/signing.rs`
- `crates/oore-core/migrations/007_appstore_connect_api_keys.sql`

---

### 13. Credential Encryption
**Status:** FULL
**Sub-features:**
- AES-256-GCM encryption for all sensitive data
- Per-credential unique nonce generation
- Additional authenticated data (AAD) support
- HMAC-SHA256 for token hashing (GitLab)
- Server-pepper based HMAC
- Encryption key management via environment variable
- Optional encryption (demo mode bypass)
- Key validation

**Encrypted Data:**
- GitHub App private keys
- GitHub webhook secrets
- GitHub client secrets
- GitLab access tokens
- GitLab refresh tokens
- iOS certificate p12 files
- iOS certificate passwords
- iOS provisioning profiles
- Android keystores
- Android keystore/key passwords
- App Store Connect API keys

**Files:**
- `crates/oore-core/src/crypto/`
- `crates/oore-core/src/db/credentials.rs`

---

### 14. Authentication & Authorization
**Status:** FULL
**Sub-features:**
- Admin token in request header (Authorization)
- Constant-time comparison for security
- Configurable admin token (OORE_ADMIN_TOKEN env var)
- Token validation middleware
- Public endpoints (webhooks require signature only)
- GitHub App installation token minting
- GitLab OAuth token management
- Token expiration tracking
- Token refresh support (GitLab)
- Per-repository auth token resolution
- Session management for web dashboard

**Files:**
- `crates/oore-server/src/middleware/admin_auth.rs`
- `crates/oore-core/src/auth.rs`

---

### 15. Web Dashboard
**Status:** FULL
**Framework:**
- Next.js with App Router
- TypeScript throughout
- Bun package manager
- shadcn/ui components with @base-ui
- TailwindCSS for styling
- Hugeicons for icons
- SWR for data fetching
- Sonner for toast notifications

**Pages:**
1. **Dashboard** (`/`) - Setup status, recent builds, statistics, quick actions
2. **Repositories List** (`/repositories`) - All repositories with filtering
3. **Repository Detail** (`/repositories/[id]`) - Full info, build history, webhook status
4. **Repository Signing** (`/repositories/[id]/signing`) - iOS/Android credential management
5. **Builds List** (`/builds`) - All builds with filtering, pagination
6. **Build Detail** (`/builds/[id]`) - Metadata, steps, logs with ANSI color, artifacts
7. **Settings** (`/settings`) - Overview and connection status
8. **GitHub Settings** (`/settings/github`) - App setup, installations
9. **GitLab Settings** (`/settings/gitlab`) - OAuth connections, projects
10. **Webhooks** (`/webhooks`) - Event history and payload inspection
11. **Login** (`/login`) - Admin token authentication
12. **Error Page** - Error boundary with recovery
13. **Auth Layout** - Sidebar navigation, responsive design, dark mode

**Files:**
- `web/src/app/`
- `web/src/components/`
- `web/src/lib/api/`

---

### 16. REST API
**Status:** FULL
**Endpoints:**
```
Health & Version:
  GET /api/health
  GET /api/version
  GET /api/setup/status

Repositories:
  GET    /api/repositories
  POST   /api/repositories
  GET    /api/repositories/{id}
  PUT    /api/repositories/{id}
  DELETE /api/repositories/{id}
  GET    /api/repositories/{id}/webhook-url
  POST   /api/repositories/{id}/trigger

Builds:
  GET    /api/builds
  GET    /api/builds/{id}
  GET    /api/builds/{id}/steps
  GET    /api/builds/{id}/logs
  GET    /api/builds/{id}/logs/content
  POST   /api/builds/{id}/cancel

Artifacts:
  GET    /api/builds/{id}/artifacts
  GET    /api/builds/{id}/artifacts/{artifact_id}

Pipelines:
  GET    /api/repositories/{id}/pipeline
  PUT    /api/repositories/{id}/pipeline
  DELETE /api/repositories/{id}/pipeline
  POST   /api/pipelines/validate

Signing:
  GET    /api/repositories/{repo_id}/signing
  GET/POST/DELETE /api/repositories/{repo_id}/signing/ios/certificates
  GET/POST/DELETE /api/repositories/{repo_id}/signing/ios/profiles
  GET/POST/DELETE /api/repositories/{repo_id}/signing/android/keystores

Webhooks:
  POST   /api/webhooks/github
  POST   /api/webhooks/gitlab/{repo_id}
  GET    /api/webhooks/events
  GET    /api/webhooks/events/{id}

OAuth:
  GET    /api/github/manifest
  GitHub/GitLab callback handlers
```

**Files:**
- `crates/oore-server/src/routes/`

---

### 17. Database Layer
**Status:** FULL
**Sub-features:**
- SQLite database with proper schema
- SQLx for type-safe queries
- Migration system with 7 migrations
- Transaction support
- Repository pattern for data access
- Proper foreign key relationships
- Indexes for performance optimization
- Encryption column support

**Migrations:**
1. Initial schema (repositories, builds, webhooks, gitlab_credentials)
2. Provider credentials (GitHub App, GitLab OAuth, installations)
3. OAuth state extensions
4. Pipeline configs
5. Pipeline config format
6. Code signing and artifacts
7. App Store Connect API keys

**Tables (20+):**
- `repositories`
- `builds`
- `webhook_events`
- `webhook_deliveries`
- `github_app_credentials`
- `github_app_installations`
- `github_installation_repositories`
- `gitlab_oauth_credentials`
- `gitlab_enabled_projects`
- `gitlab_oauth_apps`
- `oauth_state`
- `pipeline_configs`
- `ios_signing_certificates`
- `ios_provisioning_profiles`
- `android_keystores`
- `build_artifacts`
- `appstore_connect_api_keys`

**Files:**
- `crates/oore-core/migrations/`
- `crates/oore-core/src/db/`

---

### 18. Service Management
**Status:** FULL (macOS only)
**Sub-features:**
- LaunchDaemon installation at `/Library/LaunchDaemons/build.oore.oored.plist`
- Binary at `/usr/local/bin/oored`
- Config file at `/etc/oore/oore.env`
- Data directory at `/var/lib/oore/`
- Log file at `/var/log/oore/oored.log`
- Service commands: install, start, stop, status, logs
- Service uninstall with cleanup
- Automatic restart on crash
- Run at system load
- File descriptor limits (65536)
- EnvironmentVariables support

**Files:**
- `crates/oore-server/src/service/`

---

### 19. Background Workers
**Status:** FULL
**Webhook Processor:**
- Async webhook event processing
- Channel-based job queue (capacity: 1000)
- Unprocessed event recovery on startup
- Batched loading (RECOVERY_BATCH_SIZE: 100)
- Backpressure handling with retries
- Graceful shutdown support
- Payload parsing for GitHub and GitLab
- Build creation from webhook events

**Build Processor:**
- Build execution in background
- Concurrent build limiting (semaphore-based)
- Build workspace management
- Repository cloning with auth
- Pipeline config resolution
- Step-by-step execution
- Log streaming to database
- Artifact collection
- Build status updates
- Graceful build cancellation

**Files:**
- `crates/oore-server/src/worker/webhook_processor.rs`
- `crates/oore-server/src/worker/build_processor.rs`

---

### 20. Flutter Support
**Status:** FULL
**Sub-features:**
- Flutter project detection
- Flutter version detection/reporting
- Flutter setup script generation
- Flutter pub get automation
- iOS build support
- Android build support
- Build artifact collection (.ipa, .apk, .aab)

**Files:**
- `crates/oore-core/src/flutter.rs`

---

### 21. Setup Status
**Status:** FULL
**Sub-features:**
- `GET /api/setup/status` endpoint
- GitHub App status (configured, installations count)
- GitLab OAuth statuses (per instance, projects count)
- Encryption key configuration status
- Admin token configuration status
- Demo mode flag

**Files:**
- `crates/oore-server/src/routes/setup.rs`

---

### 22. Demo Mode
**Status:** FULL
**Sub-features:**
- Environment variable `OORE_DEMO_MODE=true` to enable
- Simulated repositories with fake data
- Simulated builds and build history
- Simulated GitHub App status
- Simulated GitLab credentials
- Simulated build logs and steps
- Demo scenario support (normal, GitHub error, GitLab error, build failures)
- No database required for demo mode
- All API endpoints return demo data when enabled

**Files:**
- `crates/oore-core/src/demo/`

---

### 23. Configuration & Environment
**Status:** FULL
**Environment Variables:**
- `OORE_ENCRYPTION_KEY` - Encryption key for sensitive data
- `OORE_ADMIN_TOKEN` - Admin authentication token
- `OORE_DATABASE_URL` - SQLite database path
- `OORE_BASE_URL` - Server base URL
- `OORE_DEMO_MODE` - Enable demo mode
- `OORE_DEMO_SCENARIO` - Demo error scenarios
- `OORE_WORKSPACES_DIR` - Build workspace directory
- `OORE_LOGS_DIR` - Build logs directory
- `OORE_ARTIFACTS_DIR` - Artifact storage directory
- `OORE_MAX_CONCURRENT_BUILDS` - Build concurrency limit
- `OORE_ENV_FILE` - External env file path

**Files:**
- `.env.example`
- `crates/oore-server/src/`

---

## Partially Implemented Features

### 1. Build Log Streaming (WebSocket)
**Status:** PARTIAL
- **Available:** File-based polling with line offset support
- **Missing:** WebSocket endpoint for real-time streaming
- **Files:** `crates/oore-server/src/routes/builds.rs`

### 2. App Store Connect Distribution
**Status:** PARTIAL
- **Available:** API key storage and management
- **Missing:** TestFlight integration, App Store submission workflow
- **Files:** `crates/oore-core/migrations/007_appstore_connect_api_keys.sql`

---

## Planned Features (Not Started)

### Phase 2: Distribution
- TestFlight integration
- App Store submission
- Google Play Store integration
- Firebase App Distribution

### Phase 3: Notifications & Observability
- Slack integration
- Email notifications
- Webhook notifications
- Build metrics dashboard

### Phase 4: Team Features
- Multi-user authentication
- Role-based access control
- User invitations
- Organization support
- Audit logging

### Phase 5: Advanced CI/CD
- Build caching (pub cache, gradle, cocoapods)
- Build matrix (multiple SDK/Xcode versions)
- Scheduled builds (cron)
- Branch/tag filtering
- GitHub/GitLab status checks
- Environment variables UI

---

## Potential Features (Ideas)

1. **Container-based builds** - Docker/Podman isolation
2. **Remote build agents** - Distributed builds across multiple Macs
3. **Self-service GitHub App creation** - Users create their own apps
4. **Build cache sharing** - Across builds and machines
5. **Performance metrics dashboard** - Build time trends, queue analysis
6. **Secrets management UI** - Environment variable masking
7. **Rate limiting** - Per-repository, per-user
8. **Build approval workflows** - Manual approval gates
9. **Repository-level access control** - Restrict who can trigger builds
10. **Custom step templates** - Reusable build step definitions
11. **Slack integration with rich statuses** - Commit info, duration, link
12. **Build failure analysis** - Auto-detect common failure patterns
13. **Dependency scanning** - pub, gradle, cocoapods vulnerabilities
14. **Code coverage reporting** - LCOV, Codecov integration
15. **Release notes generation** - From commits/PRs

---

## Security Features

- HMAC signature verification for all webhooks
- AES-256-GCM encryption for sensitive credentials
- Constant-time comparison for token validation
- CSRF protection via OAuth state tokens
- Admin token authentication
- Private key and secret encryption
- Server pepper for GitLab HMAC
- macOS Keychain integration for iOS certs
- Payload size limiting
- Replay detection via delivery IDs

---

## Statistics

| Metric | Count |
|--------|-------|
| Rust source files | 88 |
| Server route modules | 9 |
| Web TypeScript/TSX files | 104 |
| Web pages | 13 |
| Web components | 50+ |
| Database migrations | 7 |
| Database tables | 20+ |
| API endpoints | 25+ |
| Core domain models | 12 |
