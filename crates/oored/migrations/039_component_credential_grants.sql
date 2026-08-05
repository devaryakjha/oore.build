CREATE TABLE component_credential_grants (
    id TEXT PRIMARY KEY NOT NULL,
    handle_hash TEXT NOT NULL UNIQUE,
    operation_id TEXT NOT NULL,
    runner_id TEXT NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
    component_identity_digest TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    job_lock_digest TEXT NOT NULL,
    fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
    secret_kind TEXT NOT NULL,
    secret_ciphertext TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_component_credential_grants_active
    ON component_credential_grants (handle_hash, expires_at)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
