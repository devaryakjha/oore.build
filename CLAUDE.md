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

Early development - scaffolding complete with Rust workspace and Next.js frontend.

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

## Architecture

```
oore.build/
├── crates/
│   ├── oore-core/      # Shared types, database, business logic
│   ├── oore-server/    # Axum HTTP server (binary: oored)
│   └── oore-cli/       # CLI client (binary: oore)
└── web/                # Next.js frontend
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
cargo run -p oore-cli -- version

# Terminal 3: Start frontend
cd web && bun dev
```

## Target Feature Set (Codemagic Parity)

- **Webhook triggers**: GitHub/GitLab integration for automated builds
- **Build pipelines**: Flutter builds for iOS, Android, macOS, web
- **Code signing**: Keychain-backed certificate and provisioning profile management
- **Artifact storage**: Build history with downloadable IPAs, APKs, app bundles
- **Distribution**: Publish to TestFlight, App Store, Play Store, Firebase App Distribution
- **Notifications**: Slack, email, webhook notifications on build status
- **Web dashboard**: Team-friendly UI for triggering builds and downloading artifacts
