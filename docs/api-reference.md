# API Reference

The Oore server exposes a REST API for managing repositories, builds, and integrations.

## Base URL

```
http://localhost:8080/api
```

In production, configure `BASE_URL` to your public domain.

## Authentication

Protected endpoints require an admin token via the `Authorization` header:

```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

## Endpoints

### Health & Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/version` | No | Version info |
| GET | `/api/setup/status` | Yes | Setup status |

### Repositories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/repositories` | No | List repositories |
| POST | `/api/repositories` | No | Create repository |
| GET | `/api/repositories/:id` | No | Get repository |
| PUT | `/api/repositories/:id` | No | Update repository |
| DELETE | `/api/repositories/:id` | No | Delete repository |
| GET | `/api/repositories/:id/webhook-url` | No | Get webhook URL |
| POST | `/api/repositories/:id/trigger` | No | Trigger build |

### Builds

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/builds` | No | List builds |
| GET | `/api/builds/:id` | No | Get build |
| POST | `/api/builds/:id/cancel` | No | Cancel build |

### Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/github` | Signature | Receive GitHub webhooks |
| POST | `/api/webhooks/gitlab/:repo_id` | Token | Receive GitLab webhooks |
| GET | `/api/webhooks/events` | No | List webhook events |
| GET | `/api/webhooks/events/:id` | No | Get webhook event |

### GitHub Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/github/setup` | Yes | Start GitHub App setup |
| POST | `/api/github/callback` | No | GitHub App creation callback |
| GET | `/api/github/installations` | Yes | List App installations |

### GitLab Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/gitlab/connect` | Yes | Start OAuth flow |
| GET | `/api/gitlab/callback` | No | OAuth callback |
| GET | `/api/gitlab/status` | Yes | Check connection status |

---

## Endpoint Details

### GET /api/health

Check if the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

---

### GET /api/version

Get version information.

**Response:**
```json
{
  "name": "oored",
  "version": "0.1.0"
}
```

---

### GET /api/setup/status

Get current setup status. Requires admin token.

**Response:**
```json
{
  "github": {
    "configured": true,
    "app_name": "my-oore-app",
    "installations_count": 2
  },
  "gitlab": [
    {
      "configured": true,
      "instance_url": "https://gitlab.com",
      "username": "myuser",
      "enabled_projects_count": 5
    }
  ],
  "encryption_configured": true,
  "admin_token_configured": true
}
```

---

### GET /api/repositories

List all repositories.

**Response:**
```json
[
  {
    "id": "01HNJX5Q9T3WP2V6Z8K4M7YRBF",
    "name": "my-flutter-app",
    "provider": "github",
    "owner": "myorg",
    "repo_name": "my-app",
    "clone_url": "https://github.com/myorg/my-app.git",
    "default_branch": "main",
    "is_active": true,
    "github_repository_id": 123456789,
    "github_installation_id": 87654321,
    "gitlab_project_id": null,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### POST /api/repositories

Create a new repository.

**Request:**
```json
{
  "name": "My App",
  "provider": "github",
  "owner": "myorg",
  "repo_name": "my-app",
  "default_branch": "main",
  "webhook_secret": null,
  "github_repository_id": 123456789,
  "github_installation_id": 87654321,
  "gitlab_project_id": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Display name (defaults to owner/repo) |
| `provider` | string | Yes | `github` or `gitlab` |
| `owner` | string | Yes | Owner/organization name |
| `repo_name` | string | Yes | Repository name |
| `default_branch` | string | No | Default branch (defaults to `main`) |
| `webhook_secret` | string | No | GitLab webhook secret |
| `github_repository_id` | number | No | GitHub repository ID |
| `github_installation_id` | number | No | GitHub App installation ID |
| `gitlab_project_id` | number | No | GitLab project ID |

**Response:** Same as GET /api/repositories/:id

---

### GET /api/repositories/:id

Get a specific repository.

**Response:**
```json
{
  "id": "01HNJX5Q9T3WP2V6Z8K4M7YRBF",
  "name": "my-flutter-app",
  "provider": "github",
  "owner": "myorg",
  "repo_name": "my-app",
  "clone_url": "https://github.com/myorg/my-app.git",
  "default_branch": "main",
  "is_active": true,
  "github_repository_id": 123456789,
  "github_installation_id": 87654321,
  "gitlab_project_id": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### GET /api/repositories/:id/webhook-url

Get the webhook URL for configuring your Git provider.

**Response:**
```json
{
  "webhook_url": "https://ci.example.com/api/webhooks/github",
  "provider": "github"
}
```

For GitLab, the URL includes the repository ID:
```json
{
  "webhook_url": "https://ci.example.com/api/webhooks/gitlab/01HNJX5Q9T3WP2V6Z8K4M7YRBF",
  "provider": "gitlab"
}
```

---

### POST /api/repositories/:id/trigger

Manually trigger a build.

**Request:**
```json
{
  "branch": "develop",
  "commit_sha": "abc1234567890abcdef"
}
```

Both fields are optional:
- `branch`: Defaults to repository's default branch
- `commit_sha`: Defaults to HEAD of the branch

**Response:** Same as GET /api/builds/:id

---

### GET /api/builds

List builds.

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `repo` | Filter by repository ID |

**Response:**
```json
[
  {
    "id": "01HNJX9P2K4TM8Q6V5W3Y7ZRAD",
    "repository_id": "01HNJX5Q9T3WP2V6Z8K4M7YRBF",
    "webhook_event_id": "01HNJX8M2K4TN6P9R3W5Y7ZQEF",
    "commit_sha": "abc1234567890abcdef1234567890abcdef12345",
    "branch": "main",
    "trigger_type": "webhook",
    "status": "running",
    "started_at": "2024-01-15T10:35:02Z",
    "finished_at": null,
    "created_at": "2024-01-15T10:35:00Z"
  }
]
```

---

### GET /api/builds/:id

Get a specific build.

**Response:**
```json
{
  "id": "01HNJX9P2K4TM8Q6V5W3Y7ZRAD",
  "repository_id": "01HNJX5Q9T3WP2V6Z8K4M7YRBF",
  "webhook_event_id": "01HNJX8M2K4TN6P9R3W5Y7ZQEF",
  "commit_sha": "abc1234567890abcdef1234567890abcdef12345",
  "branch": "main",
  "trigger_type": "webhook",
  "status": "running",
  "started_at": "2024-01-15T10:35:02Z",
  "finished_at": null,
  "created_at": "2024-01-15T10:35:00Z"
}
```

**Build Statuses:**
- `pending` - Queued, waiting to start
- `running` - Currently executing
- `success` - Completed successfully
- `failed` - Completed with errors
- `cancelled` - Manually cancelled

**Trigger Types:**
- `webhook` - Triggered by GitHub/GitLab webhook
- `manual` - Triggered via API or CLI

---

### POST /api/builds/:id/cancel

Cancel a running build.

**Response:**
```json
{
  "id": "01HNJX9P2K4TM8Q6V5W3Y7ZRAD",
  "status": "cancelled",
  ...
}
```

---

### POST /api/webhooks/github

Receive webhooks from GitHub.

**Headers:**
- `X-Hub-Signature-256`: HMAC-SHA256 signature for verification
- `X-GitHub-Event`: Event type (e.g., `push`, `pull_request`)
- `X-GitHub-Delivery`: Unique delivery ID

The webhook is verified using the shared secret configured in `GITHUB_WEBHOOK_SECRET`.

**Response:**
```json
{
  "event_id": "01HNJX8M2K4TN6P9R3W5Y7ZQEF",
  "status": "queued"
}
```

---

### POST /api/webhooks/gitlab/:repo_id

Receive webhooks from GitLab.

**Headers:**
- `X-Gitlab-Token`: Secret token for verification
- `X-Gitlab-Event`: Event type (e.g., `Push Hook`, `Merge Request Hook`)

The token is verified against the HMAC stored for the repository.

**Response:**
```json
{
  "event_id": "01HNJX8M2K4TN6P9R3W5Y7ZQEF",
  "status": "queued"
}
```

---

### GET /api/webhooks/events

List received webhook events.

**Response:**
```json
[
  {
    "id": "01HNJX8M2K4TN6P9R3W5Y7ZQEF",
    "repository_id": "01HNJX5Q9T3WP2V6Z8K4M7YRBF",
    "provider": "github",
    "event_type": "push",
    "delivery_id": "abc123-def456",
    "processed": true,
    "created_at": "2024-01-15T10:35:00Z"
  }
]
```

---

### GET /api/webhooks/events/:id

Get a specific webhook event with full payload.

**Response:**
```json
{
  "id": "01HNJX8M2K4TN6P9R3W5Y7ZQEF",
  "repository_id": "01HNJX5Q9T3WP2V6Z8K4M7YRBF",
  "provider": "github",
  "event_type": "push",
  "delivery_id": "abc123-def456",
  "payload": { ... },
  "processed": true,
  "error_message": null,
  "created_at": "2024-01-15T10:35:00Z"
}
```

---

## Error Responses

Errors are returned with appropriate HTTP status codes and a JSON body:

```json
{
  "error": "Repository not found"
}
```

**Common Status Codes:**
- `400 Bad Request` - Invalid request body or parameters
- `401 Unauthorized` - Missing or invalid admin token
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Webhook Security

### GitHub

GitHub webhooks use HMAC-SHA256 signatures. The `X-Hub-Signature-256` header contains:

```
sha256=<hex-encoded-signature>
```

The signature is computed over the raw request body using the shared secret.

### GitLab

GitLab webhooks use a secret token passed in the `X-Gitlab-Token` header. Oore stores an HMAC of this token (not the plain text) for verification.
