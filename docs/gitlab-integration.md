# GitLab Integration

This guide explains how to set up GitLab integration for automatic builds triggered by push events and merge requests.

## Overview

Oore integrates with GitLab using:

- **Webhooks**: For receiving push and merge request events
- **OAuth** (optional): For cloning private repositories and updating commit statuses

GitLab webhooks use a simpler token-based authentication compared to GitHub's HMAC signatures.

## Quick Setup

### 1. Add Repository to Oore

First, add your GitLab repository:

```bash
oore repo add \
  --provider gitlab \
  --owner myuser \
  --repo my-project \
  --webhook-secret "my-secure-secret" \
  --gitlab-project-id 12345678
```

**Parameters:**
- `--owner`: Your GitLab username or group name
- `--repo`: Repository/project name
- `--webhook-secret`: A secret token for webhook verification
- `--gitlab-project-id`: The numeric project ID (found in project settings)

### 2. Get Webhook URL

```bash
oore repo webhook-url <repo-id>
```

Output:
```
Provider: gitlab
Webhook URL: https://ci.example.com/api/webhooks/gitlab/01HNJX7K2N4RM8P3Y5W6T9HSVE

Configure in your GitLab project:
  1. Go to Settings > Webhooks
  2. Add webhook URL: https://ci.example.com/api/webhooks/gitlab/01HNJX7K2N4RM8P3Y5W6T9HSVE
  3. Enter your Secret Token
  4. Select triggers: Push events, Merge request events
```

### 3. Configure Webhook in GitLab

1. Go to your GitLab project
2. Navigate to **Settings > Webhooks**
3. Fill in the form:

| Field | Value |
|-------|-------|
| URL | The webhook URL from step 2 |
| Secret token | The same secret you used in step 1 |
| Push events | Checked |
| Merge request events | Checked |
| Enable SSL verification | Checked (if using HTTPS) |

4. Click **Add webhook**

### 4. Test the Webhook

1. Scroll down to your webhook in the list
2. Click **Test** and select **Push events**
3. Check if Oore received the event:
   ```bash
   oore webhook list
   ```

## GitLab OAuth (Optional)

For private repositories and status updates, configure OAuth:

### 1. Create GitLab Application

1. Go to GitLab > Settings > Applications
2. Create a new application:

| Field | Value |
|-------|-------|
| Name | Oore CI |
| Redirect URI | `https://your-server.com/api/gitlab/callback` |
| Confidential | Yes |
| Scopes | `api`, `read_repository` |

3. Note the **Application ID** and **Secret**

### 2. Configure Oore

Add to your environment file:

```bash
GITLAB_APPLICATION_ID=your-application-id
GITLAB_APPLICATION_SECRET=your-application-secret
GITLAB_REDIRECT_URI=https://your-server.com/api/gitlab/callback
```

Restart the server:
```bash
sudo oored restart
```

### 3. Connect Account

```bash
oore gitlab connect --admin-token YOUR_TOKEN
```

This opens a browser for OAuth authorization.

## How It Works

### Webhook Flow

1. **Push/MR event**: GitLab sends webhook to `/api/webhooks/gitlab/:repo_id`
2. **Token verification**: Oore verifies the `X-Gitlab-Token` header
3. **Event storage**: Event is saved to database
4. **Processing**: Background worker parses event and creates build
5. **Build execution**: Build runs on your Mac hardware

### Security: Token Storage

GitLab webhook tokens are stored securely:

1. **Plain token**: Sent by GitLab in `X-Gitlab-Token` header
2. **HMAC hash**: Oore stores `HMAC-SHA256(token, server_pepper)` in database
3. **Verification**: On webhook receipt, compute HMAC and compare

This means even if the database is compromised, the original tokens cannot be recovered.

### Event Types

| Event | Trigger |
|-------|---------|
| Push Hook | Code pushed to any branch |
| Merge Request Hook | MR opened, updated, or merged |
| Tag Push Hook | New tag created |

## GitLab.com vs Self-Hosted

Oore supports both GitLab.com and self-hosted GitLab instances.

### GitLab.com

Default configuration works out of the box:
- API URL: `https://gitlab.com/api/v4`
- OAuth: Standard GitLab.com OAuth

### Self-Hosted GitLab

Configure the instance URL:

```bash
GITLAB_INSTANCE_URL=https://gitlab.mycompany.com
```

Ensure your Oore server can reach the GitLab instance.

## Troubleshooting

### Webhooks Not Received

1. **Check URL**: Ensure the webhook URL is publicly accessible
2. **Check secret**: Token must match between GitLab and Oore
3. **Check SSL**: If using HTTPS, ensure certificate is valid
4. **Check firewall**: GitLab needs to reach your server

View webhook logs in GitLab:
1. Go to Settings > Webhooks
2. Click on your webhook
3. View "Recent events"

### Token Verification Failures

If you see "Invalid webhook token" errors:

1. **Check token**: Must match exactly (case-sensitive)
2. **Update token**: Update in both GitLab and Oore:
   ```bash
   oore repo add --provider gitlab --owner myuser --repo my-project \
     --webhook-secret "new-secret" --force
   ```
3. **Update in GitLab**: Edit webhook and update secret token

### Repository Not Found

If builds fail with "repository not found":

1. **Check project ID**: Ensure `gitlab_project_id` is correct
2. **Check URL**: Repository URL must be accessible

```bash
# View repository details
oore repo show <repo-id>
```

### OAuth Issues

If OAuth connection fails:

1. **Check redirect URI**: Must match exactly in GitLab app settings
2. **Check scopes**: Need `api` and `read_repository`
3. **Check secret**: Application secret must be correct

## Comparing GitHub vs GitLab Integration

| Feature | GitHub | GitLab |
|---------|--------|--------|
| Webhook auth | HMAC-SHA256 signature | Token header |
| App model | GitHub App | OAuth + Webhooks |
| Private repos | Via installation token | Via OAuth token |
| Status updates | Commit statuses API | Commit statuses API |
| Token storage | N/A (signature-based) | HMAC hashed |

## Example: Complete Setup

```bash
# 1. Add repository with webhook secret
oore repo add \
  --provider gitlab \
  --owner myuser \
  --repo my-flutter-app \
  --webhook-secret "$(openssl rand -hex 20)" \
  --gitlab-project-id 12345678

# 2. Get the webhook URL
oore repo webhook-url <repo-id>

# 3. Configure webhook in GitLab UI
# (use URL and secret from above)

# 4. Test webhook from GitLab UI

# 5. Verify event received
oore webhook list

# 6. Push code to trigger a build
git push origin main

# 7. Check build status
oore build list
```

## Self-Hosted GitLab Configuration

For self-hosted GitLab instances:

```bash
# /etc/oore/oore.env

# GitLab instance URL (no trailing slash)
GITLAB_INSTANCE_URL=https://gitlab.mycompany.com

# API URL (usually ${INSTANCE_URL}/api/v4)
GITLAB_API_URL=https://gitlab.mycompany.com/api/v4

# OAuth application credentials
GITLAB_APPLICATION_ID=your-app-id
GITLAB_APPLICATION_SECRET=your-app-secret
GITLAB_REDIRECT_URI=https://ci.mycompany.com/api/gitlab/callback
```

Restart after configuration:
```bash
sudo oored restart
```
