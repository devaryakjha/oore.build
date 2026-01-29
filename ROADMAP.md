# Oore Roadmap

> Self-hosted Codemagic alternative for Flutter CI/CD

**Note:** Keep this file in sync with `docs/src/content/docs/roadmap.mdx` (public docs version). When updating milestones or phases, update both files.

## Current State (Jan 2026)

**What works today:**
- GitHub/GitLab webhook integration (automatic build triggers)
- Build execution (shell scripts, Flutter commands)
- Build logs and history
- Web dashboard (repos, builds, settings)
- Service management (install/start/stop as system daemon)

**What's missing for real-world use:**
- Code signing (can't sign iOS/Android apps)
- Artifact storage (can't download built IPAs/APKs)
- Distribution (can't publish to stores)
- Notifications (no alerts when builds fail)

---

## Phase 1: Functional MVP

**Goal:** A complete end-to-end flow where you can push code, build a signed app, and download the artifact.

### 1.1 Private Repository Access
- [ ] GitHub: Mint installation access tokens for private repos
- [ ] GitLab: Inject OAuth tokens for private repo cloning
- [ ] Test with real private Flutter projects

### 1.2 Artifact Storage
- [ ] Collect artifacts after successful builds (copy files matching glob patterns)
- [ ] Store artifacts in `/var/lib/oore/artifacts/{build_id}/`
- [ ] Database: Track artifact metadata (filename, size, SHA256)
- [ ] API: `GET /api/builds/{id}/artifacts` - List artifacts
- [ ] API: `GET /api/builds/{id}/artifacts/{name}` - Download artifact
- [ ] Web: Artifacts section on build detail page with download buttons

### 1.3 Code Signing (iOS)
- [ ] CLI: `oore signing import-cert <p12-file>` - Import to Keychain
- [ ] CLI: `oore signing import-profile <mobileprovision>` - Install provisioning profile
- [ ] CLI: `oore signing list` - Show available identities and profiles
- [ ] Inject signing environment variables into build (`CODE_SIGN_IDENTITY`, `PROVISIONING_PROFILE_SPECIFIER`)
- [ ] Web: Signing credentials management page
- [ ] Secure storage: Certificate passwords in encrypted DB

### 1.4 Code Signing (Android)
- [ ] CLI: `oore signing import-keystore <jks-file>` - Store keystore securely
- [ ] Inject keystore credentials into build (`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`)
- [ ] Web: Keystore management page

### 1.5 Build Logs Polish
- [ ] Fix log streaming API for real-time output
- [ ] Web: Live log viewer with auto-scroll
- [ ] Log download as text file
- [ ] Step-by-step expandable log sections

**MVP Definition of Done:**
- Push to GitHub → Oore builds → Signed IPA/APK available for download
- Works for both iOS and Android
- Dashboard shows build status, logs, and artifact download

---

## Phase 2: Distribution

**Goal:** One-click publishing to TestFlight, App Store, and Play Store.

### 2.1 TestFlight Integration
- [ ] Store App Store Connect API key (encrypted)
- [ ] Automatic upload via `xcrun altool` or App Store Connect API
- [ ] Pipeline config: `publishing.app_store_connect.submit_to_testflight: true`
- [ ] Web: TestFlight credentials setup page
- [ ] Build detail: "Submitted to TestFlight" status indicator

### 2.2 App Store Submission
- [ ] App Store Connect API integration for review submission
- [ ] Pipeline config: `publishing.app_store_connect.submit_to_app_review: true`
- [ ] Release notes from commit messages or manual input
- [ ] Web: App Store submission status

### 2.3 Google Play Store
- [ ] Store Google Play service account JSON (encrypted)
- [ ] Upload via Google Play Developer API (or gradle plugin)
- [ ] Pipeline config: `publishing.google_play.track: internal/alpha/beta/production`
- [ ] Web: Play Store credentials setup page
- [ ] Build detail: "Uploaded to Play Store" status

### 2.4 Firebase App Distribution
- [ ] Firebase service account integration
- [ ] Pipeline config: `publishing.firebase.app_id: xxx`
- [ ] Tester groups configuration
- [ ] Web: Firebase setup page

**Phase 2 Definition of Done:**
- Push to main → Build → Signed → Automatically in TestFlight/Play Store
- Configure distribution targets per repository
- View distribution status in dashboard

---

## Phase 3: Notifications & Observability

**Goal:** Never miss a failed build. Understand your build performance.

### 3.1 Slack Integration
- [ ] OAuth: Connect Slack workspace
- [ ] Configure channel per repository
- [ ] Notifications: Build started, succeeded, failed
- [ ] Rich messages with commit info, build link, duration
- [ ] Web: Slack settings page per repository

### 3.2 Email Notifications
- [ ] SMTP configuration (or SendGrid/Postmark integration)
- [ ] Email on build failure (configurable)
- [ ] Daily digest of build activity
- [ ] Web: Email notification preferences

### 3.3 Webhook Notifications
- [ ] Outbound webhooks to any URL
- [ ] Configurable payload templates
- [ ] Events: `build.started`, `build.succeeded`, `build.failed`
- [ ] Web: Webhook configuration page

### 3.4 Build Metrics
- [ ] Track: Build duration, queue time, success rate
- [ ] Dashboard: Build time trends chart
- [ ] Dashboard: Success/failure ratio
- [ ] Per-repository statistics

---

## Phase 4: Team Features

**Goal:** Multiple users with appropriate access levels.

### 4.1 User Authentication
- [ ] User accounts with email/password
- [ ] Invite users via email
- [ ] Session management (login/logout)
- [ ] Password reset flow

### 4.2 Role-Based Access
- [ ] Roles: Owner, Admin, Developer, Viewer
- [ ] Owner: Full access, billing, delete organization
- [ ] Admin: Manage repos, users, settings
- [ ] Developer: Trigger builds, view logs, download artifacts
- [ ] Viewer: Read-only access

### 4.3 Organization Support
- [ ] Multiple organizations per server
- [ ] Organization-level settings
- [ ] Repository grouping by organization

### 4.4 Audit Log
- [ ] Log all API actions with user attribution
- [ ] Web: Audit log page with filtering
- [ ] Retention policy (30/90/365 days)

---

## Phase 5: Advanced CI/CD

**Goal:** Feature parity with hosted CI providers.

### 5.1 Build Caching
- [ ] Dependency caching (pub cache, gradle, cocoapods)
- [ ] Cache key based on lockfile hash
- [ ] Cache storage and retrieval between builds
- [ ] Cache hit/miss reporting

### 5.2 Build Matrix
- [ ] Multiple Flutter SDK versions
- [ ] Multiple Xcode versions
- [ ] Parallel platform builds (iOS + Android + Web)
- [ ] Matrix UI in dashboard

### 5.3 Scheduled Builds
- [ ] Cron-like scheduling per repository
- [ ] Nightly builds
- [ ] Web: Schedule configuration

### 5.4 Branch/Tag Filtering
- [ ] Pipeline triggers by branch pattern
- [ ] Tag-based release builds
- [ ] Skip CI for certain paths

### 5.5 GitHub/GitLab Status Checks
- [ ] Commit status updates (pending/success/failure)
- [ ] Required status checks for PRs
- [ ] Branch protection integration

### 5.6 Environment Variables UI
- [ ] Web: Manage env vars per repository
- [ ] Secret masking in logs
- [ ] Environment-specific vars (staging/production)

---

## Future Considerations

These are not planned but worth tracking:

- **Container builds**: Docker/Podman isolation for builds
- **Remote build agents**: Connect multiple Macs as build nodes
- **Self-service GitHub App**: Users create their own GitHub Apps
- **Windows/Linux builds**: Beyond macOS for Flutter web/desktop
- **Plugin system**: Custom build steps as plugins

---

## Non-Goals

To keep scope manageable, we explicitly won't build:

- **Hosted version**: Oore is self-hosted only
- **iOS Simulator testing**: Use Firebase Test Lab instead
- **Android Emulator testing**: Use Firebase Test Lab instead
- **Billing/payments**: No commercial SaaS features
- **Custom CI script languages**: Stick with shell + YAML

---

## Version Milestones

| Version | Phase | Key Features |
|---------|-------|--------------|
| **v0.1** | Phase 1 | Artifact download, iOS signing |
| **v0.2** | Phase 1 | Android signing, log polish |
| **v0.3** | Phase 2 | TestFlight + Play Store |
| **v0.4** | Phase 2 | Firebase Distribution |
| **v0.5** | Phase 3 | Slack + email notifications |
| **v0.6** | Phase 3 | Build metrics dashboard |
| **v1.0** | Phase 4 | Multi-user, RBAC |
| **v1.x** | Phase 5 | Caching, matrix, scheduling |

---

## How to Contribute

1. Pick an item from Phase 1 (MVP is the priority)
2. Check `documentation/TESTING.md` for testing requirements
3. Follow patterns in existing code
4. Update `progress/YYYY-MM-DD.md` with your changes

See `CLAUDE.md` for development setup and conventions.
