//! Verified, immutable storage for Oore components.

#![deny(missing_docs)]
#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek as _, Write};
#[cfg(unix)]
use std::os::unix::fs::{MetadataExt as _, OpenOptionsExt as _, PermissionsExt as _};
use std::path::{Path, PathBuf};

use oore_catalog::{VerifiedComponent, VerifiedFile};
use serde::Serialize;
use sha2::{Digest as _, Sha256};
use thiserror::Error;

const MANIFEST_PATH: &str = "component.manifest.json";

/// A component-store failure that occurs before activation.
#[derive(Debug, Error)]
pub enum StoreError {
    /// The local filesystem rejected a bounded operation.
    #[error("component store I/O failed: {0}")]
    Io(#[from] std::io::Error),
    /// The archive or extracted files differ from signed catalog facts.
    #[error("component archive is invalid: {0}")]
    Invalid(&'static str),
    /// The completion record could not be encoded.
    #[error("component completion record could not be encoded")]
    Encode,
}

/// One installed component selected from the immutable store.
#[derive(Clone, Debug)]
pub struct InstalledComponent {
    root: PathBuf,
    entrypoint: PathBuf,
}

impl InstalledComponent {
    /// Returns the immutable component directory.
    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Returns the verified executable path.
    #[must_use]
    pub fn entrypoint(&self) -> &Path {
        &self.entrypoint
    }
}

#[derive(Serialize)]
struct Completion<'a> {
    schema_version: u8,
    component_id: &'a str,
    component_version: &'a str,
    archive_sha256: &'a str,
}

/// Installs one exact local archive and activates its immutable digest.
pub fn install_archive(
    component: &VerifiedComponent,
    archive_path: &Path,
    store_root: &Path,
) -> Result<InstalledComponent, StoreError> {
    ensure_private_directory(store_root)?;
    let objects = store_root.join("objects").join("sha256");
    let active = store_root.join("active");
    ensure_private_directory(&objects)?;
    ensure_private_directory(&active)?;

    let mut archive = open_regular_nofollow(archive_path)?;
    verify_archive(
        &mut archive,
        component.archive_length(),
        component.archive_sha256(),
    )?;
    let final_root = objects.join(component.archive_sha256());
    if final_root.exists() {
        verify_complete(&final_root, component)?;
    } else {
        let staging = tempfile::Builder::new()
            .prefix(".staging-")
            .tempdir_in(&objects)?;
        extract_verified(component, archive, staging.path())?;
        write_completion(staging.path(), component)?;
        let staged = staging.keep();
        fs::rename(&staged, &final_root)?;
        sync_directory(&objects)?;
    }
    activate(&active, component)?;
    let entrypoint = final_root.join(component.entrypoint());
    Ok(InstalledComponent {
        root: final_root,
        entrypoint,
    })
}

/// Opens the active component only after every stored file matches again.
pub fn load_active(
    component: &VerifiedComponent,
    store_root: &Path,
) -> Result<InstalledComponent, StoreError> {
    ensure_private_directory(store_root)?;
    let active_path = store_root.join("active").join(component.component_id());
    let digest = read_small_nofollow(&active_path, 65)?;
    if digest != format!("{}\n", component.archive_sha256()).as_bytes() {
        return Err(StoreError::Invalid("active component digest differs"));
    }
    let root = store_root
        .join("objects")
        .join("sha256")
        .join(component.archive_sha256());
    verify_complete(&root, component)?;
    Ok(InstalledComponent {
        entrypoint: root.join(component.entrypoint()),
        root,
    })
}

fn verify_archive(file: &mut File, length: u64, expected_digest: &str) -> Result<(), StoreError> {
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || metadata.len() != length {
        return Err(StoreError::Invalid("compressed length differs"));
    }
    let mut hasher = Sha256::new();
    let copied = std::io::copy(file, &mut hasher)?;
    if copied != length || format!("{:x}", hasher.finalize()) != expected_digest {
        return Err(StoreError::Invalid("compressed digest differs"));
    }
    file.rewind()?;
    Ok(())
}

fn extract_verified(
    component: &VerifiedComponent,
    archive: File,
    destination: &Path,
) -> Result<(), StoreError> {
    let mut expected = component
        .files()
        .iter()
        .map(|file| (file.path(), ExpectedFile::Catalog(file)))
        .collect::<BTreeMap<_, _>>();
    expected.insert(MANIFEST_PATH, ExpectedFile::Manifest);
    let decoder = zstd::Decoder::new(archive)?;
    let mut tar = tar::Archive::new(decoder);
    let mut seen = BTreeSet::new();
    let mut expanded = 0u64;
    for entry in tar.entries()? {
        let mut entry = entry?;
        if !entry.header().entry_type().is_file() {
            return Err(StoreError::Invalid("archive contains a non-regular file"));
        }
        let path_bytes = entry.path_bytes();
        let path = path_bytes
            .as_ref()
            .strip_prefix(b"./")
            .unwrap_or(path_bytes.as_ref());
        let path = std::str::from_utf8(path)
            .map_err(|_| StoreError::Invalid("archive path is not UTF-8"))?;
        let Some(expected_file) = expected.get(path) else {
            return Err(StoreError::Invalid("archive contains an unexpected file"));
        };
        if !seen.insert(path.to_owned()) {
            return Err(StoreError::Invalid("archive contains a duplicate file"));
        }
        let (length, digest, mode) = expected_file.facts(component);
        let header_mode = entry.header().mode()? & 0o777;
        if entry.size() != length || header_mode != mode {
            return Err(StoreError::Invalid("file length or mode differs"));
        }
        expanded = expanded
            .checked_add(length)
            .ok_or(StoreError::Invalid("expanded length overflowed"))?;
        let output = destination.join(path);
        let parent = output
            .parent()
            .ok_or(StoreError::Invalid("file has no parent directory"))?;
        fs::create_dir_all(parent)?;
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        options.mode(mode);
        let mut file = options.open(&output)?;
        let mut hasher = Sha256::new();
        let mut bounded = Read::by_ref(&mut entry).take(length + 1);
        let copied = std::io::copy(&mut bounded, &mut DigestWriter(&mut file, &mut hasher))?;
        if copied != length || format!("{:x}", hasher.finalize()) != digest {
            return Err(StoreError::Invalid("file content differs"));
        }
        file.sync_all()?;
    }
    if seen.len() as u64 != component.file_count()
        || seen.len() != expected.len()
        || expanded != component.expanded_bytes()
    {
        return Err(StoreError::Invalid("archive inventory is incomplete"));
    }
    Ok(())
}

enum ExpectedFile<'a> {
    Catalog(&'a VerifiedFile),
    Manifest,
}

impl ExpectedFile<'_> {
    fn facts<'a>(&'a self, component: &'a VerifiedComponent) -> (u64, &'a str, u32) {
        match self {
            Self::Catalog(file) => (file.length(), file.sha256(), file.mode()),
            Self::Manifest => (
                component.manifest_length(),
                component.manifest_sha256(),
                0o644,
            ),
        }
    }
}

struct DigestWriter<'a>(&'a mut File, &'a mut Sha256);

impl Write for DigestWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        let count = self.0.write(bytes)?;
        self.1.update(&bytes[..count]);
        Ok(count)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.0.flush()
    }
}

fn write_completion(root: &Path, component: &VerifiedComponent) -> Result<(), StoreError> {
    let bytes = serde_json::to_vec(&Completion {
        schema_version: 1,
        component_id: component.component_id(),
        component_version: component.component_version(),
        archive_sha256: component.archive_sha256(),
    })
    .map_err(|_| StoreError::Encode)?;
    write_new(root.join(".complete"), &bytes, 0o600)
}

fn verify_complete(root: &Path, component: &VerifiedComponent) -> Result<(), StoreError> {
    let metadata = fs::symlink_metadata(root)?;
    if !metadata.file_type().is_dir() {
        return Err(StoreError::Invalid("digest object is not a directory"));
    }
    let expected = serde_json::to_vec(&Completion {
        schema_version: 1,
        component_id: component.component_id(),
        component_version: component.component_version(),
        archive_sha256: component.archive_sha256(),
    })
    .map_err(|_| StoreError::Encode)?;
    let actual = read_small_nofollow(&root.join(".complete"), 4 * 1024)?;
    if actual != expected {
        return Err(StoreError::Invalid("completion record differs"));
    }
    let mut expected_paths = component
        .files()
        .iter()
        .map(|file| file.path().to_owned())
        .collect::<BTreeSet<_>>();
    expected_paths.insert(MANIFEST_PATH.to_owned());
    expected_paths.insert(".complete".to_owned());
    let mut actual_paths = BTreeSet::new();
    collect_regular_files(root, root, &mut actual_paths, expected_paths.len())?;
    if actual_paths != expected_paths {
        return Err(StoreError::Invalid("installed file inventory differs"));
    }
    verify_stored_file(
        &root.join(MANIFEST_PATH),
        component.manifest_length(),
        component.manifest_sha256(),
        0o644,
    )?;
    for file in component.files() {
        verify_stored_file(
            &root.join(file.path()),
            file.length(),
            file.sha256(),
            file.mode(),
        )?;
    }
    Ok(())
}

fn collect_regular_files(
    root: &Path,
    directory: &Path,
    files: &mut BTreeSet<String>,
    maximum: usize,
) -> Result<(), StoreError> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let metadata = entry.file_type()?;
        let path = entry.path();
        if metadata.is_dir() {
            collect_regular_files(root, &path, files, maximum)?;
        } else if metadata.is_file() {
            let relative = path
                .strip_prefix(root)
                .map_err(|_| StoreError::Invalid("stored path escaped its root"))?
                .to_str()
                .ok_or(StoreError::Invalid("stored path is not UTF-8"))?;
            if !files.insert(relative.to_owned()) || files.len() > maximum {
                return Err(StoreError::Invalid("stored file inventory is invalid"));
            }
        } else {
            return Err(StoreError::Invalid(
                "stored object contains a link or special file",
            ));
        }
    }
    Ok(())
}

fn verify_stored_file(path: &Path, length: u64, digest: &str, mode: u32) -> Result<(), StoreError> {
    let mut file = open_regular_nofollow(path)?;
    let metadata = file.metadata()?;
    #[cfg(unix)]
    if metadata.mode() & 0o777 != mode {
        return Err(StoreError::Invalid("stored file mode differs"));
    }
    if metadata.len() != length {
        return Err(StoreError::Invalid("stored file length differs"));
    }
    let mut hasher = Sha256::new();
    let copied = std::io::copy(&mut file, &mut hasher)?;
    if copied != length || format!("{:x}", hasher.finalize()) != digest {
        return Err(StoreError::Invalid("stored file digest differs"));
    }
    Ok(())
}

fn activate(active: &Path, component: &VerifiedComponent) -> Result<(), StoreError> {
    let bytes = format!("{}\n", component.archive_sha256());
    let temporary = tempfile::NamedTempFile::new_in(active)?;
    #[cfg(unix)]
    temporary
        .as_file()
        .set_permissions(fs::Permissions::from_mode(0o600))?;
    temporary.as_file().write_all(bytes.as_bytes())?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(active.join(component.component_id()))
        .map_err(|error| error.error)?;
    sync_directory(active)
}

fn ensure_private_directory(path: &Path) -> Result<(), StoreError> {
    fs::create_dir_all(path)?;
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_dir() {
        return Err(StoreError::Invalid("store path is not a directory"));
    }
    #[cfg(unix)]
    {
        if metadata.uid() != rustix::process::getuid().as_raw() {
            return Err(StoreError::Invalid("store directory has another owner"));
        }
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn open_regular_nofollow(path: &Path) -> Result<File, StoreError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    options.custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC);
    let file = options.open(path)?;
    if !file.metadata()?.file_type().is_file() {
        return Err(StoreError::Invalid("archive is not a regular file"));
    }
    Ok(file)
}

fn read_small_nofollow(path: &Path, limit: u64) -> Result<Vec<u8>, StoreError> {
    let file = open_regular_nofollow(path)?;
    let metadata = file.metadata()?;
    if metadata.len() > limit {
        return Err(StoreError::Invalid("small store file exceeds its limit"));
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err(StoreError::Invalid(
            "small store file grew beyond its limit",
        ));
    }
    Ok(bytes)
}

fn write_new(path: PathBuf, bytes: &[u8], mode: u32) -> Result<(), StoreError> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(mode);
    let mut file = options.open(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}

fn sync_directory(path: &Path) -> Result<(), StoreError> {
    File::open(path)?.sync_all()?;
    Ok(())
}
