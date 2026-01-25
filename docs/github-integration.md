# GitHub Integration

This guide explains how to set up GitHub integration for automatic builds triggered by push events and pull requests.

## Overview

Oore integrates with GitHub using a **GitHub App**. This provides:

- Webhook events for push, pull request, and other events
- Installation tokens for cloning private repositories
- Commit status updates for build results

## Quick Setup

```bash
# Start the setup flow
oore github setup --admin-token YOUR_TOKEN
```

This will guide you through creating a GitHub App for your Oore installation.

## Manual Setup

If you prefer to set up the GitHub App manually:

### 1. Create a GitHub App

Go to your GitHub account settings:
- **Personal account**: Settings > Developer settings > GitHub Apps > New GitHub App
- **Organization**: Settings > Developer settings > GitHub Apps > New GitHub App

Fill in the form:

| Field | Value |
|-------|-------|
| GitHub App name | `Oore CI - yourname` (must be unique) |
| Homepage URL | Your Oore server URL |
| Webhook URL | `https://your-server.com/api/webhooks/github` |
| Webhook secret | Generate a random string |

### 2. Configure Permissions

**Repository permissions:**
| Permission | Access |
|------------|--------|
| Contents | Read |
| Metadata | Read |
| Pull requests | Read & Write |
| Commit statuses | Read & Write |

**Subscribe to events:**
- Push
- Pull request
- Create (for tag pushes)

### 3. Generate Private Key

After creating the app:
1. Scroll to "Private keys"
2. Click "Generate a private key"
3. Save the downloaded `.pem` file

### 4. Configure Oore

Add to your environment file (`/etc/oore/oore.env`):

```bash
# GitHub App ID (from app settings page)
GITHUB_APP_ID=123456

# Webhook secret (the one you generated)
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Private key (the contents of the .pem file)
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"
```

Restart the server:
```bash
sudo oored restart
```

### 5. Install the App

1. Go to your GitHub App's page
2. Click "Install App"
3. Choose the account or organization
4. Select repositories (or all repositories)
5. Click "Install"

### 6. Add Repository to Oore

After installation, add the repository:

```bash
# Get the GitHub repository ID and installation ID from the GitHub API
# or use the automatic discovery:
oore repo add --provider github --owner myorg --repo my-app
```

## How It Works

### Webhook Flow

1. **Push/PR event**: GitHub sends webhook to `/api/webhooks/github`
2. **Verification**: Oore verifies the HMAC-SHA256 signature
3. **Event storage**: Event is saved to database
4. **Processing**: Background worker parses event and creates build
5. **Build execution**: Build runs on your Mac hardware
6. **Status update**: Commit status is updated on GitHub

### Event Types

| Event | Trigger |
|-------|---------|
| `push` | Code pushed to any branch |
| `pull_request.opened` | New pull request |
| `pull_request.synchronize` | PR updated with new commits |
| `create` | Branch or tag created |

### Signature Verification

GitHub signs webhooks using HMAC-SHA256. The signature is in the `X-Hub-Signature-256` header:

```
sha256=<hex-encoded-signature>
```

Oore computes the expected signature using your webhook secret and rejects requests with invalid signatures.

## Troubleshooting

### Webhooks Not Received

1. **Check webhook URL**: Must be publicly accessible (not localhost)
2. **Check firewall**: Port 8080 (or your configured port) must be open
3. **Check HTTPS**: GitHub requires HTTPS for webhooks (use a reverse proxy)

View recent webhook deliveries in GitHub:
1. Go to your GitHub App settings
2. Click "Advanced"
3. View "Recent Deliveries"

### Invalid Signature Errors

If you see signature verification failures:

1. **Check secret**: Ensure `GITHUB_WEBHOOK_SECRET` matches the app configuration
2. **Check encoding**: The secret should be the plain text, not base64 encoded
3. **Restart server**: Configuration changes require a restart

### Installation Not Found

If builds fail with "installation not found":

1. **Check installation ID**: The repository must have a valid `github_installation_id`
2. **Reinstall app**: Uninstall and reinstall the GitHub App on the repository
3. **Update repository**: Update the installation ID in Oore

```bash
oore repo show <repo-id>
# Check github_installation_id is set
```

### Private Key Issues

If token generation fails:

1. **Check key format**: Must be a valid RSA private key in PEM format
2. **Check line breaks**: In env file, use literal newlines or `\n`
3. **Generate new key**: Create a new private key in GitHub App settings

## Best Practices

### Security

1. **Use HTTPS**: Always use HTTPS for webhook URLs
2. **Rotate secrets**: Periodically rotate webhook secrets
3. **Limit permissions**: Only grant required permissions
4. **Restrict installation**: Install on specific repositories, not all

### Performance

1. **Async processing**: Webhooks are processed asynchronously
2. **Deduplication**: Duplicate webhooks are detected and ignored
3. **Rate limiting**: Be aware of GitHub API rate limits

### Monitoring

Check webhook health:
```bash
# View recent webhook events
oore webhook list

# View specific event
oore webhook show <event-id>
```

## Example: Complete Setup

```bash
# 1. Configure environment
sudo nano /etc/oore/oore.env
# Add GITHUB_APP_ID, GITHUB_WEBHOOK_SECRET, GITHUB_APP_PRIVATE_KEY

# 2. Restart server
sudo oored restart

# 3. Verify configuration
oore setup --admin-token YOUR_TOKEN

# 4. Add a repository
oore repo add --provider github --owner myorg --repo my-flutter-app

# 5. Get webhook URL
oore repo webhook-url <repo-id>

# 6. Configure in GitHub App settings

# 7. Install GitHub App on repository

# 8. Push code to trigger a build
git push origin main

# 9. Check build status
oore build list
```
