use std::collections::BTreeSet;

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use ring::signature::{ED25519, UnparsedPublicKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{
    CatalogError, MAX_ROOT_BYTES, MAX_SIGNATURES, MAX_SNAPSHOT_BYTES, MAX_TARGETS_BYTES,
    MAX_TIMESTAMP_BYTES, MetadataSignature, PublicKey, SCHEMA_VERSION, SignedEnvelope,
    canonical_bytes, canonical_value, decode_base64url, invalid, invalid_error, parse_strict,
    parse_timestamp, sha256, validate_sha256,
};

const SIGNING_REQUEST_VALIDITY: Duration = Duration::minutes(15);
const MAX_SIGNING_REQUEST_BYTES: usize = 12 * 1024 * 1024;
const MAX_SIGNATURE_RESPONSE_BYTES: usize = 8 * 1024;

/// One metadata role that accepts detached signatures.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SigningRole {
    /// Root keys and role policy.
    Root,
    /// Component membership and revocations.
    Targets,
    /// Exact metadata set binding.
    Snapshot,
    /// Snapshot freshness binding.
    Timestamp,
}

impl SigningRole {
    fn maximum_payload_bytes(self) -> usize {
        match self {
            Self::Root => MAX_ROOT_BYTES,
            Self::Targets => MAX_TARGETS_BYTES,
            Self::Snapshot => MAX_SNAPSHOT_BYTES,
            Self::Timestamp => MAX_TIMESTAMP_BYTES,
        }
    }
}

/// Public release facts attached to one signing request.
///
/// These fields support audit records. Signatures still cover the canonical
/// metadata payload directly.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReleaseBinding {
    repository: String,
    commit: String,
    tag: String,
    catalog_revision: u64,
}

impl ReleaseBinding {
    /// Creates a release binding for one exact Oore source revision.
    pub fn new(
        repository: &str,
        commit: &str,
        tag: &str,
        catalog_revision: u64,
    ) -> Result<Self, CatalogError> {
        if !matches!(repository, "oore-ci/oore.build" | "oore-ci/components") {
            return invalid("release binding", "repository is not owned by Oore");
        }
        if commit.len() != 40
            || !commit
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return invalid("release binding", "commit is not a full lowercase Git SHA");
        }
        if tag.is_empty()
            || tag.len() > 192
            || !tag.bytes().all(|byte| {
                byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_' | b'/')
            })
            || catalog_revision == 0
        {
            return invalid("release binding", "tag or catalog revision is invalid");
        }
        Ok(Self {
            repository: repository.to_owned(),
            commit: commit.to_owned(),
            tag: tag.to_owned(),
            catalog_revision,
        })
    }

    fn validate(&self) -> Result<(), CatalogError> {
        Self::new(
            &self.repository,
            &self.commit,
            &self.tag,
            self.catalog_revision,
        )
        .map(|_| ())
    }
}

/// Canonical metadata bytes prepared for an external signer.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SigningRequest {
    schema_version: u8,
    role: SigningRole,
    payload_sha256: String,
    payload_base64url: String,
    release: ReleaseBinding,
    created_at: String,
    expires: String,
}

impl SigningRequest {
    /// Prepares strict canonical JSON for an external signing service.
    ///
    /// This function does not claim that the role document is admissible. The
    /// final four-role verifier remains the only admission boundary.
    pub fn prepare(
        role: SigningRole,
        signed_json: &[u8],
        release: ReleaseBinding,
        now: DateTime<Utc>,
    ) -> Result<Self, CatalogError> {
        release.validate()?;
        let value: Value =
            parse_strict(signed_json, role.maximum_payload_bytes(), "signing payload")?;
        if !value.is_object() {
            return invalid("signing payload", "top-level JSON is not an object");
        }
        let payload = canonical_value(&value)?;
        let created_at = now.to_rfc3339_opts(SecondsFormat::Secs, true);
        let expires_at = now
            .checked_add_signed(SIGNING_REQUEST_VALIDITY)
            .ok_or_else(|| invalid_error("signing request", "expiry overflowed"))?;
        let expires = expires_at.to_rfc3339_opts(SecondsFormat::Secs, true);
        Ok(Self {
            schema_version: SCHEMA_VERSION,
            role,
            payload_sha256: sha256(&payload),
            payload_base64url: URL_SAFE_NO_PAD.encode(payload),
            release,
            created_at,
            expires,
        })
    }

    /// Parses a saved request with strict bounds.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CatalogError> {
        let request: Self = parse_strict(bytes, MAX_SIGNING_REQUEST_BYTES, "signing request")?;
        request.validate(Utc::now(), false)?;
        Ok(request)
    }

    /// Returns canonical request bytes for transport or audit storage.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CatalogError> {
        self.validate(Utc::now(), false)?;
        canonical_bytes(self, "signing request")
    }

    /// Returns the metadata role.
    #[must_use]
    pub const fn role(&self) -> SigningRole {
        self.role
    }

    /// Returns the canonical payload digest.
    #[must_use]
    pub fn payload_sha256(&self) -> &str {
        &self.payload_sha256
    }

    /// Returns the canonical metadata bytes that the signer must sign.
    pub fn payload(&self) -> Result<Vec<u8>, CatalogError> {
        self.validate(Utc::now(), false)?;
        decode_payload(self)
    }

    fn digest(&self) -> Result<String, CatalogError> {
        Ok(sha256(&canonical_bytes(self, "signing request")?))
    }

    fn validate(&self, now: DateTime<Utc>, require_fresh: bool) -> Result<(), CatalogError> {
        if self.schema_version != SCHEMA_VERSION {
            return invalid("signing request", "schema version is invalid");
        }
        self.release.validate()?;
        validate_sha256(&self.payload_sha256, "signing payload digest")?;
        let payload = decode_payload(self)?;
        if payload.len() > self.role.maximum_payload_bytes()
            || sha256(&payload) != self.payload_sha256
        {
            return invalid("signing request", "payload length or digest is invalid");
        }
        let value: Value = parse_strict(
            &payload,
            self.role.maximum_payload_bytes(),
            "signing payload",
        )?;
        if canonical_value(&value)? != payload {
            return invalid("signing request", "payload is not canonical JSON");
        }
        let created = parse_timestamp(&self.created_at, "signing request time")?;
        let expires = parse_timestamp(&self.expires, "signing request time")?;
        if expires - created != SIGNING_REQUEST_VALIDITY
            || (require_fresh && (now < created || now >= expires))
        {
            return Err(CatalogError::Freshness("signing request"));
        }
        Ok(())
    }
}

/// An Ed25519 public key accepted from a trusted Root document.
pub struct VerifierKey {
    key_id: String,
    public: Vec<u8>,
}

impl VerifierKey {
    /// Parses one canonical public-key object and derives its key ID.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CatalogError> {
        let key: PublicKey = parse_strict(bytes, MAX_SIGNATURE_RESPONSE_BYTES, "verifier key")?;
        if key.key_type != "ed25519" || key.scheme != "ed25519" {
            return invalid("verifier key", "only Ed25519 is supported");
        }
        let canonical = canonical_bytes(&key, "verifier key")?;
        let public = decode_base64url(&key.public, 32, "verifier key")?;
        Ok(Self {
            key_id: sha256(&canonical),
            public,
        })
    }

    /// Returns the derived Root-compatible key ID.
    #[must_use]
    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}

/// A detached response produced by an external signer.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DetachedSignature {
    schema_version: u8,
    role: SigningRole,
    request_sha256: String,
    payload_sha256: String,
    key_id: String,
    signature: String,
    signed_at: String,
}

impl DetachedSignature {
    /// Parses a detached signer response.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CatalogError> {
        let signature: Self =
            parse_strict(bytes, MAX_SIGNATURE_RESPONSE_BYTES, "detached signature")?;
        signature.validate()?;
        Ok(signature)
    }

    /// Returns canonical response bytes for audit storage.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CatalogError> {
        self.validate()?;
        canonical_bytes(self, "detached signature")
    }

    /// Verifies this response against one request and public key.
    pub fn accept(
        &self,
        request: &SigningRequest,
        key: &VerifierKey,
        now: DateTime<Utc>,
    ) -> Result<AcceptedSignature, CatalogError> {
        self.validate()?;
        request.validate(now, true)?;
        if self.role != request.role
            || self.request_sha256 != request.digest()?
            || self.payload_sha256 != request.payload_sha256
            || self.key_id != key.key_id
        {
            return invalid("detached signature", "request or key binding differs");
        }
        let signed_at = parse_timestamp(&self.signed_at, "signature time")?;
        let created = parse_timestamp(&request.created_at, "signing request time")?;
        let expires = parse_timestamp(&request.expires, "signing request time")?;
        if signed_at < created || signed_at >= expires || signed_at > now {
            return Err(CatalogError::Freshness("detached signature"));
        }
        let signature = decode_base64url(&self.signature, 64, "detached signature")?;
        let payload = request.payload()?;
        UnparsedPublicKey::new(&ED25519, &key.public)
            .verify(&payload, &signature)
            .map_err(|_| CatalogError::Signature("detached signature"))?;
        Ok(AcceptedSignature {
            role: self.role,
            payload_sha256: self.payload_sha256.clone(),
            key_id: self.key_id.clone(),
            signature: self.signature.clone(),
        })
    }

    fn validate(&self) -> Result<(), CatalogError> {
        if self.schema_version != SCHEMA_VERSION {
            return invalid("detached signature", "schema version is invalid");
        }
        validate_sha256(&self.request_sha256, "signing request digest")?;
        validate_sha256(&self.payload_sha256, "signing payload digest")?;
        validate_sha256(&self.key_id, "signer key ID")?;
        decode_base64url(&self.signature, 64, "detached signature")?;
        parse_timestamp(&self.signed_at, "signature time")?;
        Ok(())
    }
}

/// A verified detached signature bound to one canonical payload.
pub struct AcceptedSignature {
    role: SigningRole,
    payload_sha256: String,
    key_id: String,
    signature: String,
}

/// Assembles canonical signed metadata from verified detached signatures.
///
/// The returned envelope remains untrusted until [`crate::CatalogVerifier`]
/// verifies the complete four-role chain.
pub fn assemble_envelope(
    request: &SigningRequest,
    signatures: &[AcceptedSignature],
    now: DateTime<Utc>,
) -> Result<Vec<u8>, CatalogError> {
    request.validate(now, true)?;
    if signatures.is_empty() || signatures.len() > MAX_SIGNATURES {
        return Err(CatalogError::Limit("accepted signatures"));
    }
    let mut entries = Vec::with_capacity(signatures.len());
    let mut key_ids = BTreeSet::new();
    for signature in signatures {
        if signature.role != request.role
            || signature.payload_sha256 != request.payload_sha256
            || !key_ids.insert(&signature.key_id)
        {
            return invalid(
                "accepted signatures",
                "role, payload, or key binding differs",
            );
        }
        entries.push(MetadataSignature {
            key_id: signature.key_id.clone(),
            signature: signature.signature.clone(),
        });
    }
    entries.sort_by(|left, right| left.key_id.cmp(&right.key_id));
    let payload = request.payload()?;
    let signed: Value = parse_strict(
        &payload,
        request.role.maximum_payload_bytes(),
        "signing payload",
    )?;
    canonical_bytes(
        &SignedEnvelope {
            signed,
            signatures: entries,
        },
        "signed metadata envelope",
    )
}

fn decode_payload(request: &SigningRequest) -> Result<Vec<u8>, CatalogError> {
    let decoded = URL_SAFE_NO_PAD
        .decode(&request.payload_base64url)
        .map_err(|error| {
            invalid_error(
                "signing request",
                &format!("payload base64url failed: {error}"),
            )
        })?;
    if URL_SAFE_NO_PAD.encode(&decoded) != request.payload_base64url {
        return invalid("signing request", "payload base64url is not canonical");
    }
    Ok(decoded)
}
