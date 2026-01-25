-- GitHub App credentials (created via manifest flow)
CREATE TABLE github_app_credentials (
    id TEXT PRIMARY KEY,
    app_id INTEGER NOT NULL UNIQUE,
    app_name TEXT NOT NULL,
    app_slug TEXT NOT NULL,
    owner_login TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('User', 'Organization')),
    -- Encrypted fields (AES-256-GCM, stored as BLOB)
    private_key_encrypted BLOB NOT NULL,
    private_key_nonce BLOB NOT NULL,
    webhook_secret_encrypted BLOB NOT NULL,
    webhook_secret_nonce BLOB NOT NULL,
    client_id TEXT,
    client_secret_encrypted BLOB,
    client_secret_nonce BLOB,
    html_url TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- GitHub App installations (where app is installed)
CREATE TABLE github_app_installations (
    id TEXT PRIMARY KEY,
    github_app_id TEXT NOT NULL REFERENCES github_app_credentials(id) ON DELETE CASCADE,
    installation_id INTEGER NOT NULL UNIQUE,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
    account_id INTEGER NOT NULL,
    repository_selection TEXT NOT NULL CHECK (repository_selection IN ('all', 'selected')),
    permissions TEXT NOT NULL,  -- JSON
    events TEXT NOT NULL,       -- JSON array
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- GitHub installation repositories (for 'selected' installations)
CREATE TABLE github_installation_repositories (
    id TEXT PRIMARY KEY,
    installation_id TEXT NOT NULL REFERENCES github_app_installations(id) ON DELETE CASCADE,
    github_repository_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,  -- owner/repo
    is_private INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(installation_id, github_repository_id)
);

-- GitLab OAuth credentials (OAuth-based approach)
-- Design: One active credential per instance (single-tenant CI)
CREATE TABLE gitlab_oauth_credentials (
    id TEXT PRIMARY KEY,
    instance_url TEXT NOT NULL UNIQUE,  -- One credential per instance
    -- Encrypted tokens (BLOB)
    access_token_encrypted BLOB NOT NULL,
    access_token_nonce BLOB NOT NULL,
    refresh_token_encrypted BLOB,
    refresh_token_nonce BLOB,
    token_expires_at TEXT,
    -- User info (for display/audit, not uniqueness)
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- GitLab enabled projects (links to repositories table)
CREATE TABLE gitlab_enabled_projects (
    id TEXT PRIMARY KEY,
    gitlab_credential_id TEXT NOT NULL REFERENCES gitlab_oauth_credentials(id) ON DELETE CASCADE,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL,
    webhook_id INTEGER,
    webhook_token_hmac TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(gitlab_credential_id, project_id)
);

-- OAuth state for CSRF protection (single-use, short-lived)
CREATE TABLE oauth_state (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
    instance_url TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT  -- NULL until used, prevents replay
);

-- Webhook delivery tracking for replay detection
-- Composite key prevents cross-provider ID collisions
CREATE TABLE webhook_deliveries (
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
    delivery_id TEXT NOT NULL,  -- X-GitHub-Delivery or GitLab event ID
    repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
    received_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,  -- TTL for cleanup (1 hour)
    PRIMARY KEY (provider, delivery_id)
);

-- GitLab OAuth app credentials for self-hosted instances
CREATE TABLE gitlab_oauth_apps (
    id TEXT PRIMARY KEY,
    instance_url TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_secret_encrypted BLOB NOT NULL,
    client_secret_nonce BLOB NOT NULL,
    created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_github_installations_app ON github_app_installations(github_app_id);
CREATE INDEX idx_github_installation_repos ON github_installation_repositories(installation_id);
CREATE INDEX idx_gitlab_enabled_projects_cred ON gitlab_enabled_projects(gitlab_credential_id);
CREATE INDEX idx_gitlab_enabled_projects_repo ON gitlab_enabled_projects(repository_id);
CREATE INDEX idx_oauth_state_expires ON oauth_state(expires_at);
CREATE INDEX idx_webhook_deliveries_expires ON webhook_deliveries(expires_at);
