use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead as _, IsTerminal, Read, Write};
#[cfg(unix)]
use std::os::unix::fs::{MetadataExt as _, OpenOptionsExt as _, PermissionsExt as _};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow, bail};
use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::Utc;
use clap::{Parser, Subcommand};
use oore_catalog::{DetachedSignature, SigningRequest, VerifierKey};
use ring::rand::SystemRandom;
use ring::signature::{Ed25519KeyPair, KeyPair as _};

const MAX_REQUEST_BYTES: u64 = 16 * 1024 * 1024;
const MAX_PRIVATE_KEY_BYTES: u64 = 4 * 1024;
const MAX_APPROVAL_BYTES: u64 = 256;

#[derive(Debug, Parser)]
#[command(name = "oore-catalog-local-signer")]
#[command(about = "Create and use offline Oore catalog signing keys")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Create one Ed25519 key pair without replacing existing files.
    Generate {
        /// New PKCS#8 private-key file.
        #[arg(long)]
        private_key: PathBuf,
        /// New canonical public-key JSON file.
        #[arg(long)]
        public_key: PathBuf,
    },
    /// Review and sign one short-lived catalog request.
    Sign {
        /// Canonical signing request.
        #[arg(long)]
        request: PathBuf,
        /// PKCS#8 private-key file.
        #[arg(long)]
        private_key: PathBuf,
        /// New detached signature response.
        #[arg(long)]
        output: PathBuf,
    },
}

fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Generate {
            private_key,
            public_key,
        } => generate(&private_key, &public_key),
        Command::Sign {
            request,
            private_key,
            output,
        } => sign(&request, &private_key, &output),
    }
}

fn generate(private_key_path: &Path, public_key_path: &Path) -> Result<()> {
    ensure_absent(private_key_path)?;
    ensure_absent(public_key_path)?;

    let document = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new())
        .map_err(|_| anyhow!("cannot generate the Ed25519 private key"))?;
    let key_pair = Ed25519KeyPair::from_pkcs8(document.as_ref())
        .map_err(|_| anyhow!("generated private key is invalid"))?;
    let public_document = public_key_document(key_pair.public_key().as_ref())?;
    let verifier = VerifierKey::from_bytes(&public_document)?;

    write_new_file(private_key_path, document.as_ref(), 0o600)?;
    write_new_file(public_key_path, &public_document, 0o644)?;

    println!("Created catalog signer {}.", verifier.key_id());
    println!("Private key: {}", private_key_path.display());
    println!("Public key: {}", public_key_path.display());
    println!(
        "The private-key file is not password-encrypted. Keep it on an encrypted offline volume."
    );
    Ok(())
}

fn sign(request_path: &Path, private_key_path: &Path, output_path: &Path) -> Result<()> {
    ensure_absent(output_path)?;
    let request = SigningRequest::from_bytes(&read_regular(request_path, MAX_REQUEST_BYTES)?)?;
    let private_key = read_private_key(private_key_path)?;
    let key_pair = Ed25519KeyPair::from_pkcs8(&private_key)
        .map_err(|_| anyhow!("the local private key is not valid PKCS#8 Ed25519 data"))?;
    let public_document = public_key_document(key_pair.public_key().as_ref())?;
    let verifier = VerifierKey::from_bytes(&public_document)?;

    show_request(&request, &verifier);
    approve_request(request.payload_sha256())?;

    let signature = key_pair.sign(&request.payload()?);
    let response =
        DetachedSignature::record_external(&request, &verifier, signature.as_ref(), Utc::now())?;
    write_new_file(output_path, &response.to_bytes()?, 0o600)?;
    println!("Created detached signature: {}", output_path.display());
    Ok(())
}

fn show_request(request: &SigningRequest, verifier: &VerifierKey) {
    let release = request.release();
    println!("Signer key: {}", verifier.key_id());
    println!("Role: {}", request.role().as_str());
    println!("Repository: {}", release.repository());
    println!("Commit: {}", release.commit());
    println!("Tag: {}", release.tag());
    println!("Catalog revision: {}", release.catalog_revision());
    println!("Payload SHA-256: {}", request.payload_sha256());
}

fn approve_request(expected_digest: &str) -> Result<()> {
    if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
        bail!("local catalog signing requires an interactive terminal");
    }
    print!("Type the full payload SHA-256 to approve this signature: ");
    io::stdout()
        .flush()
        .context("cannot show the approval prompt")?;
    let mut approval = String::new();
    io::stdin()
        .lock()
        .read_line(&mut approval)
        .context("cannot read the signing approval")?;
    if approval.len() as u64 > MAX_APPROVAL_BYTES {
        bail!("the signing approval is too long");
    }
    if approval.trim() != expected_digest {
        bail!("the typed payload SHA-256 does not match the request");
    }
    Ok(())
}

fn public_key_document(public_key: &[u8]) -> Result<Vec<u8>> {
    if public_key.len() != 32 {
        bail!("the Ed25519 public key is not 32 bytes");
    }
    let mut document = BTreeMap::new();
    document.insert("key_type", "ed25519".to_owned());
    document.insert("public", URL_SAFE_NO_PAD.encode(public_key));
    document.insert("scheme", "ed25519".to_owned());
    serde_json::to_vec(&document).context("cannot encode the public-key document")
}

fn read_private_key(path: &Path) -> Result<Vec<u8>> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    options.custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC);
    let file = options
        .open(path)
        .with_context(|| format!("cannot open private key {}", path.display()))?;
    let metadata = file
        .metadata()
        .with_context(|| format!("cannot inspect private key {}", path.display()))?;
    if !metadata.file_type().is_file()
        || metadata.len() == 0
        || metadata.len() > MAX_PRIVATE_KEY_BYTES
    {
        bail!("the private key is not a bounded regular file");
    }
    #[cfg(unix)]
    if metadata.mode() & 0o077 != 0 || metadata.nlink() != 1 {
        bail!("the private key must have mode 0600 and exactly one filesystem link");
    }
    read_open_file(file, metadata.len(), MAX_PRIVATE_KEY_BYTES, "private key")
}

fn read_regular(path: &Path, limit: u64) -> Result<Vec<u8>> {
    let file = File::open(path).with_context(|| format!("cannot open {}", path.display()))?;
    let metadata = file
        .metadata()
        .with_context(|| format!("cannot inspect {}", path.display()))?;
    if !metadata.file_type().is_file() || metadata.len() > limit {
        bail!("{} is not a bounded regular file", path.display());
    }
    read_open_file(file, metadata.len(), limit, "input")
}

fn read_open_file(mut file: File, length: u64, limit: u64, label: &str) -> Result<Vec<u8>> {
    let capacity = usize::try_from(length).context("input length does not fit memory")?;
    let mut bytes = Vec::with_capacity(capacity);
    Read::by_ref(&mut file)
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .with_context(|| format!("cannot read {label}"))?;
    if bytes.len() as u64 > limit {
        bail!("{label} grew beyond its limit");
    }
    Ok(bytes)
}

fn ensure_absent(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(_) => bail!("{} already exists", path.display()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).with_context(|| format!("cannot inspect {}", path.display())),
    }
}

fn write_new_file(path: &Path, bytes: &[u8], mode: u32) -> Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).with_context(|| format!("cannot create {}", parent.display()))?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(mode);
    let mut file = options
        .open(path)
        .with_context(|| format!("cannot create {}", path.display()))?;
    file.write_all(bytes)
        .with_context(|| format!("cannot write {}", path.display()))?;
    file.sync_all()
        .with_context(|| format!("cannot sync {}", path.display()))?;
    #[cfg(unix)]
    file.set_permissions(fs::Permissions::from_mode(mode))
        .with_context(|| format!("cannot protect {}", path.display()))?;
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .with_context(|| format!("cannot sync {}", parent.display()))
}
