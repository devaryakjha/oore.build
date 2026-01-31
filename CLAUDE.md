# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oore is a **self-hosted CI/CD for Flutter**. Your Mac is the server—install `oored` on a Mac mini/Studio, control it remotely via web dashboard.

```
Browser ──HTTPS──▶ oored (Mac) ──▶ Keychain (certs)
                       │
GitHub/GitLab ─webhooks─▶ SQLite + Artifacts (.ipa/.apk)
```

**Two components:** `oored` (server daemon on Mac) + Web dashboard (Next.js, runs anywhere).

See `README.md` for full context and `ROADMAP.md` for current status.

## Development Commands

```bash
# Quick start
make setup              # First-time setup (creates .env.local)
make dev                # Server + web dashboard together

# Rust
cargo build             # Build all crates
cargo test              # Run all tests
cargo clippy            # Lint
make types              # Regenerate TS types from Rust

# Frontend (bun only, never npm/yarn)
cd web && bun dev       # Dev server :3000
cd web && bun run build # Production build
bunx --bun shadcn@latest add <component>  # Add UI components

# Service management
sudo ./target/release/oored install  # Install service
sudo oored start/stop/status         # Manage service
oored logs -f                        # Follow logs
```

Run `make help` for all commands.

## Architecture

```
crates/
├── oore-core/           # Shared library
│   ├── db/              # SQLx queries, credentials
│   ├── models/          # Domain types (with #[derive(TS)])
│   ├── oauth/           # GitHub App & GitLab OAuth
│   ├── crypto/          # HMAC, AES-256-GCM encryption
│   └── webhook/         # Signature verification
│
└── oore-server/         # Axum HTTP server (binary: oored)
    ├── routes/          # API endpoints
    ├── service/         # launchd/systemd management
    └── worker/          # Background webhook processor

web/                     # Next.js frontend (bun only)
types/                   # Auto-generated TS types from Rust
site/                    # Docs + landing (Astro/Starlight)
documentation/           # Internal dev docs (TESTING.md, etc.)
```

## Rules

**STRICTLY FOLLOW:**

1. **bun only** — Never npm/yarn/pnpm for frontend.

2. **shadcn/ui with @base-ui** — Never Radix. Use `render` prop for composition:
   ```tsx
   <Button nativeButton={false} render={<Link href="/path" />}>Text</Button>
   ```
   See https://base-ui.com/llms.txt

3. **hugeicons** — Icon library configured in shadcn preset.

4. **Regenerate types after Rust changes** — When modifying `#[derive(TS)]` structs:
   ```bash
   make types  # Regenerates types/ folder
   ```
   - Add `#[ts(optional)]` for `Option<T>` fields
   - Add `#[ts(type = "number")]` for `i64` fields
   - Export path: `#[ts(export, export_to = "../../../types/")]`

5. **Progress logs** — End of session, update `~/project_logs/oore.build/YYYY-MM-DD.md` (Obsidian vault, not committed).

6. **Testing** — New features need:
   - API tests in `crates/oore-server/tests/api_tests.rs`
   - User journey in `documentation/user-journeys.md`
   - See `documentation/TESTING.md`

7. **Roadmap sync** — Update both `ROADMAP.md` and `site/src/content/docs/roadmap.mdx` when changing feature status.

## Key Patterns

| Pattern | Implementation |
|---------|----------------|
| **IDs** | ULID (sortable, URL-safe) |
| **Auth** | Admin token in header/cookie, constant-time comparison |
| **Webhooks** | Store immediately, process async in background worker |
| **Credentials** | AES-256-GCM encrypted in SQLite |
| **GitLab tokens** | HMAC with server pepper (not plaintext) |
| **Service** | LaunchDaemon (macOS only) |

## Type Generation Workflow

Rust structs with `#[derive(TS)]` auto-generate TypeScript types:

```rust
// In crates/oore-core/src/models/ or routes/
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct MyResponse {
    pub id: String,
    #[ts(optional)]
    pub name: Option<String>,
    #[ts(type = "number")]
    pub count: i64,
}
```

After changes: `make types` → imports available as `@oore/types` in web/.

## Documentation

| Need | Location |
|------|----------|
| Environment variables | `site/src/content/docs/configuration.mdx` |
| API reference | `site/src/content/docs/reference/api.mdx` |
| GitHub integration | `site/src/content/docs/integrations/github.mdx` |
| GitLab integration | `site/src/content/docs/integrations/gitlab.mdx` |
| Testing guide | `documentation/TESTING.md` |
| Feature development | `documentation/FEATURE_DEVELOPMENT.md` |

## File Locations (Installed Service)

| Item | Path |
|------|------|
| Binary | `/usr/local/bin/oored` |
| Config | `/etc/oore/oore.env` |
| Data/DB | `/var/lib/oore/` |
| Logs | `/var/log/oore/oored.log` |
| Service | `/Library/LaunchDaemons/build.oore.oored.plist` |
