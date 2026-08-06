use std::fs::{self, File};
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt as _;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use chrono::Utc;
use clap::{Parser, Subcommand, ValueEnum};
use oore_catalog::{
    DetachedSignature, ReleaseBinding, SigningRequest, SigningRole, VerifierKey, assemble_envelope,
};

const MAX_INPUT_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Parser)]
#[command(name = "oore-catalog-author")]
#[command(about = "Prepare and assemble detached Oore catalog signatures")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Prepare canonical metadata for an external signer.
    Prepare {
        /// Metadata role to sign.
        #[arg(long, value_enum)]
        role: RoleArgument,
        /// Unsigned role JSON file.
        #[arg(long)]
        input: PathBuf,
        /// Canonical signing request output.
        #[arg(long)]
        output: PathBuf,
        /// Exact source repository.
        #[arg(long)]
        repository: String,
        /// Full lowercase source commit SHA.
        #[arg(long)]
        commit: String,
        /// Exact source or release tag.
        #[arg(long)]
        tag: String,
        /// Exact catalog revision.
        #[arg(long)]
        catalog_revision: u64,
    },
    /// Verify detached responses and assemble one metadata envelope.
    Assemble {
        /// Canonical signing request.
        #[arg(long)]
        request: PathBuf,
        /// Detached response file. Repeat once per signer.
        #[arg(long, required = true)]
        signature: Vec<PathBuf>,
        /// Matching public-key file. Repeat in signature order.
        #[arg(long, required = true)]
        key: Vec<PathBuf>,
        /// Canonical signed metadata output.
        #[arg(long)]
        output: PathBuf,
    },
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum RoleArgument {
    Root,
    Targets,
    Snapshot,
    Timestamp,
}

impl From<RoleArgument> for SigningRole {
    fn from(value: RoleArgument) -> Self {
        match value {
            RoleArgument::Root => Self::Root,
            RoleArgument::Targets => Self::Targets,
            RoleArgument::Snapshot => Self::Snapshot,
            RoleArgument::Timestamp => Self::Timestamp,
        }
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Prepare {
            role,
            input,
            output,
            repository,
            commit,
            tag,
            catalog_revision,
        } => {
            let signed = read_bounded(&input)?;
            let release = ReleaseBinding::new(&repository, &commit, &tag, catalog_revision)?;
            let request = SigningRequest::prepare(role.into(), &signed, release, Utc::now())?;
            write_atomic(&output, &request.to_bytes()?)?;
        }
        Command::Assemble {
            request,
            signature,
            key,
            output,
        } => {
            if signature.len() != key.len() {
                bail!("each --signature needs one matching --key");
            }
            let request = SigningRequest::from_bytes(&read_bounded(&request)?)?;
            let mut accepted = Vec::with_capacity(signature.len());
            for (signature_path, key_path) in signature.iter().zip(&key) {
                let response = DetachedSignature::from_bytes(&read_bounded(signature_path)?)?;
                let verifier = VerifierKey::from_bytes(&read_bounded(key_path)?)?;
                accepted.push(response.accept(&request, &verifier, Utc::now())?);
            }
            let envelope = assemble_envelope(&request, &accepted, Utc::now())?;
            write_atomic(&output, &envelope)?;
        }
    }
    Ok(())
}

fn read_bounded(path: &Path) -> Result<Vec<u8>> {
    let file = File::open(path).with_context(|| format!("cannot open {}", path.display()))?;
    let metadata = file
        .metadata()
        .with_context(|| format!("cannot inspect {}", path.display()))?;
    if !metadata.is_file() || metadata.len() > MAX_INPUT_BYTES {
        bail!("{} is not a bounded regular file", path.display());
    }
    let capacity = usize::try_from(metadata.len()).context("input length does not fit memory")?;
    let mut bytes = Vec::with_capacity(capacity);
    file.take(MAX_INPUT_BYTES + 1)
        .read_to_end(&mut bytes)
        .with_context(|| format!("cannot read {}", path.display()))?;
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        bail!("{} grew beyond the input limit", path.display());
    }
    Ok(bytes)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).with_context(|| format!("cannot create {}", parent.display()))?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .with_context(|| format!("cannot stage output in {}", parent.display()))?;
    #[cfg(unix)]
    temporary
        .as_file()
        .set_permissions(fs::Permissions::from_mode(0o600))
        .context("cannot protect staged output")?;
    temporary
        .write_all(bytes)
        .context("cannot write staged output")?;
    temporary
        .as_file()
        .sync_all()
        .context("cannot sync staged output")?;
    temporary
        .persist(path)
        .map_err(|error| error.error)
        .with_context(|| format!("cannot publish {}", path.display()))?;
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .with_context(|| format!("cannot sync {}", parent.display()))?;
    Ok(())
}
