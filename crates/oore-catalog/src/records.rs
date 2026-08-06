use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use semver::Version;
use serde::Deserialize;
use serde_json::Value;

use super::{
    CatalogChannel, CatalogError, MAX_COMPONENT_RECORD_BYTES, MAX_COMPONENTS, OFFICIAL_REPOSITORY,
    SCHEMA_VERSION, TARGETS_VALIDITY, canonical_value, invalid, invalid_error, parse_timestamp,
    sha256, validate_sha256, validate_window,
};

const MAX_BUNDLE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_EXPANDED_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_FILE_COUNT: u64 = 100_000;
const MAX_PATH_BYTES: usize = 256;
const MAX_CLOSURE_NODES: usize = 128;
const MAX_CLOSURE_EDGES: usize = 256;
const MAX_DIRECT_DEPENDENCIES: usize = 64;
const MAX_CAPABILITIES: usize = 128;
const MAX_NETWORK_HOSTS: usize = 16;

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct CatalogDocument {
    schema_version: u8,
    catalog_id: String,
    pub(super) channel: CatalogChannel,
    pub(super) catalog_revision: u64,
    generated_at: String,
    expires: String,
    components: Vec<ComponentRecord>,
    revocations: Vec<Revocation>,
    policy: CatalogPolicy,
    #[serde(skip)]
    pub(super) component_count: usize,
    #[serde(skip)]
    pub(super) catalog_sha256: String,
}

impl CatalogDocument {
    pub(super) fn from_value(
        value: &Value,
        now: DateTime<Utc>,
        root_keys: &BTreeMap<String, Vec<u8>>,
    ) -> Result<Self, CatalogError> {
        let mut catalog: Self = serde_json::from_value(value.clone()).map_err(|error| {
            invalid_error("Targets", &format!("closed catalog failed: {error}"))
        })?;
        if catalog.schema_version != SCHEMA_VERSION
            || catalog.catalog_id != OFFICIAL_REPOSITORY
            || catalog.catalog_revision == 0
        {
            return invalid("Targets", "catalog identity or revision is invalid");
        }
        validate_window(
            &catalog.generated_at,
            &catalog.expires,
            TARGETS_VALIDITY,
            now,
            "Targets",
        )?;
        catalog.policy.validate()?;
        if catalog.components.len() > MAX_COMPONENTS {
            return Err(CatalogError::Limit("Targets components"));
        }
        for component in &catalog.components {
            if canonical_value(
                &serde_json::to_value(component)
                    .map_err(|error| invalid_error("component", &error.to_string()))?,
            )?
            .len()
                > MAX_COMPONENT_RECORD_BYTES
            {
                return Err(CatalogError::Limit("component record"));
            }
            component.validate(catalog.catalog_revision)?;
        }
        if catalog
            .components
            .windows(2)
            .any(|pair| pair[0].identity_key() >= pair[1].identity_key())
        {
            return invalid(
                "component records",
                "records are not sorted and unique by immutable identity",
            );
        }
        catalog.validate_dependency_graph()?;
        for revocation in &catalog.revocations {
            revocation.validate(catalog.catalog_revision)?;
        }
        ensure_sorted_unique(&catalog.revocations, "revocations")?;
        catalog.validate_revocations(root_keys)?;
        catalog.component_count = catalog.components.len();
        catalog.catalog_sha256 = sha256(&canonical_value(value)?);
        Ok(catalog)
    }

    fn validate_dependency_graph(&self) -> Result<(), CatalogError> {
        let records = self
            .components
            .iter()
            .map(|record| (record.owned_identity_key(), record))
            .collect::<BTreeMap<_, _>>();
        if records.len() != self.components.len() {
            return invalid("component records", "immutable identities are ambiguous");
        }
        for record in &self.components {
            let mut visiting = BTreeSet::new();
            let mut visited = BTreeSet::new();
            let mut expected = BTreeSet::new();
            let mut edge_count = 0usize;
            collect_dependency_closure(
                record,
                &records,
                &mut visiting,
                &mut visited,
                &mut expected,
                &mut edge_count,
            )?;
            if expected != record.dependency_closure.iter().cloned().collect() {
                return invalid(
                    "dependency closure",
                    "closure does not match the exact catalog graph",
                );
            }
        }
        Ok(())
    }

    fn validate_revocations(
        &self,
        root_keys: &BTreeMap<String, Vec<u8>>,
    ) -> Result<(), CatalogError> {
        for revocation in &self.revocations {
            match revocation {
                Revocation::Component { identity, .. } => {
                    let matches = self
                        .components
                        .iter()
                        .filter(|record| record.matches_identity(identity))
                        .count();
                    if matches != 1 {
                        return invalid(
                            "component revocation",
                            "identity does not resolve to one catalog record",
                        );
                    }
                }
                Revocation::Signer { key_id, .. } if !root_keys.contains_key(key_id) => {
                    return invalid(
                        "signer revocation",
                        "key is not authorized by the current Root",
                    );
                }
                Revocation::Signer { .. } => {}
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct ComponentRecord {
    component_id: String,
    component_version: String,
    release_counter: u64,
    target: Target,
    protocol: Protocol,
    entrypoint: String,
    capabilities: Vec<Capability>,
    dependencies: Vec<Dependency>,
    dependency_closure: Vec<Dependency>,
    bundle: Bundle,
    requirements: Requirements,
    service: Option<Service>,
    lifecycle: Lifecycle,
    provenance_policy: Option<ProvenancePolicy>,
}

impl ComponentRecord {
    fn identity_key(&self) -> (&str, &str, &Target) {
        (&self.component_id, &self.component_version, &self.target)
    }

    fn owned_identity_key(&self) -> RecordKey {
        RecordKey(
            self.component_id.clone(),
            self.component_version.clone(),
            self.target.clone(),
        )
    }

    fn matches_dependency(&self, dependency: &Dependency) -> bool {
        self.component_id == dependency.component_id
            && self.component_version == dependency.component_version
            && self.target == dependency.target
            && self.protocol == dependency.protocol
            && self.bundle.sha256 == dependency.bundle.sha256
            && self.bundle.length == dependency.bundle.length
    }

    fn matches_identity(&self, identity: &IdentityReference) -> bool {
        self.component_id == identity.component_id
            && self.component_version == identity.component_version
            && self.target == identity.target
            && self.protocol == identity.protocol
            && self.release_counter == identity.release_counter
            && self.bundle.sha256 == identity.bundle.sha256
            && self.bundle.length == identity.bundle.length
    }

    fn validate(&self, revision: u64) -> Result<(), CatalogError> {
        validate_component_id(&self.component_id)?;
        validate_semver(&self.component_version, "component version")?;
        if self.release_counter == 0 {
            return invalid("component", "release counter is zero");
        }
        self.target.validate()?;
        self.protocol.validate()?;
        validate_relative_path(&self.entrypoint, "entrypoint")?;
        if self.capabilities.is_empty() || self.capabilities.len() > MAX_CAPABILITIES {
            return invalid("component", "capability count is invalid");
        }
        for capability in &self.capabilities {
            capability.validate()?;
        }
        ensure_sorted_unique(&self.capabilities, "capabilities")?;
        validate_dependencies(&self.dependencies, &self.target, &self.protocol)?;
        validate_dependencies(&self.dependency_closure, &self.target, &self.protocol)?;
        if self.dependencies.len() > MAX_DIRECT_DEPENDENCIES
            || self.dependency_closure.len() > MAX_CLOSURE_NODES
            || !self
                .dependencies
                .iter()
                .all(|dependency| self.dependency_closure.contains(dependency))
        {
            return invalid("component", "dependency closure is invalid");
        }
        self.bundle.validate()?;
        self.requirements.validate(&self.target, &self.bundle)?;
        if let Some(service) = &self.service {
            service.validate(&self.target, &self.capabilities)?;
        }
        self.lifecycle.validate(revision)?;
        if let Some(policy) = &self.provenance_policy {
            policy.validate()?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Target {
    os: TargetOs,
    arch: TargetArch,
    minimum_os_version: Option<String>,
}

impl Target {
    fn validate(&self) -> Result<(), CatalogError> {
        if let Some(version) = &self.minimum_os_version {
            validate_version_text(version, "minimum OS version")?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum TargetOs {
    Macos,
    Linux,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum TargetArch {
    Arm64,
    X86_64,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Protocol {
    wire: String,
    major: u16,
    min_minor: u16,
    max_minor: u16,
}

impl Protocol {
    fn validate(&self) -> Result<(), CatalogError> {
        if self.wire != "oore-component" || self.major != 1 || self.min_minor > self.max_minor {
            return invalid("protocol", "only a bounded oore-component/1 range is valid");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Capability {
    id: String,
    mode: CapabilityMode,
    gate_ids: Vec<String>,
}

impl Capability {
    fn validate(&self) -> Result<(), CatalogError> {
        validate_capability_id(&self.id)?;
        ensure_sorted_unique(&self.gate_ids, "capability gate IDs")?;
        for gate in &self.gate_ids {
            validate_token(gate, 64, "gate ID")?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum CapabilityMode {
    OneShot,
    Service,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Dependency {
    component_id: String,
    component_version: String,
    target: Target,
    protocol: Protocol,
    bundle: BundleReference,
    dependency_kind: DependencyKind,
}

impl Dependency {
    fn record_key(&self) -> RecordKey {
        RecordKey(
            self.component_id.clone(),
            self.component_version.clone(),
            self.target.clone(),
        )
    }
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct RecordKey(String, String, Target);

fn collect_dependency_closure(
    record: &ComponentRecord,
    records: &BTreeMap<RecordKey, &ComponentRecord>,
    visiting: &mut BTreeSet<RecordKey>,
    visited: &mut BTreeSet<RecordKey>,
    expected: &mut BTreeSet<Dependency>,
    edge_count: &mut usize,
) -> Result<(), CatalogError> {
    let owner = record.owned_identity_key();
    if !visiting.insert(owner.clone()) {
        return invalid("dependency graph", "cycle detected");
    }
    visited.insert(owner.clone());
    for dependency in &record.dependencies {
        *edge_count = edge_count
            .checked_add(1)
            .ok_or(CatalogError::Limit("dependency edges"))?;
        if *edge_count > MAX_CLOSURE_EDGES {
            return Err(CatalogError::Limit("dependency edges"));
        }
        let child = records
            .get(&dependency.record_key())
            .ok_or_else(|| invalid_error("dependency", "exact child record is missing"))?;
        if !child.matches_dependency(dependency) {
            return invalid(
                "dependency",
                "child record differs from the exact reference",
            );
        }
        expected.insert(dependency.clone());
        let child_key = child.owned_identity_key();
        if visiting.contains(&child_key) {
            return invalid("dependency graph", "cycle detected");
        }
        if !visited.contains(&child_key) {
            collect_dependency_closure(child, records, visiting, visited, expected, edge_count)?;
        }
    }
    visiting.remove(&owner);
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum DependencyKind {
    Runtime,
    Service,
    Data,
}

fn validate_dependencies(
    values: &[Dependency],
    target: &Target,
    protocol: &Protocol,
) -> Result<(), CatalogError> {
    ensure_sorted_unique(values, "dependencies")?;
    for value in values {
        validate_component_id(&value.component_id)?;
        validate_semver(&value.component_version, "dependency version")?;
        value.target.validate()?;
        value.protocol.validate()?;
        value.bundle.validate()?;
        if &value.target != target || value.protocol.major != protocol.major {
            return invalid(
                "dependency",
                "target or protocol major differs from its owner",
            );
        }
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct BundleReference {
    sha256: String,
    length: u64,
}

impl BundleReference {
    fn validate(&self) -> Result<(), CatalogError> {
        validate_sha256(&self.sha256, "bundle digest")?;
        if self.length == 0 || self.length > MAX_BUNDLE_BYTES {
            return invalid("bundle", "length is invalid");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Bundle {
    format: BundleFormat,
    digest_algorithm: DigestAlgorithm,
    length: u64,
    sha256: String,
    path: String,
    expanded_bytes: u64,
    file_count: u64,
}

impl Bundle {
    fn validate(&self) -> Result<(), CatalogError> {
        validate_sha256(&self.sha256, "bundle digest")?;
        validate_relative_path(&self.path, "bundle path")?;
        if !self.path.contains(&self.sha256)
            || self.length == 0
            || self.length > MAX_BUNDLE_BYTES
            || self.expanded_bytes == 0
            || self.expanded_bytes > MAX_EXPANDED_BYTES
            || self.file_count == 0
            || self.file_count > MAX_FILE_COUNT
        {
            return invalid("bundle", "limits or digest-qualified path are invalid");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum BundleFormat {
    TarZst,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum DigestAlgorithm {
    Sha256,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Requirements {
    host: Target,
    toolchains: Vec<ToolchainRequirement>,
    workspace: WorkspaceRequirement,
    network: NetworkRequirement,
    license: Option<LicenseRequirement>,
    privileges: Vec<Privilege>,
    download: DownloadRequirement,
    destructive: Vec<DestructiveGate>,
}

impl Requirements {
    fn validate(&self, target: &Target, bundle: &Bundle) -> Result<(), CatalogError> {
        self.host.validate()?;
        if &self.host != target {
            return invalid("requirements", "host differs from component target");
        }
        ensure_sorted_unique(&self.toolchains, "toolchains")?;
        for toolchain in &self.toolchains {
            toolchain.validate()?;
        }
        self.network.validate()?;
        if let Some(license) = &self.license {
            license.validate()?;
        }
        ensure_sorted_unique(&self.privileges, "privileges")?;
        ensure_sorted_unique(&self.destructive, "destructive gates")?;
        if self.download.compressed_bytes != bundle.length
            || self.download.expanded_bytes != bundle.expanded_bytes
            || self.download.file_count != bundle.file_count
        {
            return invalid("requirements", "download facts differ from the bundle");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct ToolchainRequirement {
    id: String,
    minimum_version: String,
    maximum_version: Option<String>,
}

impl ToolchainRequirement {
    fn validate(&self) -> Result<(), CatalogError> {
        validate_token(&self.id, 128, "toolchain ID")?;
        validate_version_text(&self.minimum_version, "toolchain minimum")?;
        if let Some(version) = &self.maximum_version {
            validate_version_text(version, "toolchain maximum")?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum WorkspaceRequirement {
    Private0700,
    RepositoryCheckout,
    ExternalArtifact,
    GuiSession,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct NetworkRequirement {
    enabled: bool,
    hosts: Vec<NetworkHost>,
}

impl NetworkRequirement {
    fn validate(&self) -> Result<(), CatalogError> {
        if self.hosts.len() > MAX_NETWORK_HOSTS || (!self.enabled && !self.hosts.is_empty()) {
            return invalid("network requirement", "host list is invalid");
        }
        ensure_sorted_unique(&self.hosts, "network hosts")?;
        for host in &self.hosts {
            validate_hostname(&host.hostname)?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct NetworkHost {
    hostname: String,
    transport: NetworkTransport,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum NetworkTransport {
    Https,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct LicenseRequirement {
    id: String,
    text_sha256: String,
}

impl LicenseRequirement {
    fn validate(&self) -> Result<(), CatalogError> {
        validate_token(&self.id, 128, "license ID")?;
        validate_sha256(&self.text_sha256, "license digest")
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum Privilege {
    User,
    Admin,
    Root,
    Keychain,
    Launchd,
    Systemd,
    Network,
    ExternalFilesystem,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct DownloadRequirement {
    compressed_bytes: u64,
    expanded_bytes: u64,
    file_count: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum DestructiveGate {
    ReplaceActive,
    RemoveService,
    AlterVendorState,
    PurgeCache,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Service {
    service_id: String,
    host_service: HostService,
    health_capability: String,
    startup_timeout_ms: u32,
    stability_window_ms: u32,
    stop_grace_ms: u32,
    restart_policy: RestartPolicy,
}

impl Service {
    fn validate(&self, target: &Target, capabilities: &[Capability]) -> Result<(), CatalogError> {
        validate_token(&self.service_id, 128, "service ID")?;
        validate_capability_id(&self.health_capability)?;
        if !capabilities.iter().any(|capability| {
            capability.id == self.health_capability && capability.mode == CapabilityMode::Service
        }) || !matches!(
            (&target.os, &self.host_service),
            (TargetOs::Macos, HostService::Launchd) | (TargetOs::Linux, HostService::Systemd)
        ) || !(1_000..=300_000).contains(&self.startup_timeout_ms)
            || !(1_000..=600_000).contains(&self.stability_window_ms)
            || !(100..=120_000).contains(&self.stop_grace_ms)
        {
            return invalid("service", "health, host, or timeout policy is invalid");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum HostService {
    Launchd,
    Systemd,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum RestartPolicy {
    OnFailure,
    Always,
    Manual,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct Lifecycle {
    status: LifecycleStatus,
    effective_at: String,
    stop_new_locks_at: Option<String>,
    replacement: Option<IdentityReference>,
    reason: String,
}

impl Lifecycle {
    fn validate(&self, revision: u64) -> Result<(), CatalogError> {
        parse_timestamp(&self.effective_at, "lifecycle time")?;
        if let Some(time) = &self.stop_new_locks_at {
            parse_timestamp(time, "stop-new-locks time")?;
        }
        if let Some(replacement) = &self.replacement {
            replacement.validate(revision)?;
        }
        match self.status {
            LifecycleStatus::Active
                if self.stop_new_locks_at.is_some() || self.replacement.is_some() =>
            {
                return invalid(
                    "lifecycle",
                    "active records cannot stop locks or name a replacement",
                );
            }
            LifecycleStatus::Revoked if self.stop_new_locks_at.is_none() => {
                return invalid("lifecycle", "revoked records must stop new locks");
            }
            _ => {}
        }
        validate_token(&self.reason, 128, "lifecycle reason")
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum LifecycleStatus {
    Active,
    Deprecated,
    Revoked,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct IdentityReference {
    component_id: String,
    component_version: String,
    target: Target,
    protocol: Protocol,
    release_counter: u64,
    catalog_revision: u64,
    bundle: BundleReference,
}

impl IdentityReference {
    fn validate(&self, revision: u64) -> Result<(), CatalogError> {
        validate_component_id(&self.component_id)?;
        validate_semver(&self.component_version, "identity version")?;
        self.target.validate()?;
        self.protocol.validate()?;
        self.bundle.validate()?;
        if self.release_counter == 0 || self.catalog_revision != revision {
            return invalid("identity", "counter or catalog revision is invalid");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum ProvenancePolicy {
    GithubActionsOidc {
        repository: String,
        workflow: String,
        issuer: String,
    },
}

impl ProvenancePolicy {
    fn validate(&self) -> Result<(), CatalogError> {
        let Self::GithubActionsOidc {
            repository,
            workflow,
            issuer,
        } = self;
        if repository != "oore-ci/components"
            || issuer != "https://token.actions.githubusercontent.com"
        {
            return invalid("provenance policy", "issuer or repository is not official");
        }
        validate_relative_path(workflow, "provenance workflow")
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
enum Revocation {
    Component {
        identity: IdentityReference,
        effective_at: String,
        reason: String,
    },
    Signer {
        key_id: String,
        effective_at: String,
        reason: String,
    },
}

impl Revocation {
    fn validate(&self, revision: u64) -> Result<(), CatalogError> {
        match self {
            Self::Component {
                identity,
                effective_at,
                reason,
            } => {
                identity.validate(revision)?;
                parse_timestamp(effective_at, "revocation time")?;
                validate_token(reason, 128, "revocation reason")
            }
            Self::Signer {
                key_id,
                effective_at,
                reason,
            } => {
                validate_sha256(key_id, "revoked signer key ID")?;
                parse_timestamp(effective_at, "revocation time")?;
                validate_token(reason, 128, "revocation reason")
            }
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CatalogPolicy {
    max_components: u64,
    max_bundle_bytes: u64,
    max_expanded_bytes: u64,
    max_file_count: u64,
    max_path_bytes: u64,
    max_closure_nodes: u64,
    max_closure_edges: u64,
}

impl CatalogPolicy {
    fn validate(&self) -> Result<(), CatalogError> {
        if self.max_components != MAX_COMPONENTS as u64
            || self.max_bundle_bytes != MAX_BUNDLE_BYTES
            || self.max_expanded_bytes != MAX_EXPANDED_BYTES
            || self.max_file_count != MAX_FILE_COUNT
            || self.max_path_bytes != MAX_PATH_BYTES as u64
            || self.max_closure_nodes != MAX_CLOSURE_NODES as u64
            || self.max_closure_edges != MAX_CLOSURE_EDGES as u64
        {
            return invalid("catalog policy", "limits differ from the v0.2 contract");
        }
        Ok(())
    }
}

fn validate_component_id(value: &str) -> Result<(), CatalogError> {
    if value.is_empty()
        || value.len() > 128
        || value.starts_with('-')
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return invalid("component ID", "value is not lower-case kebab-case");
    }
    Ok(())
}

fn validate_capability_id(value: &str) -> Result<(), CatalogError> {
    if value.len() > 192
        || value
            .split('.')
            .any(|part| validate_component_id(part).is_err())
    {
        return invalid("capability ID", "value is not a bounded dotted ID");
    }
    Ok(())
}

fn validate_semver(value: &str, label: &'static str) -> Result<(), CatalogError> {
    let version =
        Version::parse(value).map_err(|error| invalid_error(label, &error.to_string()))?;
    if !version.build.is_empty() || version.to_string() != value {
        return invalid(label, "version is not canonical or contains build metadata");
    }
    Ok(())
}

fn validate_relative_path(value: &str, label: &'static str) -> Result<(), CatalogError> {
    if value.is_empty()
        || value.len() > MAX_PATH_BYTES
        || value.starts_with('/')
        || value.contains('\\')
        || value.bytes().any(|byte| byte.is_ascii_control())
        || value
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        || value.contains("://")
    {
        return invalid(label, "path is not a safe relative path");
    }
    Ok(())
}

fn validate_token(value: &str, maximum: usize, label: &'static str) -> Result<(), CatalogError> {
    if value.is_empty()
        || value.len() > maximum
        || !value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':' | b'/')
        })
    {
        return invalid(label, "token is outside its closed character set");
    }
    Ok(())
}

fn validate_version_text(value: &str, label: &'static str) -> Result<(), CatalogError> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
    {
        return invalid(label, "version text is invalid");
    }
    Ok(())
}

fn validate_hostname(value: &str) -> Result<(), CatalogError> {
    if value.len() > 253
        || value.is_empty()
        || value.split('.').any(|label| {
            label.is_empty()
                || label.len() > 63
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
    {
        return invalid("network hostname", "hostname is invalid");
    }
    Ok(())
}

fn ensure_sorted_unique<T: Ord>(values: &[T], label: &'static str) -> Result<(), CatalogError> {
    if values.windows(2).any(|pair| pair[0] >= pair[1]) {
        return invalid(label, "values are not sorted and unique");
    }
    Ok(())
}
