# Architecture

This document describes the architecture and design decisions of the Oore CI/CD platform.

## Overview

Oore is a self-hosted CI/CD platform designed to run on dedicated Mac hardware (Mac mini, Mac Studio). It's built with Rust for the backend and Next.js for the web dashboard.

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Oore Platform                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐     ┌──────────────┐     ┌────────────────────────┐  │
│  │   oore   │────▶│    oored     │────▶│   Build Executor       │  │
│  │   CLI    │     │   (server)   │     │   (macOS/Linux)        │  │
│  └──────────┘     └──────────────┘     └────────────────────────┘  │
│       │                  │                         │               │
│       │           ┌──────┴──────┐                  │               │
│       │           │             │                  │               │
│       │           ▼             ▼                  ▼               │
│       │     ┌──────────┐  ┌──────────┐    ┌──────────────────┐    │
│       │     │  SQLite  │  │ Webhooks │    │  Artifacts/Logs  │    │
│       │     │    DB    │  │ (GitHub/ │    │  (/var/lib/oore) │    │
│       │     └──────────┘  │  GitLab) │    └──────────────────┘    │
│       │                   └──────────┘                             │
│       │                                                            │
│       │     ┌──────────────────────────────────────────────────┐  │
│       └────▶│                   REST API                        │  │
│             └──────────────────────────────────────────────────┘  │
│                                    ▲                               │
│                                    │                               │
│             ┌──────────────────────┴───────────────────────────┐  │
│             │              Next.js Dashboard                    │  │
│             │                   (web/)                          │  │
│             └──────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### oore-core

The shared library containing:
- **Database layer**: SQLx with SQLite, automatic migrations
- **Models**: Repository, Build, WebhookEvent, Provider types
- **Crypto**: HMAC verification, AES-256-GCM encryption
- **Webhook handling**: Signature verification, payload parsing
- **Provider configs**: GitHub App, GitLab OAuth

### oore-server (oored)

The HTTP server daemon:
- **Framework**: Axum web framework
- **Routes**: REST API endpoints
- **State**: Database pool, configuration, provider configs
- **Worker**: Background webhook processor
- **Service management**: Install/start/stop as system service

### oore-cli (oore)

Command-line client:
- **Framework**: Clap for argument parsing
- **HTTP client**: Reqwest for API calls
- **Commands**: Repository, build, webhook management

### web (Next.js)

Web dashboard (in development):
- **Framework**: Next.js 14 with App Router
- **UI**: shadcn/ui components
- **Icons**: Hugeicons
- **Package manager**: Bun

## Data Flow

### Webhook Processing

```
GitHub/GitLab                    oored                       Build Executor
     │                            │                               │
     │  POST /webhooks/github     │                               │
     ├───────────────────────────▶│                               │
     │                            │ 1. Verify signature           │
     │                            │ 2. Store event                │
     │                            │ 3. Queue for processing       │
     │         {"status":"ok"}    │                               │
     │◀───────────────────────────┤                               │
     │                            │                               │
     │                            │ 4. Process in background      │
     │                            │ 5. Create build record        │
     │                            │ 6. Execute build              │
     │                            ├──────────────────────────────▶│
     │                            │                               │
     │                            │         Build output          │
     │                            │◀──────────────────────────────┤
     │                            │                               │
     │                            │ 7. Update build status        │
     │                            │ 8. Store artifacts            │
     │                            │ 9. Report to provider         │
     │◀───────────────────────────┤                               │
```

### API Request Flow

```
CLI/Dashboard            oored                    Database
     │                     │                          │
     │  GET /repositories  │                          │
     ├────────────────────▶│                          │
     │                     │  SELECT * FROM repos     │
     │                     ├─────────────────────────▶│
     │                     │                          │
     │                     │        [rows]            │
     │                     │◀─────────────────────────┤
     │                     │                          │
     │    [{"id":...}]     │                          │
     │◀────────────────────┤                          │
```

## Design Decisions

### Why Rust?

1. **Performance**: Handles concurrent builds efficiently
2. **Safety**: Memory safety without garbage collection
3. **Single binary**: Easy deployment, no runtime dependencies
4. **Cross-platform**: Builds for macOS and Linux from same codebase

### Why SQLite?

1. **Simplicity**: No separate database server to manage
2. **Portability**: Single file, easy backup/migration
3. **Performance**: WAL mode provides excellent read/write performance
4. **Reliability**: Well-tested, battle-proven database

For most self-hosted scenarios, SQLite is sufficient. The design allows for PostgreSQL support if needed in the future.

### Why System Service (launchd/systemd)?

1. **Reliability**: Auto-start at boot, auto-restart on crash
2. **Management**: Standard system tools for control
3. **Logging**: Integrated log rotation
4. **Security**: Proper privilege separation

### Why Run as Root?

After researching industry practices:
- **cloudflared**: Runs as root
- **Homebrew services**: Run as root via `sudo brew services`
- **Apple's guidance**: Daemons should be owned by root:wheel

A dedicated user could be added later for additional isolation, but root is the safe default.

### Why ULID for IDs?

1. **Sortable**: Lexicographically sortable by timestamp
2. **Unique**: 128-bit random component
3. **URL-safe**: No special characters
4. **Readable**: Easier to work with than UUIDs

Example: `01HNJX5Q9T3WP2V6Z8K4M7YRBF`

### Why Async Webhook Processing?

GitHub requires webhook responses within 10 seconds. Processing a webhook (parsing, validation, creating builds) might take longer. Solution:

1. Receive webhook, verify signature
2. Store event in database immediately
3. Return success response
4. Process in background worker

This ensures:
- Fast responses to providers
- Reliable processing (events are persisted)
- Retry capability (can reprocess failed events)

## Security Model

### Secrets Storage

| Secret | Storage | Protection |
|--------|---------|------------|
| Admin token | Environment | File permissions (0600) |
| Encryption key | Environment | File permissions (0600) |
| GitHub webhook secret | Environment | File permissions (0600) |
| GitLab webhook tokens | Database | HMAC-SHA256 (not plaintext) |
| OAuth tokens | Database | AES-256-GCM encryption |

### API Authentication

- **Public endpoints**: Health, version, webhook receivers
- **Protected endpoints**: Setup, integrations (require admin token)
- **Webhook verification**: HMAC signatures (GitHub) or token headers (GitLab)

### Network Security

- Server binds to all interfaces by default (`0.0.0.0:8080`)
- Use a reverse proxy for HTTPS in production
- Consider firewall rules for additional protection

## File Layout

### Development

```
oore.build/
├── crates/
│   ├── oore-core/           # Shared library
│   │   ├── migrations/      # Database migrations
│   │   └── src/
│   │       ├── crypto/      # HMAC, encryption
│   │       ├── db/          # Database layer
│   │       ├── models/      # Data types
│   │       ├── providers/   # GitHub, GitLab configs
│   │       └── webhook/     # Verification, parsing
│   │
│   ├── oore-server/         # Server daemon
│   │   └── src/
│   │       ├── routes/      # API endpoints
│   │       ├── service/     # System service management
│   │       └── worker/      # Background processing
│   │
│   └── oore-cli/            # CLI client
│       └── src/
│           └── commands/    # CLI commands
│
├── web/                     # Next.js dashboard
│
├── docs/                    # Documentation
│
└── progress/                # Development logs
```

### Production (Installed)

```
/usr/local/bin/
  oored                      # Server binary

/etc/oore/
  oore.env                   # Configuration (secrets)

/var/lib/oore/
  oore.db                    # SQLite database
  builds/                    # Build workspaces (future)
  artifacts/                 # Build artifacts (future)

/var/log/oore/
  oored.log                  # Server logs

/Library/LaunchDaemons/      # macOS
  build.oore.oored.plist

/etc/systemd/system/         # Linux
  oored.service
```

## Future Architecture

### Planned Components

1. **Build Executor**: Clone repos, run pipelines, collect artifacts
2. **Artifact Storage**: Store and serve build outputs (IPA, APK, etc.)
3. **Notifier**: Send Slack/email notifications
4. **Publisher**: Upload to App Store, Play Store, TestFlight

### Scalability Considerations

For high-volume usage:

1. **PostgreSQL**: Replace SQLite for better concurrency
2. **Redis**: Job queue for distributed workers
3. **S3-compatible storage**: Artifact storage
4. **Multiple workers**: Parallel build execution

The current architecture is designed to be extended without major rewrites.
