# Oore (`/ɔːr/`)

**Self-hosted, Mac-first build & release hub for Flutter.**
*Refine your code. Forge your artifacts. Own your metal.*

---

## What is Oore?

**Oore** is a self-hosted, "Mac-first" CI/CD orchestration hub designed specifically for Flutter projects. It turns a Mac mini or Mac Studio into a private build machine that can:

- listen to GitHub/GitLab webhooks (or run builds manually),
- store per-app build configuration and signing material locally (encrypted / Keychain-backed),
- run builds and produce signed artifacts,
- publish to distribution targets when you choose (manual promotion),
- and provide a simple web UI where non-devs can browse and download builds.

The goal is to remove the "Apple signing/notarization" friction and the overhead of hosted CI, while keeping your code and credentials on hardware you control.

---

## Quick Start

```bash
# Build from source
cargo build --release

# Install as system service (macOS/Linux)
sudo ./target/release/oored install

# Configure
sudo nano /etc/oore/oore.env

# Start
sudo oored start

# Check status
oored status
```

See [docs/service-management.md](docs/service-management.md) for detailed installation instructions.

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Service Management](docs/service-management.md) | Install, configure, and manage `oored` as a system service |
| [Configuration](docs/configuration.md) | Environment variables and configuration reference |
| [CLI Reference](docs/cli-reference.md) | `oore` command-line interface |
| [API Reference](docs/api-reference.md) | REST API endpoints |
| [Architecture](docs/architecture.md) | System design and technical decisions |
| [GitHub Integration](docs/github-integration.md) | GitHub App and webhook setup |
| [GitLab Integration](docs/gitlab-integration.md) | GitLab OAuth and webhook setup |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Oore Platform                        │
├─────────────────────────────────────────────────────────────┤
│  oore (CLI) ──▶ oored (server) ──▶ Build Executor           │
│       │              │                    │                  │
│       │         ┌────┴────┐               ▼                  │
│       ▼         ▼         ▼         Artifacts/Logs           │
│    REST API   SQLite   Webhooks     (/var/lib/oore)          │
│       ▲                                                      │
│       │                                                      │
│  Next.js Dashboard (web/)                                    │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **oore-core** - Shared library (database, models, crypto, webhook handling)
- **oore-server** (`oored`) - Axum HTTP server with service management
- **oore-cli** (`oore`) - Command-line client
- **web** - Next.js dashboard (in development)

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Run as root** | Industry standard for system daemons (cloudflared, Homebrew services). Avoids macOS user/group complexity. |
| **SQLite** | Simple, portable, no separate database server. Sufficient for self-hosted use. |
| **Async webhooks** | Store immediately, process in background. GitHub requires <10s response. |
| **ULID for IDs** | Sortable by time, unique, URL-safe. Better than UUIDs for builds. |
| **System service** | LaunchDaemon (macOS) / systemd (Linux) for boot-time startup. |

See [docs/architecture.md](docs/architecture.md) for detailed rationale.

---

## Development

```bash
# Terminal 1: Run server
cargo run -p oore-server

# Terminal 2: Use CLI
cargo run -p oore-cli -- health
cargo run -p oore-cli -- repo list

# Terminal 3: Run dashboard
cd web && bun dev
```

---

## Why the name "Oore"?

In industry, **ore** is raw, unrefined material—valuable, but unusable until processed.

- Your source code is the **ore**.
- Oore is the **refinery** that turns it into signed, distributable artifacts.

Pronounced like "ore," the spelling also nods to Apple's "Core" ecosystem and the Mac-first focus.

---

## Project Status

Early development. Current features:

- [x] GitHub/GitLab webhook ingestion
- [x] Repository and build management
- [x] Service management (install/start/stop/logs)
- [x] REST API and CLI
- [ ] Build execution
- [ ] Artifact storage
- [ ] TestFlight/App Store publishing
- [ ] Web dashboard

---

## License

MIT License

---

**Developed by [Aryakumar Jha](https://github.com/devaryakjha)**
