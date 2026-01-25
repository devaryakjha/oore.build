# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oore is a **self-hosted Codemagic alternative** - a Flutter-focused CI/CD platform that runs on your own Mac hardware (Mac mini, Mac Studio) instead of cloud infrastructure. Think of it as bringing Codemagic's functionality to dedicated hardware you control.

## Why Self-Hosted?

- **Signing credentials stay local**: No uploading certs/provisioning profiles to third parties
- **Dedicated hardware**: Faster, predictable builds on Apple Silicon you own
- **No per-build costs**: Fixed hardware cost vs. pay-per-minute cloud builds
- **Full control**: Your code never leaves your network

## Project Status

Early development. Implemented:
- GitHub/GitLab webhook ingestion and verification
- Repository and build management (API + CLI)
- Service management (install/start/stop/logs)
- Background webhook processing

## Rules

**STRICTLY FOLLOW THESE RULES:**

1. **Use bun, not npm/yarn/pnpm** - All frontend package management and scripts must use `bun`. Never use npm, yarn, or pnpm.
2. **Use shadcn/ui for all UI components** - Never install other component libraries. Use `bunx --bun shadcn@latest add <component>` to add components.
3. **Icon library: hugeicons** - Use hugeicons as configured in the shadcn preset.
4. **Maintain progress logs** - At the end of each session, create or update `progress/YYYY-MM-DD.md` with:
   - Summary of what was done
   - Key decisions made (with rationale)
   - Important findings
   - Files created/modified
   - Next steps

## Documentation

Refer to these docs for implementation details:

| Doc | Contents |
|-----|----------|
| [docs/service-management.md](docs/service-management.md) | Service install/start/stop, file locations, troubleshooting |
| [docs/configuration.md](docs/configuration.md) | All environment variables |
| [docs/cli-reference.md](docs/cli-reference.md) | CLI commands and usage |
| [docs/api-reference.md](docs/api-reference.md) | REST API endpoints |
| [docs/architecture.md](docs/architecture.md) | System design, data flow, rationale |
| [docs/github-integration.md](docs/github-integration.md) | GitHub App setup |
| [docs/gitlab-integration.md](docs/gitlab-integration.md) | GitLab OAuth/webhook setup |

## Key Design Decisions

When extending the codebase, follow these established patterns:

| Decision | Why | Reference |
|----------|-----|-----------|
| **Run as root** | Industry standard (cloudflared, Homebrew). macOS dscl user creation is fragile. | [architecture.md](docs/architecture.md) |
| **SQLite** | Simple, portable, no server. Sufficient for self-hosted. | [architecture.md](docs/architecture.md) |
| **Async webhooks** | Store immediately, return fast (<10s for GitHub). Process in background worker. | [architecture.md](docs/architecture.md) |
| **ULID for IDs** | Sortable, unique, URL-safe. Better than UUIDs for time-ordered data. | [architecture.md](docs/architecture.md) |
| **System service** | LaunchDaemon/systemd for boot-time startup without user login. | [service-management.md](docs/service-management.md) |
| **HMAC for GitLab tokens** | Store `HMAC(token, pepper)` not plaintext. Secure even if DB leaks. | [gitlab-integration.md](docs/gitlab-integration.md) |
| **AES-256-GCM** | Encrypt OAuth tokens and sensitive credentials in database. | [configuration.md](docs/configuration.md) |

## Architecture

```
oore.build/
├── crates/
│   ├── oore-core/      # Shared: database, models, crypto, webhook handling
│   │   ├── migrations/ # SQLx migrations (run on startup)
│   │   └── src/
│   │       ├── crypto/     # HMAC, AES encryption
│   │       ├── db/         # SQLx pool, repository queries
│   │       ├── models/     # Repository, Build, WebhookEvent
│   │       ├── providers/  # GitHub, GitLab configs
│   │       └── webhook/    # Signature verification, payload parsing
│   │
│   ├── oore-server/    # Axum HTTP server (binary: oored)
│   │   └── src/
│   │       ├── routes/     # API endpoints
│   │       ├── service/    # System service management (launchd/systemd)
│   │       └── worker/     # Background webhook processor
│   │
│   └── oore-cli/       # CLI client (binary: oore)
│       └── src/
│           └── commands/   # repo, build, webhook, github, gitlab
│
├── web/                # Next.js frontend (bun only)
│
├── docs/               # Documentation
│
└── progress/           # Daily development logs
```

## Development Commands

### Rust

```bash
cargo build                    # Build all crates
cargo run -p oore-server       # Run server (oored) on :8080
cargo run -p oore-cli          # Run CLI (oore)
cargo test                     # Run all tests
cargo clippy                   # Lint
```

### Service Management (after building)

```bash
sudo ./target/debug/oored install   # Install as system service
sudo oored start                    # Start service
oored status                        # Check status
oored logs -f                       # Follow logs
sudo oored stop                     # Stop service
sudo oored uninstall --purge        # Remove everything
```

### Frontend (bun only)

```bash
cd web && bun dev              # Dev server on :3000
cd web && bun run build        # Production build
cd web && bun run lint         # Lint
bunx --bun shadcn@latest add <component>  # Add shadcn components
```

### Quick Start

```bash
# Terminal 1: Start the server
cargo run -p oore-server

# Terminal 2: Test with CLI
cargo run -p oore-cli -- health
cargo run -p oore-cli -- repo list

# Terminal 3: Start frontend
cd web && bun dev
```

## File Locations (Installed Service)

| Item | macOS | Linux |
|------|-------|-------|
| Binary | `/usr/local/bin/oored` | `/usr/local/bin/oored` |
| Config | `/etc/oore/oore.env` | `/etc/oore/oore.env` |
| Data/DB | `/var/lib/oore/` | `/var/lib/oore/` |
| Logs | `/var/log/oore/oored.log` | `/var/log/oore/oored.log` |
| Service | `/Library/LaunchDaemons/build.oore.oored.plist` | `/etc/systemd/system/oored.service` |

## Target Feature Set (Codemagic Parity)

- [x] **Webhook triggers**: GitHub/GitLab integration for automated builds
- [ ] **Build pipelines**: Flutter builds for iOS, Android, macOS, web
- [ ] **Code signing**: Keychain-backed certificate and provisioning profile management
- [ ] **Artifact storage**: Build history with downloadable IPAs, APKs, app bundles
- [ ] **Distribution**: Publish to TestFlight, App Store, Play Store, Firebase App Distribution
- [ ] **Notifications**: Slack, email, webhook notifications on build status
- [ ] **Web dashboard**: Team-friendly UI for triggering builds and downloading artifacts
