CREATE TABLE apple_account (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    key_id TEXT NOT NULL,
    issuer_id TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    apps_json TEXT NOT NULL,
    selected_app_id TEXT,
    connected_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE apple_account_operations (
    id TEXT PRIMARY KEY NOT NULL,
    requested_by TEXT NOT NULL REFERENCES users(id),
    key_id TEXT NOT NULL,
    issuer_id TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'claimed', 'running', 'succeeded', 'failed')),
    runner_id TEXT REFERENCES runners(id) ON DELETE SET NULL,
    job_lock_digest TEXT,
    lease_id TEXT,
    receipt_id TEXT,
    component_identity_digest TEXT,
    component_target_arch TEXT,
    fencing_token INTEGER NOT NULL DEFAULT 0,
    lease_expires_at INTEGER,
    result_json TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_apple_account_operations_queue
    ON apple_account_operations (created_at, id)
    WHERE status = 'queued';

CREATE UNIQUE INDEX idx_apple_account_operations_one_active
    ON apple_account_operations ((1))
    WHERE status IN ('queued', 'claimed', 'running');

CREATE INDEX idx_apple_account_operations_lease
    ON apple_account_operations (lease_expires_at)
    WHERE status IN ('claimed', 'running');
