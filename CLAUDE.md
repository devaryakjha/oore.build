# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oore is a **self-hosted Codemagic alternative** for Flutter CI/CD.

**The core idea:** Your Mac is the CI server. Install `oored` (the server daemon) on a Mac mini or Mac Studio. Control it remotely via `oore` (CLI) or the web dashboard from anywhere.

```
┌─────────────────────┐                    ┌─────────────────────────────────────┐
│   Your Laptop       │                    │         Your Mac (the server)        │
│                     │                    │                                      │
│  ┌───────────────┐  │      HTTPS         │  ┌──────────┐    ┌───────────────┐  │
│  │  oore (CLI)   │──┼───────────────────▶│  │  oored   │───▶│    Keychain    │  │
│  └───────────────┘  │                    │  │ (server) │    │  certs/profiles│  │
│                     │                    │  └──────────┘    └───────────────┘  │
│  ┌───────────────┐  │      HTTPS         │       │                             │
│  │    Browser    │──┼───────────────────▶│       ▼                             │
│  └───────────────┘  │                    │  ┌──────────┐    ┌───────────────┐  │
│                     │                    │  │  SQLite  │    │   Artifacts    │  │
└─────────────────────┘                    │  │    DB    │    │   .ipa/.apk    │  │
                                           │  └──────────┘    └───────────────┘  │
         GitHub/GitLab ────webhooks───────▶│                                      │
                                           └─────────────────────────────────────┘
```

**Three components:**
- `oored` (server) — Runs **on the Mac**. Receives webhooks, executes builds, stores artifacts.
- `oore` (CLI) — Runs **anywhere**. HTTP client that talks to `oored`.
- Web dashboard — Runs **anywhere**. Browser UI, same capabilities as CLI.

## Why Self-Hosted?

With hosted CI, you upload credentials to their cloud. With Oore, credentials stay in Keychain on your Mac.

- **Credentials stay local**: Certs/profiles never leave your machine
- **Dedicated hardware**: Predictable builds on Apple Silicon you own
- **Fixed cost**: No per-minute billing
- **Full control**: Code never leaves your network

## Project Status

Early development. Implemented:
- GitHub App manifest flow (setup via CLI, automatic app creation)
- GitLab OAuth flow (connect, token refresh, multi-instance support)
- GitHub/GitLab webhook ingestion and verification
- Repository and build management (API + CLI)
- Pipeline configuration (YAML and HUML formats)
- Service management (install/start/stop/logs)
- Background webhook processing
- Encrypted credential storage (AES-256-GCM)
- CLI profile-based configuration (`~/.oore/config.huml`)

## Rules

**STRICTLY FOLLOW THESE RULES:**

1. **Use bun, not npm/yarn/pnpm** - All frontend package management and scripts must use `bun`. Never use npm, yarn, or pnpm.
2. **Use shadcn/ui for all UI components** - Never install other component libraries. Use `bunx --bun shadcn@latest add <component>` to add components.
3. **No Radix - Use @base-ui only** - Never use @radix-ui packages. shadcn is configured to use @base-ui in this repository. For element composition (e.g., Link inside Button), use the `render` prop pattern:
   ```tsx
   // Correct - use render prop with nativeButton={false} for non-button elements
   <Button nativeButton={false} render={<Link href="/path" />}>
     Button Text
   </Button>

   // Never use asChild (that's Radix pattern)
   ```
   See https://base-ui.com/llms.txt for full documentation
4. **Icon library: hugeicons** - Use hugeicons as configured in the shadcn preset.
5. **Maintain progress logs** - At the end of each session, create or update `progress/YYYY-MM-DD.md` with:
   - Summary of what was done
   - Key decisions made (with rationale)
   - Important findings
   - Files created/modified
   - Next steps

## Documentation

Documentation is built with Starlight (Astro). Refer to these docs for implementation details:

| Doc | Contents |
|-----|----------|
| `docs/src/content/docs/guides/service-management.mdx` | Service install/start/stop, file locations, troubleshooting |
| `docs/src/content/docs/guides/pipelines.mdx` | Pipeline configuration (YAML and HUML formats) |
| `docs/src/content/docs/configuration.mdx` | All environment variables |
| `docs/src/content/docs/reference/cli.mdx` | CLI commands and usage |
| `docs/src/content/docs/reference/api.mdx` | REST API endpoints |
| `docs/src/content/docs/integrations/github.mdx` | GitHub App setup |
| `docs/src/content/docs/integrations/gitlab.mdx` | GitLab OAuth/webhook setup |

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
│   │   ├── migrations/ # SQLx migrations (at crate root, run on startup)
│   │   └── src/
│   │       ├── crypto/     # HMAC, AES encryption
│   │       ├── db/         # SQLx pool, repository queries, credentials
│   │       ├── models/     # Repository, Build, WebhookEvent
│   │       ├── oauth/      # GitHub App & GitLab OAuth clients
│   │       ├── providers/  # GitHub, GitLab configs
│   │       └── webhook/    # Signature verification, payload parsing
│   │
│   ├── oore-server/    # Axum HTTP server (binary: oored)
│   │   └── src/
│   │       ├── routes/     # API endpoints (including github_oauth, gitlab_oauth)
│   │       ├── service/    # System service management (launchd/systemd)
│   │       └── worker/     # Background webhook processor
│   │
│   └── oore-cli/       # CLI client (binary: oore)
│       └── src/
│           ├── config.rs   # Profile-based config loading (~/.oore/config.huml)
│           └── commands/   # repo, build, webhook, github, gitlab, config
│
├── web/                # Next.js frontend (bun only)
│
├── docs/               # Starlight documentation site (Astro)
│   └── src/content/docs/   # MDX documentation files
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
# First-time setup (installs dependencies, creates .env.local)
make setup
# or: ./install.local.sh

# Start server + web dashboard together
make dev

# Or run separately:
make server         # Terminal 1: Start server
make cli ARGS=health # Terminal 2: Test CLI
make web            # Terminal 3: Start frontend
```

**Background mode** (run server without blocking terminal):
```bash
make server-bg      # Start in background
make logs           # View logs
make server-stop    # Stop server
```

Run `make help` for all available commands.

## File Locations (Installed Service)

| Item | macOS | Linux |
|------|-------|-------|
| Binary | `/usr/local/bin/oored` | `/usr/local/bin/oored` |
| Server Config | `/etc/oore/oore.env` | `/etc/oore/oore.env` |
| CLI Config | `~/.oore/config.huml` | `~/.oore/config.huml` |
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
