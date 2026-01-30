-- Migration: Code Signing and Artifact Storage
-- Description: Add tables for iOS/Android signing credentials and build artifacts

-- iOS Signing Certificates (p12 files)
CREATE TABLE ios_signing_certificates (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    certificate_type TEXT NOT NULL CHECK (certificate_type IN ('development', 'distribution')),
    -- Encrypted p12 data (AES-256-GCM with AAD)
    certificate_data_encrypted BLOB NOT NULL,
    certificate_data_nonce BLOB NOT NULL,
    -- Encrypted password (always stored, even if empty)
    password_encrypted BLOB NOT NULL,
    password_nonce BLOB NOT NULL,
    -- Metadata (extracted from cert)
    common_name TEXT,
    team_id TEXT,
    serial_number TEXT,
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- iOS Provisioning Profiles
CREATE TABLE ios_provisioning_profiles (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    profile_type TEXT NOT NULL CHECK (profile_type IN ('development', 'adhoc', 'appstore', 'enterprise')),
    -- Encrypted mobileprovision data
    profile_data_encrypted BLOB NOT NULL,
    profile_data_nonce BLOB NOT NULL,
    -- Metadata (extracted from profile XML)
    bundle_identifier TEXT,
    team_id TEXT,
    uuid TEXT NOT NULL,
    app_id_name TEXT,
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repository_id, uuid)  -- Prevent duplicate profiles
);

-- Android Keystores
CREATE TABLE android_keystores (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Encrypted keystore data (JKS or PKCS12)
    keystore_data_encrypted BLOB NOT NULL,
    keystore_data_nonce BLOB NOT NULL,
    -- Encrypted passwords (always required)
    keystore_password_encrypted BLOB NOT NULL,
    keystore_password_nonce BLOB NOT NULL,
    key_alias TEXT NOT NULL,
    key_password_encrypted BLOB NOT NULL,
    key_password_nonce BLOB NOT NULL,
    -- Metadata
    keystore_type TEXT NOT NULL DEFAULT 'jks' CHECK (keystore_type IN ('jks', 'pkcs12')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repository_id, name)  -- One keystore per name per repo
);

-- Build Artifacts
CREATE TABLE build_artifacts (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relative_path TEXT NOT NULL,  -- Preserve directory structure
    storage_path TEXT NOT NULL,   -- Actual path on disk
    size_bytes INTEGER NOT NULL,
    content_type TEXT,
    checksum_sha256 TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(build_id, relative_path)  -- Unique by path, not name
);

-- Add signing_enabled flag to repositories (for trusted-repo-only signing)
ALTER TABLE repositories ADD COLUMN signing_enabled INTEGER NOT NULL DEFAULT 0;

-- Indexes for efficient queries
CREATE INDEX idx_ios_certs_repo ON ios_signing_certificates(repository_id);
CREATE INDEX idx_ios_certs_repo_active ON ios_signing_certificates(repository_id, is_active);
CREATE INDEX idx_ios_profiles_repo ON ios_provisioning_profiles(repository_id);
CREATE INDEX idx_ios_profiles_repo_active ON ios_provisioning_profiles(repository_id, is_active);
CREATE INDEX idx_android_keystores_repo ON android_keystores(repository_id);
CREATE INDEX idx_android_keystores_repo_active ON android_keystores(repository_id, is_active);
CREATE INDEX idx_artifacts_build ON build_artifacts(build_id);
CREATE INDEX idx_artifacts_created ON build_artifacts(created_at);  -- For cleanup queries
