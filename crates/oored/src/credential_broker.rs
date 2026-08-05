//! Oore-owned, one-use credential grants for trusted runner parents.
//!
//! This module stores temporary secret material under Oore encryption. A grant
//! is bound to one operation, component identity, capability, job lock, and
//! fencing token. The raw handle is returned once and only its hash is stored.
//! Components never receive this handle through the public component protocol.

use base64::Engine as _;
use sqlx::SqlitePool;
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::crypto;
use crate::token::{generate_token, hash_token};

const MAX_SECRET_BYTES: usize = 8 * 1024 * 1024;
const MAX_ID_BYTES: usize = 256;
const MAX_GRANT_LIFETIME_SECONDS: i64 = 60 * 60;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CredentialGrantBinding {
    pub operation_id: String,
    pub runner_id: String,
    pub component_identity_digest: String,
    pub capability_id: String,
    pub job_lock_digest: String,
    pub fencing_token: i64,
    pub secret_kind: String,
}

pub struct CredentialGrantHandle(Zeroizing<String>);

impl CredentialGrantHandle {
    #[must_use]
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

pub struct IssuedCredentialGrant {
    pub handle: CredentialGrantHandle,
    pub expires_at: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CredentialGrantError {
    InvalidRequest,
    Unavailable,
    Store,
    Crypto,
}

pub async fn issue(
    pool: &SqlitePool,
    encryption_key: &[u8],
    binding: &CredentialGrantBinding,
    secret: &[u8],
    now: i64,
    expires_at: i64,
) -> Result<IssuedCredentialGrant, CredentialGrantError> {
    validate_binding(binding)?;
    if secret.is_empty()
        || secret.len() > MAX_SECRET_BYTES
        || expires_at <= now
        || expires_at > now.saturating_add(MAX_GRANT_LIFETIME_SECONDS)
    {
        return Err(CredentialGrantError::InvalidRequest);
    }

    let encoded_secret = Zeroizing::new(base64::engine::general_purpose::STANDARD.encode(secret));
    let encrypted = crypto::encrypt(encoded_secret.as_str(), encryption_key)
        .map_err(|_| CredentialGrantError::Crypto)?;
    let raw_handle = Zeroizing::new(generate_token());
    let handle_hash = hash_token(raw_handle.as_str());

    sqlx::query(
        "INSERT INTO component_credential_grants (
            id, handle_hash, operation_id, runner_id, component_identity_digest,
            capability_id, job_lock_digest, fencing_token, secret_kind,
            secret_ciphertext, expires_at, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(handle_hash)
    .bind(&binding.operation_id)
    .bind(&binding.runner_id)
    .bind(&binding.component_identity_digest)
    .bind(&binding.capability_id)
    .bind(&binding.job_lock_digest)
    .bind(binding.fencing_token)
    .bind(&binding.secret_kind)
    .bind(encrypted)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|_| CredentialGrantError::Store)?;

    Ok(IssuedCredentialGrant {
        handle: CredentialGrantHandle(raw_handle),
        expires_at,
    })
}

pub async fn consume(
    pool: &SqlitePool,
    encryption_key: &[u8],
    binding: &CredentialGrantBinding,
    raw_handle: &str,
    now: i64,
) -> Result<Zeroizing<Vec<u8>>, CredentialGrantError> {
    validate_binding(binding)?;
    if !valid_handle(raw_handle) {
        return Err(CredentialGrantError::Unavailable);
    }

    let handle_hash = hash_token(raw_handle);
    let claimed = sqlx::query_as::<_, (String, String)>(
        "UPDATE component_credential_grants
         SET consumed_at = ?1
         WHERE handle_hash = ?2
           AND operation_id = ?3
           AND runner_id = ?4
           AND component_identity_digest = ?5
           AND capability_id = ?6
           AND job_lock_digest = ?7
           AND fencing_token = ?8
           AND secret_kind = ?9
           AND expires_at > ?1
           AND consumed_at IS NULL
           AND revoked_at IS NULL
         RETURNING id, secret_ciphertext",
    )
    .bind(now)
    .bind(handle_hash)
    .bind(&binding.operation_id)
    .bind(&binding.runner_id)
    .bind(&binding.component_identity_digest)
    .bind(&binding.capability_id)
    .bind(&binding.job_lock_digest)
    .bind(binding.fencing_token)
    .bind(&binding.secret_kind)
    .fetch_optional(pool)
    .await
    .map_err(|_| CredentialGrantError::Store)?
    .ok_or(CredentialGrantError::Unavailable)?;

    let (grant_id, encrypted) = claimed;
    let decoded = crypto::decrypt(&encrypted, encryption_key)
        .map(Zeroizing::new)
        .map_err(|_| CredentialGrantError::Crypto)
        .and_then(|encoded| {
            base64::engine::general_purpose::STANDARD
                .decode(encoded.as_bytes())
                .map(Zeroizing::new)
                .map_err(|_| CredentialGrantError::Crypto)
        });

    let cleared = sqlx::query(
        "UPDATE component_credential_grants
         SET secret_ciphertext = ''
         WHERE id = ?1 AND consumed_at = ?2",
    )
    .bind(grant_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|_| CredentialGrantError::Store)?;
    if cleared.rows_affected() != 1 {
        return Err(CredentialGrantError::Store);
    }

    let secret = decoded?;
    if secret.is_empty() || secret.len() > MAX_SECRET_BYTES {
        return Err(CredentialGrantError::Crypto);
    }
    Ok(secret)
}

pub async fn revoke(
    pool: &SqlitePool,
    binding: &CredentialGrantBinding,
    raw_handle: &str,
    now: i64,
) -> Result<bool, CredentialGrantError> {
    validate_binding(binding)?;
    if !valid_handle(raw_handle) {
        return Ok(false);
    }

    let result = sqlx::query(
        "UPDATE component_credential_grants
         SET revoked_at = ?1, secret_ciphertext = ''
         WHERE handle_hash = ?2
           AND operation_id = ?3
           AND runner_id = ?4
           AND component_identity_digest = ?5
           AND capability_id = ?6
           AND job_lock_digest = ?7
           AND fencing_token = ?8
           AND secret_kind = ?9
           AND consumed_at IS NULL
           AND revoked_at IS NULL",
    )
    .bind(now)
    .bind(hash_token(raw_handle))
    .bind(&binding.operation_id)
    .bind(&binding.runner_id)
    .bind(&binding.component_identity_digest)
    .bind(&binding.capability_id)
    .bind(&binding.job_lock_digest)
    .bind(binding.fencing_token)
    .bind(&binding.secret_kind)
    .execute(pool)
    .await
    .map_err(|_| CredentialGrantError::Store)?;
    Ok(result.rows_affected() == 1)
}

pub async fn clear_expired(pool: &SqlitePool, now: i64) -> Result<u64, CredentialGrantError> {
    let result = sqlx::query(
        "UPDATE component_credential_grants
         SET revoked_at = COALESCE(revoked_at, ?1), secret_ciphertext = ''
         WHERE expires_at <= ?1 AND secret_ciphertext <> ''",
    )
    .bind(now)
    .execute(pool)
    .await
    .map_err(|_| CredentialGrantError::Store)?;
    Ok(result.rows_affected())
}

fn validate_binding(binding: &CredentialGrantBinding) -> Result<(), CredentialGrantError> {
    if !valid_id(&binding.operation_id)
        || !valid_id(&binding.runner_id)
        || !valid_digest(&binding.component_identity_digest)
        || !valid_id(&binding.capability_id)
        || !valid_digest(&binding.job_lock_digest)
        || binding.fencing_token <= 0
        || !valid_id(&binding.secret_kind)
    {
        return Err(CredentialGrantError::InvalidRequest);
    }
    Ok(())
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_ID_BYTES
        && value.as_bytes()[0].is_ascii_alphanumeric()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._:/-".contains(&byte))
}

fn valid_digest(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..]
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn valid_handle(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
