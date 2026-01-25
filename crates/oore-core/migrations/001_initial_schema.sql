-- Initial database schema for Oore CI/CD platform
-- Handles Git integration for GitHub and GitLab webhooks

-- repositories: connected git repositories
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
    owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    clone_url TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    -- HMAC_SHA256(token, server_pepper) stored as hex (64 chars)
    -- Faster than argon2, still avoids plaintext storage
    webhook_secret_hmac TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    -- Provider-specific identifiers for API calls
    github_repository_id INTEGER UNIQUE,     -- GitHub's numeric repo ID
    github_installation_id INTEGER,          -- For token minting
    gitlab_project_id INTEGER UNIQUE,        -- GitLab's numeric project ID
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, owner, repo_name)
);

-- gitlab_credentials: Per-repository GitLab tokens (encrypted)
CREATE TABLE gitlab_credentials (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    -- Encrypted with AES-256-GCM using environment/keychain-backed key
    access_token_encrypted TEXT NOT NULL,
    -- Nonce for AES-GCM (stored as hex)
    access_token_nonce TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repository_id)
);

-- webhook_events: audit log of ACCEPTED webhooks only
CREATE TABLE webhook_events (
    id TEXT PRIMARY KEY,
    repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
    event_type TEXT NOT NULL,
    -- GitHub: X-GitHub-Delivery, GitLab: X-Gitlab-Event-UUID
    -- Fallback: sha256(payload) if header missing
    delivery_id TEXT NOT NULL,
    payload BLOB NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    received_at TEXT NOT NULL,
    UNIQUE(provider, delivery_id)
);

-- builds: build executions triggered by webhooks
CREATE TABLE builds (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    webhook_event_id TEXT REFERENCES webhook_events(id) ON DELETE SET NULL,
    commit_sha TEXT NOT NULL,
    branch TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('push', 'pull_request', 'merge_request', 'manual')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failure', 'cancelled')),
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_repositories_provider ON repositories(provider);
CREATE INDEX idx_repositories_github_repo_id ON repositories(github_repository_id);
CREATE INDEX idx_repositories_gitlab_project_id ON repositories(gitlab_project_id);
CREATE INDEX idx_webhook_events_repository ON webhook_events(repository_id);
CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(processed) WHERE processed = 0;
CREATE INDEX idx_webhook_events_delivery ON webhook_events(provider, delivery_id);
CREATE INDEX idx_builds_repository ON builds(repository_id);
CREATE INDEX idx_builds_status ON builds(status);
CREATE INDEX idx_builds_webhook_event ON builds(webhook_event_id);
