-- App Store Connect API Keys for automatic iOS signing
-- These keys allow xcodebuild to automatically manage provisioning

CREATE TABLE appstore_connect_api_keys (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_id TEXT NOT NULL,           -- Apple's Key ID (10 alphanumeric chars)
    issuer_id TEXT NOT NULL,        -- Apple's Issuer ID (UUID)
    private_key_encrypted BLOB NOT NULL,
    private_key_nonce BLOB NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repository_id, key_id)
);

CREATE INDEX idx_asc_api_keys_repo ON appstore_connect_api_keys(repository_id);
CREATE INDEX idx_asc_api_keys_repo_active ON appstore_connect_api_keys(repository_id, is_active);
