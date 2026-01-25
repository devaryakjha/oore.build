# Oore Documentation

Welcome to the Oore CI/CD platform documentation. Oore is a self-hosted Codemagic alternative that runs on your own Mac hardware.

## Guides

### Server Administration

- **[Service Management](./service-management.md)** - Install, configure, and manage the `oored` server as a system service
- **[Configuration Reference](./configuration.md)** - Complete list of environment variables and configuration options

### API & CLI

- **[API Reference](./api-reference.md)** - REST API endpoints for webhooks, repositories, and builds
- **[CLI Reference](./cli-reference.md)** - `oore` CLI commands for interacting with the server

### Integrations

- **[GitHub Integration](./github-integration.md)** - Set up webhooks and GitHub App for automated builds
- **[GitLab Integration](./gitlab-integration.md)** - Set up webhooks for GitLab repositories

## Quick Links

| Topic | Description |
|-------|-------------|
| [Quick Start](#quick-start) | Get up and running in 5 minutes |
| [Architecture](./architecture.md) | System design and component overview |
| [Troubleshooting](./service-management.md#troubleshooting) | Common issues and solutions |

## Quick Start

### 1. Build from Source

```bash
git clone https://github.com/devaryakjha/oore.build.git
cd oore.build

# Build server and CLI
cargo build --release
```

### 2. Install as Service (Production)

```bash
# Create configuration
cp .env.example .env
nano .env  # Edit with your settings

# Install and start
sudo ./target/release/oored install --env-file .env
sudo oored start
oored status
```

### 3. Run for Development

```bash
# Terminal 1: Run server
cargo run -p oore-server

# Terminal 2: Use CLI
cargo run -p oore-cli -- health
cargo run -p oore-cli -- repo list

# Terminal 3: Run web dashboard
cd web && bun dev
```

### 4. Add a Repository

```bash
# Add a GitHub repository
oore repo add --provider github --owner myorg --repo myapp

# Get the webhook URL
oore repo webhook-url <repo-id>

# Add this URL to your GitHub repository settings
```

## Project Status

Oore is in early development. Current features:

- [x] GitHub/GitLab webhook ingestion
- [x] Repository management
- [x] Build queue and status tracking
- [x] Service management (install/start/stop)
- [ ] Build execution
- [ ] Artifact storage
- [ ] TestFlight/App Store publishing
- [ ] Web dashboard

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](../LICENSE) for details.
