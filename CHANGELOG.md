# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub App integration for repository webhooks
- GitLab OAuth integration for repository webhooks
- Repository management (add, list, delete)
- Webhook event storage and processing
- Web dashboard shell (Next.js)
- Service management via launchd (macOS)
- Demo mode for testing without real integrations
- Admin token authentication
- AES-256-GCM credential encryption

### Changed

- Project is macOS-only (iOS builds require Xcode)

### Security

- Webhook signature verification (GitHub HMAC-SHA256, GitLab token)
- Credentials encrypted at rest in SQLite
- Constant-time token comparison

## [0.1.0] - Unreleased

Initial release planned. See [ROADMAP.md](ROADMAP.md) for details.

---

## Release Process

When releasing a new version:

1. Update this file with changes since last release
2. Update version in `Cargo.toml` workspace
3. Create a git tag: `git tag -a v0.x.x -m "Release v0.x.x"`
4. Push tag: `git push origin v0.x.x`
5. Create GitHub release from tag
