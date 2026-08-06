use std::collections::BTreeMap;
use std::fs;
use std::io::{Cursor, Read as _, Write as _};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use anyhow::Context as _;
use oore_component_protocol::ComponentIdentity;
use oore_contract::{
    APPLE_COMPONENT_ID, APPLE_COMPONENT_VERSION, AppleComponentReleaseRecord,
    apple_component_release_for_rust_arch,
};
use rand::RngCore as _;
use sha2::{Digest as _, Sha256};

const RELEASE_TAG: &str = "oore-apple-sign-v0.1.2";
const MAX_BUNDLE_BYTES: usize = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_REDIRECTS: usize = 4;

static INSTALL_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

/// An exact installed Apple component and its bound identity.
pub struct InstalledAppleComponent {
    executable: PathBuf,
    identity: ComponentIdentity,
}

impl InstalledAppleComponent {
    /// Returns the fixed executable path from the verified component store.
    #[must_use]
    pub fn executable(&self) -> &Path {
        &self.executable
    }

    /// Returns the exact component identity for the managed protocol.
    #[must_use]
    pub fn identity(&self) -> &ComponentIdentity {
        &self.identity
    }
}

/// Installs the exact Apple component on first use and verifies every later use.
pub async fn ensure_apple_sign_component() -> anyhow::Result<InstalledAppleComponent> {
    let _guard = INSTALL_LOCK
        .get_or_init(|| tokio::sync::Mutex::new(()))
        .lock()
        .await;
    let executable = std::env::current_exe().context("failed to locate the Oore runner")?;
    let install_root = super::oore_install_root_for_executable(&executable)
        .context("the Apple component needs an installed Oore runner")?;
    validate_owned_root(&install_root)?;
    let release = release_for_host()?;
    let target_root = install_root
        .join("libexec/components")
        .join(APPLE_COMPONENT_ID)
        .join(APPLE_COMPONENT_VERSION)
        .join(format!("macos-{}", release.target_arch));
    create_private_directories(&target_root)?;
    let component_root = target_root.join(release.bundle_sha256);
    let component_executable = component_root.join("bin/oore-apple-sign");
    if !verified_file(
        &component_executable,
        release.executable_length,
        release.executable_sha256,
    )? {
        let bundle = download_bundle(release).await?;
        install_bundle(&target_root, &component_root, release, &bundle)?;
    }
    anyhow::ensure!(
        verified_file(
            &component_executable,
            release.executable_length,
            release.executable_sha256,
        )?,
        "installed Apple component failed verification"
    );
    write_active_record(&target_root, release)?;
    let identity = ComponentIdentity::new(
        APPLE_COMPONENT_ID,
        APPLE_COMPONENT_VERSION,
        "macos",
        release.target_arch,
        format!("sha256:{}", release.bundle_sha256),
        release.bundle_length,
        1,
        1,
    )
    .context("embedded Apple component identity is invalid")?;
    Ok(InstalledAppleComponent {
        executable: component_executable,
        identity,
    })
}

fn release_for_host() -> anyhow::Result<&'static AppleComponentReleaseRecord> {
    anyhow::ensure!(
        std::env::consts::OS == "macos",
        "the Apple component is available only on macOS"
    );
    apple_component_release_for_rust_arch(std::env::consts::ARCH).ok_or_else(|| {
        anyhow::anyhow!(
            "the Apple component does not support architecture {}",
            std::env::consts::ARCH
        )
    })
}

async fn download_bundle(release: &AppleComponentReleaseRecord) -> anyhow::Result<Vec<u8>> {
    let asset = format!(
        "{APPLE_COMPONENT_ID}_{APPLE_COMPONENT_VERSION}_macos_{}.tar.zst",
        release.target_arch
    );
    let url =
        format!("https://github.com/oore-ci/components/releases/download/{RELEASE_TAG}/{asset}");
    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let host = attempt.url().host_str().unwrap_or_default();
            if attempt.previous().len() >= MAX_REDIRECTS {
                return attempt.error("too many component download redirects");
            }
            if matches!(
                host,
                "github.com"
                    | "objects.githubusercontent.com"
                    | "release-assets.githubusercontent.com"
            ) {
                attempt.follow()
            } else {
                attempt.error("component download redirected to an untrusted host")
            }
        }))
        .build()
        .context("failed to create the component download client")?;
    let mut response = client
        .get(url)
        .send()
        .await
        .context("failed to download the Apple component")?
        .error_for_status()
        .context("Apple component download failed")?;
    if let Some(length) = response.content_length() {
        anyhow::ensure!(
            length == release.bundle_length,
            "Apple component download length changed"
        );
    }
    let capacity = usize::try_from(release.bundle_length)
        .context("Apple component bundle length is not supported")?;
    anyhow::ensure!(
        capacity <= MAX_BUNDLE_BYTES,
        "Apple component bundle is too large"
    );
    let mut bytes = Vec::with_capacity(capacity);
    while let Some(chunk) = response
        .chunk()
        .await
        .context("failed to read the Apple component download")?
    {
        anyhow::ensure!(
            bytes.len().saturating_add(chunk.len()) <= capacity,
            "Apple component download exceeded its exact length"
        );
        bytes.extend_from_slice(&chunk);
    }
    anyhow::ensure!(
        bytes.len() == capacity,
        "Apple component download is incomplete"
    );
    anyhow::ensure!(
        sha256(&bytes) == release.bundle_sha256,
        "Apple component download checksum mismatch"
    );
    Ok(bytes)
}

fn install_bundle(
    target_root: &Path,
    component_root: &Path,
    release: &AppleComponentReleaseRecord,
    bundle: &[u8],
) -> anyhow::Result<()> {
    use std::os::unix::fs::{DirBuilderExt as _, PermissionsExt as _};

    if component_root.exists() {
        anyhow::bail!("the existing Apple component directory is invalid");
    }
    let mut random = [0_u8; 12];
    rand::thread_rng().fill_bytes(&mut random);
    let staging = target_root.join(format!(".stage-{}", hex::encode(random)));
    let mut builder = fs::DirBuilder::new();
    builder.mode(0o700).create(&staging)?;
    let result = (|| -> anyhow::Result<()> {
        let decoder = zstd::stream::read::Decoder::new(Cursor::new(bundle))
            .context("Apple component bundle is not valid zstd")?;
        let mut archive = tar::Archive::new(decoder);
        let mut entries = BTreeMap::new();
        for item in archive
            .entries()
            .context("Apple component tar is invalid")?
        {
            let entry = item.context("Apple component tar entry is invalid")?;
            anyhow::ensure!(
                entry.header().entry_type().is_file(),
                "Apple component tar contains a non-file entry"
            );
            let path = entry
                .path()
                .context("Apple component tar path is invalid")?
                .into_owned();
            let path = path
                .to_str()
                .context("Apple component tar path is not UTF-8")?
                .to_owned();
            let limit = match path.as_str() {
                "component.manifest.json" => MAX_MANIFEST_BYTES,
                "bin/oore-apple-sign" => release.executable_length,
                _ => anyhow::bail!("Apple component tar contains an unexpected path"),
            };
            anyhow::ensure!(
                !entries.contains_key(&path),
                "Apple component tar contains a duplicate path"
            );
            let mut content = Vec::new();
            entry
                .take(limit.saturating_add(1))
                .read_to_end(&mut content)
                .context("failed to read the Apple component tar entry")?;
            anyhow::ensure!(
                content.len() as u64 <= limit,
                "Apple component tar entry is too large"
            );
            entries.insert(path, content);
        }
        anyhow::ensure!(entries.len() == 2, "Apple component tar is incomplete");
        let manifest = entries
            .remove("component.manifest.json")
            .context("Apple component manifest is missing")?;
        anyhow::ensure!(!manifest.is_empty(), "Apple component manifest is empty");
        let binary = entries
            .remove("bin/oore-apple-sign")
            .context("Apple component executable is missing")?;
        anyhow::ensure!(
            binary.len() as u64 == release.executable_length
                && sha256(&binary) == release.executable_sha256,
            "Apple component executable does not match the release record"
        );
        let bin = staging.join("bin");
        let mut bin_builder = fs::DirBuilder::new();
        bin_builder.mode(0o700).create(&bin)?;
        write_new_file(&staging.join("component.manifest.json"), &manifest, 0o600)?;
        let executable = bin.join("oore-apple-sign");
        write_new_file(&executable, &binary, 0o700)?;
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))?;
        fs::rename(&staging, component_root).context("failed to activate the Apple component")?;
        fs::File::open(target_root)?.sync_all()?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn write_active_record(
    target_root: &Path,
    release: &AppleComponentReleaseRecord,
) -> anyhow::Result<()> {
    let content = serde_json::to_vec(&serde_json::json!({
        "arch": release.target_arch,
        "bundle_sha256": release.bundle_sha256,
        "component_id": APPLE_COMPONENT_ID,
        "component_version": APPLE_COMPONENT_VERSION,
    }))?;
    let temporary = target_root.join(".active.tmp");
    match fs::remove_file(&temporary) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    write_new_file(&temporary, &content, 0o600)?;
    fs::rename(&temporary, target_root.join("active.json"))?;
    fs::File::open(target_root)?.sync_all()?;
    Ok(())
}

fn verified_file(path: &Path, expected_length: u64, expected_sha256: &str) -> anyhow::Result<bool> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.into()),
    };
    anyhow::ensure!(
        metadata.file_type().is_file(),
        "Apple component executable is not a regular file"
    );
    if metadata.len() != expected_length {
        return Ok(false);
    }
    let bytes = fs::read(path)?;
    Ok(sha256(&bytes) == expected_sha256)
}

fn validate_owned_root(path: &Path) -> anyhow::Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    anyhow::ensure!(
        metadata.is_dir() && !metadata.file_type().is_symlink(),
        "Oore install root is not a trusted directory"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt as _, PermissionsExt as _};
        anyhow::ensure!(
            metadata.uid() == super::current_uid()?,
            "Oore install root has the wrong owner"
        );
        anyhow::ensure!(
            metadata.permissions().mode() & 0o022 == 0,
            "Oore install root is writable by another user"
        );
    }
    Ok(())
}

fn create_private_directories(path: &Path) -> anyhow::Result<()> {
    use std::os::unix::fs::{DirBuilderExt as _, PermissionsExt as _};

    let mut builder = fs::DirBuilder::new();
    builder.recursive(true).mode(0o700).create(path)?;
    let metadata = fs::symlink_metadata(path)?;
    anyhow::ensure!(
        metadata.is_dir() && !metadata.file_type().is_symlink(),
        "component store path is not a directory"
    );
    anyhow::ensure!(
        metadata.permissions().mode() & 0o077 == 0,
        "component store path is not private"
    );
    Ok(())
}

fn write_new_file(path: &Path, content: &[u8], mode: u32) -> anyhow::Result<()> {
    use std::os::unix::fs::OpenOptionsExt as _;

    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true).mode(mode);
    let mut file = options.open(path)?;
    file.write_all(content)?;
    file.sync_all()?;
    Ok(())
}

fn sha256(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}
