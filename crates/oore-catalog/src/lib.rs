//! Verification for Oore's official signed component metadata.
//!
//! This crate verifies the Root, Targets, Snapshot, and Timestamp chain. It
//! does not download, install, activate, or execute component bytes.

#![deny(missing_docs)]
#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use ring::signature::{ED25519, UnparsedPublicKey};
use serde::de::{self, DeserializeOwned, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use thiserror::Error;

mod authoring;
mod detached;
mod records;

pub use authoring::{
    build_root_payload, build_snapshot_payload, build_targets_payload, build_timestamp_payload,
    import_component_release,
};
pub use detached::{
    AcceptedSignature, DetachedSignature, ReleaseBinding, SigningRequest, SigningRole, VerifierKey,
    assemble_envelope,
};

const SCHEMA_VERSION: u8 = 1;
const OFFICIAL_REPOSITORY: &str = "oore-official";
const MAX_ROOT_BYTES: usize = 1024 * 1024;
const MAX_TARGETS_BYTES: usize = 8 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES: usize = 2 * 1024 * 1024;
const MAX_TIMESTAMP_BYTES: usize = 256 * 1024;
const MAX_STATE_BYTES: usize = 256 * 1024;
const MAX_COMPONENTS: usize = 2_048;
const MAX_COMPONENT_RECORD_BYTES: usize = 64 * 1024;
const MAX_SIGNATURES: usize = 32;
const MAX_ROOT_ROTATIONS: usize = 32;
const CLOCK_SKEW: Duration = Duration::minutes(5);
const ROOT_VALIDITY: Duration = Duration::days(365);
const TARGETS_VALIDITY: Duration = Duration::days(30);
const SNAPSHOT_VALIDITY: Duration = Duration::days(30);
const TIMESTAMP_VALIDITY: Duration = Duration::days(7);

/// Errors returned before any catalog data becomes usable.
#[derive(Debug, Error)]
pub enum CatalogError {
    /// Input exceeded its fixed byte or item limit.
    #[error("{0} exceeds its fixed catalog limit")]
    Limit(&'static str),
    /// JSON was malformed, ambiguous, or outside a closed schema.
    #[error("invalid {subject}: {detail}")]
    Invalid {
        /// The document or field that failed.
        subject: &'static str,
        /// A bounded explanation without document contents.
        detail: String,
    },
    /// A required signature was missing or invalid.
    #[error("{0} signature verification failed")]
    Signature(&'static str),
    /// Metadata was expired, future-dated, or outside its role window.
    #[error("{0} is not fresh")]
    Freshness(&'static str),
    /// A lower metadata version was presented.
    #[error("{0} metadata rollback was detected")]
    Rollback(&'static str),
    /// One version appeared with different canonical bytes.
    #[error("{0} metadata equivocation was detected")]
    Equivocation(&'static str),
    /// The local catalog state remains poisoned after equivocation.
    #[error("the local catalog state is poisoned")]
    Poisoned,
}

/// One fetched metadata update.
#[derive(Clone, Copy, Debug)]
pub struct CatalogUpdate<'a> {
    /// Consecutive Root documents after the embedded Root.
    pub root_rotations: &'a [&'a [u8]],
    /// The current signed Targets document.
    pub targets: &'a [u8],
    /// The current signed Snapshot document.
    pub snapshot: &'a [u8],
    /// The current signed Timestamp document.
    pub timestamp: &'a [u8],
}

/// Durable version and digest high-water marks.
///
/// Fields stay private so callers cannot assemble trusted state in memory.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CatalogState {
    schema_version: u8,
    repository: String,
    root: StateMark,
    targets: Option<StateMark>,
    snapshot: Option<StateMark>,
    timestamp: Option<StateMark>,
    catalog_sha256: Option<String>,
    poisoned: bool,
}

impl CatalogState {
    /// Parses a saved state with duplicate-key and size checks.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CatalogError> {
        let state: Self = parse_strict(bytes, MAX_STATE_BYTES, "catalog state")?;
        state.validate()?;
        Ok(state)
    }

    /// Returns canonical bytes for an owner-protected state file.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CatalogError> {
        canonical_bytes(self, "catalog state")
    }

    /// Reports whether equivocation has poisoned this state.
    #[must_use]
    pub const fn is_poisoned(&self) -> bool {
        self.poisoned
    }

    /// Returns the highest accepted catalog revision.
    #[must_use]
    pub fn catalog_revision(&self) -> Option<u64> {
        self.targets.as_ref().map(|mark| mark.version)
    }

    fn validate(&self) -> Result<(), CatalogError> {
        if self.schema_version != SCHEMA_VERSION || self.repository != OFFICIAL_REPOSITORY {
            return invalid("catalog state", "identity does not match Oore");
        }
        self.root.validate("Root state")?;
        for (label, mark) in [
            ("Targets state", self.targets.as_ref()),
            ("Snapshot state", self.snapshot.as_ref()),
            ("Timestamp state", self.timestamp.as_ref()),
        ] {
            if let Some(mark) = mark {
                mark.validate(label)?;
            }
        }
        let complete = self.targets.is_some()
            && self.snapshot.is_some()
            && self.timestamp.is_some()
            && self.catalog_sha256.is_some();
        let empty = self.targets.is_none()
            && self.snapshot.is_none()
            && self.timestamp.is_none()
            && self.catalog_sha256.is_none();
        if !complete && !empty {
            return invalid("catalog state", "metadata marks are incomplete");
        }
        if let Some(digest) = &self.catalog_sha256 {
            validate_sha256(digest, "catalog state digest")?;
        }
        Ok(())
    }
}

/// A verifier rooted in one shell-embedded Root document.
pub struct CatalogVerifier {
    pinned_root: RootMetadata,
    pinned_envelope: Vec<u8>,
    pinned_digest: String,
}

impl CatalogVerifier {
    /// Loads and checks the Root document embedded in an Oore release.
    ///
    /// The caller must supply bytes shipped inside the trusted shell package.
    pub fn from_pinned_root(bytes: &[u8], now: DateTime<Utc>) -> Result<Self, CatalogError> {
        let (envelope, canonical_envelope) = parse_envelope(bytes, MAX_ROOT_BYTES, "pinned Root")?;
        let root: RootMetadata = decode_signed(&envelope, "pinned Root")?;
        let keyring = root.validate(now, "pinned Root")?;
        keyring.verify(
            &root.roles.root,
            &canonical_value(&envelope.signed)?,
            &envelope.signatures,
            "pinned Root",
        )?;
        Ok(Self {
            pinned_root: root,
            pinned_digest: sha256(&canonical_envelope),
            pinned_envelope: canonical_envelope,
        })
    }

    /// Creates the first durable state for this embedded Root.
    #[must_use]
    pub fn initial_state(&self) -> CatalogState {
        CatalogState {
            schema_version: SCHEMA_VERSION,
            repository: OFFICIAL_REPOSITORY.to_owned(),
            root: StateMark {
                version: self.pinned_root.version,
                sha256: self.pinned_digest.clone(),
            },
            targets: None,
            snapshot: None,
            timestamp: None,
            catalog_sha256: None,
            poisoned: false,
        }
    }

    /// Verifies one complete update and advances the high-water state.
    ///
    /// Equivocation poisons `state`. Other failures leave it unchanged.
    pub fn verify_update(
        &self,
        state: &mut CatalogState,
        update: CatalogUpdate<'_>,
        now: DateTime<Utc>,
    ) -> Result<VerifiedMetadataChain, CatalogError> {
        state.validate()?;
        if state.poisoned {
            return Err(CatalogError::Poisoned);
        }
        if update.root_rotations.len() > MAX_ROOT_ROTATIONS {
            return Err(CatalogError::Limit("Root rotation chain"));
        }

        let mut root = self.pinned_root.clone();
        let mut root_envelope = self.pinned_envelope.clone();
        for bytes in update.root_rotations {
            let (candidate_envelope, candidate_canonical) =
                parse_envelope(bytes, MAX_ROOT_BYTES, "rotated Root")?;
            let candidate: RootMetadata = decode_signed(&candidate_envelope, "rotated Root")?;
            if candidate.version
                != root
                    .version
                    .checked_add(1)
                    .ok_or_else(|| invalid_error("rotated Root", "version overflowed"))?
            {
                return Err(CatalogError::Rollback("Root"));
            }
            let old_keys = root.keyring()?;
            let signed_bytes = canonical_value(&candidate_envelope.signed)?;
            old_keys.verify(
                &root.roles.root,
                &signed_bytes,
                &candidate_envelope.signatures,
                "old Root threshold",
            )?;
            let new_keys = candidate.validate(now, "rotated Root")?;
            new_keys.verify(
                &candidate.roles.root,
                &signed_bytes,
                &candidate_envelope.signatures,
                "new Root threshold",
            )?;
            root = candidate;
            root_envelope = candidate_canonical;
        }

        let root_mark = StateMark {
            version: root.version,
            sha256: sha256(&root_envelope),
        };
        let previous_root = state.root.clone();
        compare_mark(state, "Root", &previous_root, &root_mark)?;
        let keys = root.keyring()?;

        let (targets_envelope, targets_canonical) =
            parse_envelope(update.targets, MAX_TARGETS_BYTES, "Targets")?;
        let targets =
            records::CatalogDocument::from_value(&targets_envelope.signed, now, &keys.keys)?;
        keys.verify(
            &root.roles.targets,
            &canonical_value(&targets_envelope.signed)?,
            &targets_envelope.signatures,
            "Targets",
        )?;
        let targets_mark = StateMark {
            version: targets.catalog_revision,
            sha256: sha256(&targets_canonical),
        };
        if let Some(previous) = state.targets.clone() {
            compare_mark(state, "Targets", &previous, &targets_mark)?;
        }

        let (snapshot_envelope, snapshot_canonical) =
            parse_envelope(update.snapshot, MAX_SNAPSHOT_BYTES, "Snapshot")?;
        let snapshot: SnapshotMetadata = decode_signed(&snapshot_envelope, "Snapshot")?;
        snapshot.validate(now)?;
        snapshot
            .root
            .matches(&root_mark, root_envelope.len(), "Root")?;
        snapshot
            .targets
            .matches(&targets_mark, targets_canonical.len(), "Targets")?;
        keys.verify(
            &root.roles.snapshot,
            &canonical_value(&snapshot_envelope.signed)?,
            &snapshot_envelope.signatures,
            "Snapshot",
        )?;
        let snapshot_mark = StateMark {
            version: snapshot.version,
            sha256: sha256(&snapshot_canonical),
        };
        if let Some(previous) = state.snapshot.clone() {
            compare_mark(state, "Snapshot", &previous, &snapshot_mark)?;
        }

        let (timestamp_envelope, timestamp_canonical) =
            parse_envelope(update.timestamp, MAX_TIMESTAMP_BYTES, "Timestamp")?;
        let timestamp: TimestampMetadata = decode_signed(&timestamp_envelope, "Timestamp")?;
        timestamp.validate(now)?;
        timestamp
            .snapshot
            .matches(&snapshot_mark, snapshot_canonical.len(), "Snapshot")?;
        keys.verify(
            &root.roles.timestamp,
            &canonical_value(&timestamp_envelope.signed)?,
            &timestamp_envelope.signatures,
            "Timestamp",
        )?;
        let timestamp_mark = StateMark {
            version: timestamp.version,
            sha256: sha256(&timestamp_canonical),
        };
        if let Some(previous) = state.timestamp.clone() {
            compare_mark(state, "Timestamp", &previous, &timestamp_mark)?;
        }

        let next = CatalogState {
            schema_version: SCHEMA_VERSION,
            repository: OFFICIAL_REPOSITORY.to_owned(),
            root: root_mark,
            targets: Some(targets_mark),
            snapshot: Some(snapshot_mark),
            timestamp: Some(timestamp_mark),
            catalog_sha256: Some(targets.catalog_sha256.clone()),
            poisoned: false,
        };
        next.validate()?;
        *state = next.clone();
        Ok(VerifiedMetadataChain {
            channel: targets.channel,
            catalog_revision: targets.catalog_revision,
            component_count: targets.component_count,
            catalog_sha256: targets.catalog_sha256.clone(),
            state: next,
            catalog: targets,
        })
    }
}

/// Safe facts from a complete verified metadata chain.
///
/// Component records remain unavailable until the closed component parser is
/// added. This prevents partial verification from authorizing execution.
#[derive(Clone, Debug)]
pub struct VerifiedMetadataChain {
    channel: CatalogChannel,
    catalog_revision: u64,
    component_count: usize,
    catalog_sha256: String,
    state: CatalogState,
    catalog: records::CatalogDocument,
}

impl VerifiedMetadataChain {
    /// Returns the signed catalog channel.
    #[must_use]
    pub const fn channel(&self) -> CatalogChannel {
        self.channel
    }

    /// Returns the signed catalog revision.
    #[must_use]
    pub const fn catalog_revision(&self) -> u64 {
        self.catalog_revision
    }

    /// Returns the bounded number of component records.
    #[must_use]
    pub const fn component_count(&self) -> usize {
        self.component_count
    }

    /// Returns the SHA-256 of the canonical signed catalog object.
    #[must_use]
    pub fn catalog_sha256(&self) -> &str {
        &self.catalog_sha256
    }

    /// Returns the next durable high-water state.
    #[must_use]
    pub fn state(&self) -> &CatalogState {
        &self.state
    }

    /// Selects one active component for an exact host pair.
    pub fn component_for_host(
        &self,
        component_id: &str,
        os: &str,
        arch: &str,
    ) -> Result<Option<VerifiedComponent>, CatalogError> {
        self.catalog.select_component(component_id, os, arch)
    }
}

/// One component selected from a complete verified metadata chain.
#[derive(Clone, Debug)]
pub struct VerifiedComponent {
    component_id: String,
    component_version: String,
    os: String,
    arch: String,
    minimum_os_version: Option<String>,
    entrypoint: String,
    archive_length: u64,
    archive_sha256: String,
    archive_path: String,
    expanded_bytes: u64,
    file_count: u64,
    manifest_length: u64,
    manifest_sha256: String,
    files: Vec<VerifiedFile>,
}

impl VerifiedComponent {
    /// Returns the component ID.
    #[must_use]
    pub fn component_id(&self) -> &str {
        &self.component_id
    }
    /// Returns the component version.
    #[must_use]
    pub fn component_version(&self) -> &str {
        &self.component_version
    }
    /// Returns the target operating system.
    #[must_use]
    pub fn os(&self) -> &str {
        &self.os
    }
    /// Returns the target architecture.
    #[must_use]
    pub fn arch(&self) -> &str {
        &self.arch
    }
    /// Returns the minimum operating-system version, when present.
    #[must_use]
    pub fn minimum_os_version(&self) -> Option<&str> {
        self.minimum_os_version.as_deref()
    }
    /// Returns the relative executable path.
    #[must_use]
    pub fn entrypoint(&self) -> &str {
        &self.entrypoint
    }
    /// Returns the compressed archive byte length.
    #[must_use]
    pub const fn archive_length(&self) -> u64 {
        self.archive_length
    }
    /// Returns the compressed archive SHA-256.
    #[must_use]
    pub fn archive_sha256(&self) -> &str {
        &self.archive_sha256
    }
    /// Returns the digest-qualified archive path.
    #[must_use]
    pub fn archive_path(&self) -> &str {
        &self.archive_path
    }
    /// Returns the exact expanded byte count.
    #[must_use]
    pub const fn expanded_bytes(&self) -> u64 {
        self.expanded_bytes
    }
    /// Returns the exact archive file count.
    #[must_use]
    pub const fn file_count(&self) -> u64 {
        self.file_count
    }
    /// Returns the exact embedded-manifest byte length.
    #[must_use]
    pub const fn manifest_length(&self) -> u64 {
        self.manifest_length
    }
    /// Returns the exact embedded-manifest SHA-256.
    #[must_use]
    pub fn manifest_sha256(&self) -> &str {
        &self.manifest_sha256
    }
    /// Returns the exact non-manifest file inventory.
    #[must_use]
    pub fn files(&self) -> &[VerifiedFile] {
        &self.files
    }
}

/// One verified regular file in a component archive.
#[derive(Clone, Debug)]
pub struct VerifiedFile {
    path: String,
    mode: u32,
    length: u64,
    sha256: String,
}

impl VerifiedFile {
    /// Returns the relative file path.
    #[must_use]
    pub fn path(&self) -> &str {
        &self.path
    }
    /// Returns the Unix permission bits.
    #[must_use]
    pub const fn mode(&self) -> u32 {
        self.mode
    }
    /// Returns the exact file byte length.
    #[must_use]
    pub const fn length(&self) -> u64 {
        self.length
    }
    /// Returns the exact file SHA-256.
    #[must_use]
    pub fn sha256(&self) -> &str {
        &self.sha256
    }
}

/// Official catalog channels.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CatalogChannel {
    /// Early product releases.
    Alpha,
    /// Feature-complete preview releases.
    Beta,
    /// Production releases.
    Stable,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct SignedEnvelope {
    signed: Value,
    signatures: Vec<MetadataSignature>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct MetadataSignature {
    key_id: String,
    signature: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct RootMetadata {
    schema_version: u8,
    repository: String,
    version: u64,
    generated_at: String,
    expires: String,
    consistent_snapshot: bool,
    keys: Vec<TrustedKey>,
    roles: TrustRoles,
}

impl RootMetadata {
    fn validate(&self, now: DateTime<Utc>, label: &'static str) -> Result<Keyring, CatalogError> {
        if self.schema_version != SCHEMA_VERSION
            || self.repository != OFFICIAL_REPOSITORY
            || self.version == 0
            || !self.consistent_snapshot
        {
            return invalid(label, "identity or consistent-snapshot policy is invalid");
        }
        validate_window(&self.generated_at, &self.expires, ROOT_VALIDITY, now, label)?;
        self.keyring()
    }

    fn keyring(&self) -> Result<Keyring, CatalogError> {
        if self.keys.is_empty() || self.keys.len() > MAX_SIGNATURES {
            return Err(CatalogError::Limit("Root keys"));
        }
        if !is_sorted_unique_by(&self.keys, |key| &key.key_id) {
            return invalid("Root", "keys are not sorted and unique");
        }
        let mut keys = BTreeMap::new();
        for key in &self.keys {
            let public = key.validate()?;
            keys.insert(key.key_id.clone(), public);
        }
        self.roles.validate(&keys)?;
        Ok(Keyring { keys })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TrustedKey {
    key_id: String,
    key: PublicKey,
}

impl TrustedKey {
    fn validate(&self) -> Result<Vec<u8>, CatalogError> {
        validate_sha256(&self.key_id, "Root key ID")?;
        if self.key.key_type != "ed25519" || self.key.scheme != "ed25519" {
            return invalid("Root key", "only Ed25519 is supported");
        }
        let public = decode_base64url(&self.key.public, 32, "Root public key")?;
        let digest = sha256(&canonical_bytes(&self.key, "Root public key")?);
        if digest != self.key_id {
            return invalid("Root key", "key ID does not match the canonical key");
        }
        Ok(public)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct PublicKey {
    key_type: String,
    scheme: String,
    public: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TrustRoles {
    root: ThresholdRole,
    targets: ThresholdRole,
    snapshot: ThresholdRole,
    timestamp: ThresholdRole,
}

impl TrustRoles {
    fn validate(&self, keys: &BTreeMap<String, Vec<u8>>) -> Result<(), CatalogError> {
        for (label, role, threshold, count) in [
            ("Root", &self.root, 2, 3),
            ("Targets", &self.targets, 2, 3),
            ("Snapshot", &self.snapshot, 1, 2),
            ("Timestamp", &self.timestamp, 1, 2),
        ] {
            role.validate(keys, threshold, count, label)?;
        }
        let members = self
            .root
            .key_ids
            .iter()
            .chain(&self.targets.key_ids)
            .chain(&self.snapshot.key_ids)
            .chain(&self.timestamp.key_ids)
            .collect::<Vec<_>>();
        if members.iter().copied().collect::<BTreeSet<_>>().len() != members.len()
            || members.len() != keys.len()
        {
            return invalid(
                "Root roles",
                "role keys must be disjoint and fully assigned",
            );
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct ThresholdRole {
    threshold: u8,
    key_ids: Vec<String>,
}

impl ThresholdRole {
    fn validate(
        &self,
        keys: &BTreeMap<String, Vec<u8>>,
        threshold: u8,
        count: usize,
        label: &'static str,
    ) -> Result<(), CatalogError> {
        if self.threshold != threshold
            || self.key_ids.len() != count
            || !is_sorted_unique_by(&self.key_ids, |key| key)
            || self.key_ids.iter().any(|key| !keys.contains_key(key))
        {
            return invalid(label, "threshold role is invalid");
        }
        Ok(())
    }
}

struct Keyring {
    keys: BTreeMap<String, Vec<u8>>,
}

impl Keyring {
    fn verify(
        &self,
        role: &ThresholdRole,
        signed: &[u8],
        signatures: &[MetadataSignature],
        label: &'static str,
    ) -> Result<(), CatalogError> {
        if signatures.is_empty()
            || signatures.len() > MAX_SIGNATURES
            || !is_sorted_unique_by(signatures, |signature| &signature.key_id)
        {
            return invalid(label, "signatures are not sorted, unique, and bounded");
        }
        let allowed = role.key_ids.iter().collect::<BTreeSet<_>>();
        let mut valid = 0usize;
        for signature in signatures {
            if !allowed.contains(&signature.key_id) {
                continue;
            }
            let key = self
                .keys
                .get(&signature.key_id)
                .ok_or(CatalogError::Signature(label))?;
            let bytes = decode_base64url(&signature.signature, 64, label)?;
            UnparsedPublicKey::new(&ED25519, key)
                .verify(signed, &bytes)
                .map_err(|_| CatalogError::Signature(label))?;
            valid += 1;
        }
        if valid < usize::from(role.threshold) {
            return Err(CatalogError::Signature(label));
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct SnapshotMetadata {
    schema_version: u8,
    repository: String,
    version: u64,
    generated_at: String,
    expires: String,
    root: MetadataDescription,
    targets: MetadataDescription,
}

impl SnapshotMetadata {
    fn validate(&self, now: DateTime<Utc>) -> Result<(), CatalogError> {
        if self.schema_version != SCHEMA_VERSION
            || self.repository != OFFICIAL_REPOSITORY
            || self.version == 0
        {
            return invalid("Snapshot", "identity or version is invalid");
        }
        validate_window(
            &self.generated_at,
            &self.expires,
            SNAPSHOT_VALIDITY,
            now,
            "Snapshot",
        )
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TimestampMetadata {
    schema_version: u8,
    repository: String,
    version: u64,
    generated_at: String,
    expires: String,
    snapshot: MetadataDescription,
}

impl TimestampMetadata {
    fn validate(&self, now: DateTime<Utc>) -> Result<(), CatalogError> {
        if self.schema_version != SCHEMA_VERSION
            || self.repository != OFFICIAL_REPOSITORY
            || self.version == 0
        {
            return invalid("Timestamp", "identity or version is invalid");
        }
        validate_window(
            &self.generated_at,
            &self.expires,
            TIMESTAMP_VALIDITY,
            now,
            "Timestamp",
        )
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct MetadataDescription {
    version: u64,
    length: u64,
    sha256: String,
}

impl MetadataDescription {
    fn matches(
        &self,
        mark: &StateMark,
        length: usize,
        label: &'static str,
    ) -> Result<(), CatalogError> {
        validate_sha256(&self.sha256, label)?;
        let expected_length = u64::try_from(length).map_err(|_| CatalogError::Limit(label))?;
        if self.version != mark.version
            || self.length != expected_length
            || self.sha256 != mark.sha256
        {
            return invalid(label, "metadata description does not match exact bytes");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
struct StateMark {
    version: u64,
    sha256: String,
}

impl StateMark {
    fn validate(&self, label: &'static str) -> Result<(), CatalogError> {
        if self.version == 0 {
            return invalid(label, "version is zero");
        }
        validate_sha256(&self.sha256, label)
    }
}

fn compare_mark(
    state: &mut CatalogState,
    label: &'static str,
    previous: &StateMark,
    candidate: &StateMark,
) -> Result<(), CatalogError> {
    if candidate.version < previous.version {
        return Err(CatalogError::Rollback(label));
    }
    if candidate.version == previous.version && candidate.sha256 != previous.sha256 {
        state.poisoned = true;
        return Err(CatalogError::Equivocation(label));
    }
    Ok(())
}

fn validate_window(
    generated_at: &str,
    expires: &str,
    maximum: Duration,
    now: DateTime<Utc>,
    label: &'static str,
) -> Result<(), CatalogError> {
    let generated = parse_timestamp(generated_at, label)?;
    let expiry = parse_timestamp(expires, label)?;
    if expiry <= generated
        || expiry - generated > maximum
        || now + CLOCK_SKEW < generated
        || now >= expiry
    {
        return Err(CatalogError::Freshness(label));
    }
    Ok(())
}

fn parse_timestamp(value: &str, label: &'static str) -> Result<DateTime<Utc>, CatalogError> {
    let parsed = DateTime::parse_from_rfc3339(value)
        .map_err(|error| invalid_error(label, &format!("timestamp is invalid: {error}")))?
        .with_timezone(&Utc);
    if parsed.to_rfc3339_opts(SecondsFormat::Secs, true) != value {
        return invalid(label, "timestamp is not UTC second-precision RFC 3339");
    }
    Ok(parsed)
}

fn parse_envelope(
    bytes: &[u8],
    maximum: usize,
    label: &'static str,
) -> Result<(SignedEnvelope, Vec<u8>), CatalogError> {
    let envelope: SignedEnvelope = parse_strict(bytes, maximum, label)?;
    let canonical = canonical_bytes(&envelope, label)?;
    Ok((envelope, canonical))
}

fn decode_signed<T: DeserializeOwned>(
    envelope: &SignedEnvelope,
    label: &'static str,
) -> Result<T, CatalogError> {
    serde_json::from_value(envelope.signed.clone())
        .map_err(|error| invalid_error(label, &format!("closed signed schema failed: {error}")))
}

fn parse_strict<T: DeserializeOwned>(
    bytes: &[u8],
    maximum: usize,
    label: &'static str,
) -> Result<T, CatalogError> {
    if bytes.len() > maximum {
        return Err(CatalogError::Limit(label));
    }
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let value = deserializer
        .deserialize_any(StrictValueVisitor)
        .map_err(|error| invalid_error(label, &format!("JSON failed: {error}")))?;
    deserializer
        .end()
        .map_err(|error| invalid_error(label, &format!("trailing JSON failed: {error}")))?;
    serde_json::from_value(value)
        .map_err(|error| invalid_error(label, &format!("closed schema failed: {error}")))
}

fn canonical_bytes<T: Serialize>(value: &T, label: &'static str) -> Result<Vec<u8>, CatalogError> {
    let value = serde_json::to_value(value)
        .map_err(|error| invalid_error(label, &format!("encoding failed: {error}")))?;
    canonical_value(&value)
}

fn canonical_value(value: &Value) -> Result<Vec<u8>, CatalogError> {
    serde_json::to_vec(&canonicalize(value.clone()))
        .map_err(|error| invalid_error("canonical JSON", &format!("encoding failed: {error}")))
}

fn canonicalize(value: Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.into_iter().map(canonicalize).collect()),
        Value::Object(object) => {
            let mut entries = object.into_iter().collect::<Vec<_>>();
            entries.sort_by(|left, right| left.0.cmp(&right.0));
            let mut canonical = Map::new();
            for (key, value) in entries {
                canonical.insert(key, canonicalize(value));
            }
            Value::Object(canonical)
        }
        other => other,
    }
}

fn decode_base64url(
    value: &str,
    expected: usize,
    label: &'static str,
) -> Result<Vec<u8>, CatalogError> {
    let decoded = URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| CatalogError::Signature(label))?;
    if decoded.len() != expected || URL_SAFE_NO_PAD.encode(&decoded) != value {
        return invalid(
            label,
            "base64url value is not canonical or has the wrong length",
        );
    }
    Ok(decoded)
}

fn validate_sha256(value: &str, label: &'static str) -> Result<(), CatalogError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return invalid(label, "SHA-256 is not canonical lowercase hexadecimal");
    }
    Ok(())
}

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn is_sorted_unique_by<T, K: Ord + ?Sized>(values: &[T], key: impl Fn(&T) -> &K) -> bool {
    values.windows(2).all(|pair| key(&pair[0]) < key(&pair[1]))
}

fn invalid<T>(subject: &'static str, detail: &str) -> Result<T, CatalogError> {
    Err(invalid_error(subject, detail))
}

fn invalid_error(subject: &'static str, detail: &str) -> CatalogError {
    CatalogError::Invalid {
        subject,
        detail: detail.to_owned(),
    }
}

struct StrictValueVisitor;

impl<'de> Visitor<'de> for StrictValueVisitor {
    type Value = Value;

    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("JSON without duplicate keys or floating-point numbers")
    }

    fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
        Ok(Value::Bool(value))
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
        if value < 0 {
            return Err(E::custom("negative integers are not allowed"));
        }
        Ok(Value::Number(value.into()))
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
        Ok(Value::Number(value.into()))
    }

    fn visit_f64<E: de::Error>(self, _value: f64) -> Result<Self::Value, E> {
        Err(E::custom("floating-point numbers are not allowed"))
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
        Ok(Value::String(value.to_owned()))
    }

    fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
        Ok(Value::String(value))
    }

    fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
        Ok(Value::Null)
    }

    fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
        Ok(Value::Null)
    }

    fn visit_some<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        deserializer.deserialize_any(Self)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> Result<Self::Value, A::Error> {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element_seed(StrictValueSeed)? {
            values.push(value);
        }
        Ok(Value::Array(values))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        let mut object = Map::new();
        while let Some(key) = map.next_key::<String>()? {
            if object.contains_key(&key) {
                return Err(de::Error::custom("duplicate JSON object key"));
            }
            let value = map.next_value_seed(StrictValueSeed)?;
            object.insert(key, value);
        }
        Ok(Value::Object(object))
    }
}

struct StrictValueSeed;

impl<'de> de::DeserializeSeed<'de> for StrictValueSeed {
    type Value = Value;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        deserializer.deserialize_any(StrictValueVisitor)
    }
}
