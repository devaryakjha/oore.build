use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{
    CatalogChannel, CatalogError, MAX_COMPONENT_RECORD_BYTES, MAX_ROOT_BYTES, MAX_SNAPSHOT_BYTES,
    MAX_TARGETS_BYTES, PublicKey, ROOT_VALIDITY, RootMetadata, SCHEMA_VERSION, SNAPSHOT_VALIDITY,
    SnapshotMetadata, TIMESTAMP_VALIDITY, TimestampMetadata, TrustRoles, TrustedKey, VerifierKey,
    canonical_value, invalid, invalid_error, parse_envelope, parse_strict, records, sha256,
    validate_sha256,
};

const COMPONENT_EVIDENCE_BYTES: usize = 256 * 1024;
const COMPONENTS_REPOSITORY: &str = "https://github.com/oore-ci/components";
const OFFICIAL_REPOSITORY: &str = "oore-official";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceManifest {
    schema_version: u8,
    identity: EvidenceIdentity,
    release: EvidenceRelease,
    entrypoint: String,
    capabilities: Vec<Value>,
    dependencies: Vec<EvidenceDependency>,
    dependency_closure: Vec<EvidenceDependency>,
    requirements: EvidenceRequirements,
    service: Option<Value>,
    lifecycle: Value,
    provenance: EvidenceProvenance,
    bundle: EvidencePayloadBundle,
    files: Vec<Value>,
    manifest_sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceIdentity {
    component_id: String,
    component_version: String,
    target: Value,
    protocol: Value,
    release_counter: u64,
    payload_sha256: String,
    payload_length: u64,
    catalog_revision: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceRelease {
    coordinate: String,
    package: String,
    program: String,
    package_version: String,
    component_version: String,
    tag: String,
    commit: String,
    repository: String,
    publish: bool,
    source: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceDependency {
    component_id: String,
    component_version: String,
    target: Value,
    protocol: Value,
    bundle_sha256: String,
    bundle_length: u64,
    release_counter: u64,
    license: String,
    dependency_kind: Value,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceRequirements {
    host: Value,
    toolchains: Vec<Value>,
    workspace: Value,
    network: Value,
    license: Option<Value>,
    privileges: Vec<Value>,
    download: EvidenceDownload,
    destructive: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceDownload {
    payload_bytes: u64,
    expanded_bytes: u64,
    file_count: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceProvenance {
    repository: String,
    workflow: String,
    workflow_name: String,
    tag: String,
    commit: String,
    payload_subject: EvidencePayloadSubject,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidencePayloadSubject {
    name: String,
    sha256: String,
    length: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidencePayloadBundle {
    format: String,
    digest_algorithm: String,
    payload_length: u64,
    payload_sha256: String,
    path: String,
    expanded_bytes: u64,
    file_count: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EvidenceArtifact {
    schema_version: u8,
    asset_name: String,
    format: String,
    sha256: String,
    length: u64,
    manifest_sha256: String,
    inventory_sha256: String,
    target: Value,
    component_id: String,
    component_version: String,
    package_tag: String,
    commit: String,
}

/// Converts one qualified Components release into Oore's closed admission record.
pub fn import_component_release(
    manifest_bytes: &[u8],
    artifact_bytes: &[u8],
    catalog_revision: u64,
) -> Result<Vec<u8>, CatalogError> {
    let manifest_value: Value = parse_strict(
        manifest_bytes,
        COMPONENT_EVIDENCE_BYTES,
        "component release manifest",
    )?;
    if canonical_value(&manifest_value)? != manifest_bytes {
        return invalid("component release manifest", "bytes are not canonical JSON");
    }
    let manifest: EvidenceManifest = serde_json::from_value(manifest_value)
        .map_err(|error| invalid_error("component release manifest", &error.to_string()))?;
    let artifact: EvidenceArtifact = parse_strict(
        artifact_bytes,
        COMPONENT_EVIDENCE_BYTES,
        "component release artifact",
    )?;
    validate_evidence(&manifest, &artifact, catalog_revision)?;

    let dependencies = manifest
        .dependencies
        .into_iter()
        .map(dependency_value)
        .collect::<Vec<_>>();
    let dependency_closure = manifest
        .dependency_closure
        .into_iter()
        .map(dependency_value)
        .collect::<Vec<_>>();
    let source_workflow = manifest.provenance.workflow.clone();
    let record = json!({
        "component_id": manifest.identity.component_id,
        "component_version": manifest.identity.component_version,
        "release_counter": manifest.identity.release_counter,
        "target": manifest.identity.target,
        "protocol": manifest.identity.protocol,
        "entrypoint": manifest.entrypoint,
        "capabilities": manifest.capabilities,
        "dependencies": dependencies,
        "dependency_closure": dependency_closure,
        "bundle": {
            "format": "tar_zst",
            "digest_algorithm": "sha256",
            "length": artifact.length,
            "sha256": artifact.sha256,
            "path": format!("sha256/{}/{}", artifact.sha256, artifact.asset_name),
            "expanded_bytes": manifest.bundle.expanded_bytes,
            "file_count": manifest.bundle.file_count
        },
        "manifest": {
            "path": "component.manifest.json",
            "length": manifest_bytes.len(),
            "sha256": sha256(manifest_bytes)
        },
        "files": manifest.files,
        "requirements": {
            "host": manifest.requirements.host,
            "toolchains": manifest.requirements.toolchains,
            "workspace": manifest.requirements.workspace,
            "network": manifest.requirements.network,
            "license": manifest.requirements.license,
            "privileges": manifest.requirements.privileges,
            "download": {
                "compressed_bytes": artifact.length,
                "expanded_bytes": manifest.requirements.download.expanded_bytes,
                "file_count": manifest.requirements.download.file_count
            },
            "destructive": manifest.requirements.destructive
        },
        "service": manifest.service,
        "lifecycle": manifest.lifecycle,
        "provenance_policy": {
            "kind": "github_actions_oidc",
            "repository": "oore-ci/components",
            "workflow": source_workflow,
            "issuer": "https://token.actions.githubusercontent.com"
        }
    });
    records::CatalogDocument::component_from_value(record.clone())?.validate(catalog_revision)?;
    let canonical = canonical_value(&record)?;
    if canonical.len() > MAX_COMPONENT_RECORD_BYTES {
        return Err(CatalogError::Limit("component admission record"));
    }
    Ok(canonical)
}

/// Creates one unsigned Targets payload from closed component records.
pub fn build_targets_payload(
    channel: CatalogChannel,
    catalog_revision: u64,
    component_records: &[&[u8]],
    now: DateTime<Utc>,
) -> Result<Vec<u8>, CatalogError> {
    let mut components = component_records
        .iter()
        .map(|bytes| {
            let value: Value = parse_strict(bytes, MAX_COMPONENT_RECORD_BYTES, "component record")?;
            records::CatalogDocument::component_from_value(value)
        })
        .collect::<Result<Vec<_>, _>>()?;
    components.sort_by(|left, right| left.identity_key().cmp(&right.identity_key()));
    records::CatalogDocument::compose(channel, catalog_revision, components, now)
}

/// Creates the first unsigned Root payload from ten disjoint signer keys.
pub fn build_root_payload(
    root_keys: &[&[u8]],
    targets_keys: &[&[u8]],
    snapshot_keys: &[&[u8]],
    timestamp_keys: &[&[u8]],
    version: u64,
    now: DateTime<Utc>,
) -> Result<Vec<u8>, CatalogError> {
    if root_keys.len() != 3
        || targets_keys.len() != 3
        || snapshot_keys.len() != 2
        || timestamp_keys.len() != 2
        || version == 0
    {
        return invalid("Root", "signer counts or version are invalid");
    }
    let mut trusted_keys = Vec::with_capacity(10);
    let root_ids = import_keys(root_keys, &mut trusted_keys)?;
    let targets_ids = import_keys(targets_keys, &mut trusted_keys)?;
    let snapshot_ids = import_keys(snapshot_keys, &mut trusted_keys)?;
    let timestamp_ids = import_keys(timestamp_keys, &mut trusted_keys)?;
    trusted_keys.sort_by(|left, right| left.key_id.cmp(&right.key_id));
    if trusted_keys
        .windows(2)
        .any(|pair| pair[0].key_id == pair[1].key_id)
    {
        return invalid("Root", "one signer key has more than one role");
    }
    let expires = checked_expiry(now, ROOT_VALIDITY, "Root")?;
    let root = RootMetadata {
        schema_version: SCHEMA_VERSION,
        repository: OFFICIAL_REPOSITORY.to_owned(),
        version,
        generated_at: timestamp(now),
        expires: timestamp(expires),
        consistent_snapshot: true,
        keys: trusted_keys,
        roles: TrustRoles {
            root: threshold(2, root_ids),
            targets: threshold(2, targets_ids),
            snapshot: threshold(1, snapshot_ids),
            timestamp: threshold(1, timestamp_ids),
        },
    };
    root.validate(now, "Root")?;
    super::canonical_bytes(&root, "Root")
}

/// Creates one unsigned Snapshot payload from exact signed metadata envelopes.
pub fn build_snapshot_payload(
    root_envelope: &[u8],
    targets_envelope: &[u8],
    version: u64,
    now: DateTime<Utc>,
) -> Result<Vec<u8>, CatalogError> {
    if version == 0 {
        return invalid("Snapshot", "version is zero");
    }
    let (root_value, root_bytes) = parse_envelope(root_envelope, MAX_ROOT_BYTES, "Root")?;
    let root: RootMetadata = super::decode_signed(&root_value, "Root")?;
    let (targets_value, targets_bytes) =
        parse_envelope(targets_envelope, MAX_TARGETS_BYTES, "Targets")?;
    let targets = records::CatalogDocument::from_value(
        &targets_value.signed,
        now,
        &std::collections::BTreeMap::new(),
    )?;
    let expires = checked_expiry(now, SNAPSHOT_VALIDITY, "Snapshot")?;
    let snapshot = SnapshotMetadata {
        schema_version: SCHEMA_VERSION,
        repository: OFFICIAL_REPOSITORY.to_owned(),
        version,
        generated_at: timestamp(now),
        expires: timestamp(expires),
        root: description(root.version, &root_bytes)?,
        targets: description(targets.catalog_revision, &targets_bytes)?,
    };
    snapshot.validate(now)?;
    super::canonical_bytes(&snapshot, "Snapshot")
}

/// Creates one unsigned Timestamp payload from an exact signed Snapshot envelope.
pub fn build_timestamp_payload(
    snapshot_envelope: &[u8],
    version: u64,
    now: DateTime<Utc>,
) -> Result<Vec<u8>, CatalogError> {
    if version == 0 {
        return invalid("Timestamp", "version is zero");
    }
    let (snapshot_value, snapshot_bytes) =
        parse_envelope(snapshot_envelope, MAX_SNAPSHOT_BYTES, "Snapshot")?;
    let snapshot: SnapshotMetadata = super::decode_signed(&snapshot_value, "Snapshot")?;
    let expires = checked_expiry(now, TIMESTAMP_VALIDITY, "Timestamp")?;
    let timestamp_value = TimestampMetadata {
        schema_version: SCHEMA_VERSION,
        repository: OFFICIAL_REPOSITORY.to_owned(),
        version,
        generated_at: timestamp(now),
        expires: timestamp(expires),
        snapshot: description(snapshot.version, &snapshot_bytes)?,
    };
    timestamp_value.validate(now)?;
    super::canonical_bytes(&timestamp_value, "Timestamp")
}

fn import_keys(
    documents: &[&[u8]],
    trusted_keys: &mut Vec<TrustedKey>,
) -> Result<Vec<String>, CatalogError> {
    let mut ids = Vec::with_capacity(documents.len());
    for document in documents {
        let key: PublicKey = parse_strict(document, 8 * 1024, "Root public key")?;
        let verifier = VerifierKey::from_bytes(document)?;
        ids.push(verifier.key_id().to_owned());
        trusted_keys.push(TrustedKey {
            key_id: verifier.key_id().to_owned(),
            key,
        });
    }
    ids.sort();
    Ok(ids)
}

fn threshold(threshold: u8, key_ids: Vec<String>) -> super::ThresholdRole {
    super::ThresholdRole { threshold, key_ids }
}

fn checked_expiry(
    now: DateTime<Utc>,
    validity: chrono::Duration,
    label: &'static str,
) -> Result<DateTime<Utc>, CatalogError> {
    now.checked_add_signed(validity)
        .ok_or_else(|| invalid_error(label, "expiry overflowed"))
}

fn timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn description(version: u64, bytes: &[u8]) -> Result<super::MetadataDescription, CatalogError> {
    Ok(super::MetadataDescription {
        version,
        length: u64::try_from(bytes.len()).map_err(|_| CatalogError::Limit("metadata length"))?,
        sha256: sha256(bytes),
    })
}

fn dependency_value(dependency: EvidenceDependency) -> Value {
    let EvidenceDependency {
        component_id,
        component_version,
        target,
        protocol,
        bundle_sha256,
        bundle_length,
        release_counter: _,
        license: _,
        dependency_kind,
    } = dependency;
    json!({
        "component_id": component_id,
        "component_version": component_version,
        "target": target,
        "protocol": protocol,
        "bundle": {"sha256": bundle_sha256, "length": bundle_length},
        "dependency_kind": dependency_kind
    })
}

fn validate_evidence(
    manifest: &EvidenceManifest,
    artifact: &EvidenceArtifact,
    catalog_revision: u64,
) -> Result<(), CatalogError> {
    validate_sha256(&manifest.manifest_sha256, "component manifest self digest")?;
    validate_sha256(
        &manifest.identity.payload_sha256,
        "component payload digest",
    )?;
    validate_sha256(
        &manifest.bundle.payload_sha256,
        "component bundle payload digest",
    )?;
    validate_sha256(&artifact.sha256, "component artifact digest")?;
    validate_sha256(
        &artifact.manifest_sha256,
        "component artifact manifest digest",
    )?;
    validate_sha256(
        &artifact.inventory_sha256,
        "component artifact inventory digest",
    )?;
    if manifest.dependencies.iter().any(|dependency| {
        dependency.release_counter == 0
            || dependency.license.trim().is_empty()
            || dependency.license.len() > 128
    }) || manifest.dependency_closure.iter().any(|dependency| {
        dependency.release_counter == 0
            || dependency.license.trim().is_empty()
            || dependency.license.len() > 128
    }) {
        return invalid(
            "component release evidence",
            "dependency release facts are invalid",
        );
    }
    if manifest.schema_version != 1
        || artifact.schema_version != 1
        || catalog_revision == 0
        || manifest.identity.catalog_revision != catalog_revision
        || manifest.identity.component_id != artifact.component_id
        || manifest.identity.component_version != artifact.component_version
        || manifest.identity.target != artifact.target
        || manifest.identity.payload_sha256 != manifest.bundle.payload_sha256
        || manifest.identity.payload_length != manifest.bundle.payload_length
        || manifest.bundle.format != "tar_zst"
        || manifest.bundle.digest_algorithm != "sha256"
        || manifest.bundle.path != artifact.asset_name
        || artifact.format != "tar_zst"
        || artifact.manifest_sha256 != manifest.manifest_sha256
        || manifest.release.repository != COMPONENTS_REPOSITORY
        || manifest.provenance.repository != COMPONENTS_REPOSITORY
        || manifest.provenance.workflow_name.trim().is_empty()
        || manifest.provenance.workflow_name.len() > 128
        || manifest.release.source != "generated"
        || !manifest.release.publish
        || manifest.release.program != manifest.identity.component_id
        || manifest.release.component_version != manifest.identity.component_version
        || manifest.release.package_version != manifest.identity.component_version
        || manifest.release.tag != artifact.package_tag
        || manifest.release.commit != artifact.commit
        || manifest.provenance.tag != artifact.package_tag
        || manifest.provenance.commit != artifact.commit
        || manifest.provenance.payload_subject.name != artifact.asset_name
        || manifest.provenance.payload_subject.sha256 != manifest.bundle.payload_sha256
        || manifest.provenance.payload_subject.length != manifest.bundle.payload_length
        || manifest.requirements.download.payload_bytes != manifest.bundle.payload_length
        || manifest.requirements.download.expanded_bytes != manifest.bundle.expanded_bytes
        || manifest.requirements.download.file_count != manifest.bundle.file_count
        || manifest.release.coordinate
            != format!("oore.components/{}", manifest.identity.component_id)
        || manifest.release.tag
            != format!(
                "{}-v{}",
                manifest.release.package, manifest.release.package_version
            )
    {
        return invalid(
            "component release evidence",
            "manifest and artifact identities do not match",
        );
    }
    Ok(())
}
