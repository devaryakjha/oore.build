<a href="https://zerodha.tech"><img src="https://zerodha.tech/static/images/github-badge.svg" align="right" /></a>

# Oore (`/ɔːr/`)

**Self-hosted CI/CD for Flutter. Your Mac is the server.**

> [!CAUTION]
> **Early development.** Build execution doesn't work yet. Star/watch and check back later.

---

## The Idea

With hosted CI (Codemagic, Bitrise, etc.), you upload your signing certificates and provisioning profiles to their cloud. Your code runs on their machines.

**Oore flips this:** Your Mac mini or Mac Studio becomes the CI server. Credentials stay in Keychain. Code never leaves your network. You control it remotely via CLI or web dashboard.

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

| Component | What it is | Where it runs |
|-----------|------------|---------------|
| `oored` | HTTP server daemon | **On the Mac** (required) |
| `oore` | CLI client | Anywhere (your laptop, CI, etc.) |
| Web dashboard | Browser UI | Anywhere (just needs to reach `oored`) |

The server (`oored`) is the brain. It receives webhooks, runs builds, stores artifacts. The CLI and web UI are just remote controls — they talk to `oored` over HTTP.

---

## Why Self-Hosted?

| Hosted CI | Oore |
|-----------|------|
| Upload certs to their cloud | Certs stay in your Keychain |
| Code runs on shared VMs | Code runs on your hardware |
| Pay per build minute | Fixed hardware cost |
| Wait in queue | Dedicated resources |
| Trust their security | Trust your own |

---

## Screenshots

> UI exists, but most functionality isn't implemented yet.

| Dashboard | Repositories |
|:---------:|:------------:|
| ![Dashboard](screenshots/dashboard.png) | ![Repositories](screenshots/repositories.png) |

| Builds | Settings |
|:------:|:--------:|
| ![Builds](screenshots/builds.png) | ![Settings](screenshots/settings.png) |

---

## Quick Start

**On your Mac (the server):**

```bash
# Build and install
cargo build --release
sudo ./target/release/oored install

# Configure and start
sudo nano /etc/oore/oore.env
sudo oored start
oored status
```

**From anywhere (CLI client):**

```bash
# Point CLI at your Mac
export OORE_SERVER_URL=https://your-mac.local:8080

# Use it
oore health
oore repo list
oore build trigger <repo-id>
```

See the [docs](https://oore.build) for full setup instructions.

---

## Project Status

**Very early development.** The core feature (build execution) doesn't exist yet.

| Feature | Status |
|---------|--------|
| GitHub/GitLab webhooks | ✅ Works |
| Repository management | ✅ Works |
| Service management | ✅ Works |
| REST API + CLI | ✅ Works |
| Web dashboard | ✅ Shell only |
| **Build execution** | ❌ Not started |
| Code signing | ❌ Not started |
| Artifact storage | ❌ Not started |
| App Store publishing | ❌ Not started |

---

## Documentation

- [Quick Start](https://oore.build/quickstart/)
- [Configuration](https://oore.build/configuration/)
- [CLI Reference](https://oore.build/reference/cli/)
- [API Reference](https://oore.build/reference/api/)
- [Architecture](https://oore.build/architecture/)
- [GitHub Integration](https://oore.build/integrations/github/)
- [GitLab Integration](https://oore.build/integrations/gitlab/)

---

## Development

```bash
# Setup (installs deps, creates .env.local)
make setup

# Run server + web together
make dev

# Or separately:
cargo run -p oore-server          # Terminal 1: Server
cargo run -p oore-cli -- health   # Terminal 2: CLI
cd web && bun dev                 # Terminal 3: Web UI
```

---

## Why "Oore"?

**Ore** is raw material — valuable, but unusable until refined.

Your source code is the ore. Oore is the refinery that turns it into signed, distributable artifacts.

---

## License

MIT

---

**[Aryakumar Jha](https://github.com/devaryakjha)** · [Zerodha](https://zerodha.tech)
