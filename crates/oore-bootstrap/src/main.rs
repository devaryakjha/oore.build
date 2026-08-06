use std::env;
use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::{self, IsTerminal, Read as _, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitCode};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Utc;
use oore_catalog::{CatalogState, CatalogUpdate, CatalogVerifier, VerifiedMetadataChain};
use oore_component_store::{install_archive, load_active};
use oore_install::{InstallPlan, InstallReceipt, MachineRole, ReleaseChannel};

const PLAN_FILE: &str = "install-plan.json";
const RECEIPT_FILE: &str = "install-receipt.json";
const CATALOG_STATE_FILE: &str = "catalog-state.json";

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("Error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let mut arguments = env::args_os();
    let _program = arguments.next();
    let remaining = arguments.collect::<Vec<_>>();
    let Some(command) = remaining.first().and_then(|value| value.to_str()) else {
        print_help();
        return Ok(ExitCode::SUCCESS);
    };

    match command {
        "version" | "--version" | "-V" => {
            println!("{}", installed_version()?);
            Ok(ExitCode::SUCCESS)
        }
        "help" | "--help" | "-h" => {
            print_help();
            Ok(ExitCode::SUCCESS)
        }
        "install" => install(&remaining[1..]),
        "apple" => forward_to_component("oore-apple-sign", &remaining[1..]),
        _ => forward_to_core(&remaining),
    }
}

fn print_help() {
    println!(
        "Oore control shell\n\nUsage: oore <COMMAND>\n\nCommands:\n  install  Select how this machine runs Oore\n  apple    Load the Apple component\n  version  Print the Oore version\n  help     Print this help\n\nOther commands load the Oore core component when it is available."
    );
}

fn install(arguments: &[OsString]) -> Result<ExitCode, Box<dyn std::error::Error>> {
    if arguments
        .iter()
        .any(|value| matches!(value.to_str(), Some("--help" | "-h")))
    {
        println!(
            "Usage: oore install [--role <ROLE>] [--component <ID>] [--json]\n\nRoles: local-oore, runner, shell-only, advanced"
        );
        return Ok(ExitCode::SUCCESS);
    }
    let options = InstallOptions::parse(arguments)?;
    let role = match options.role {
        Some(role) => role,
        None if io::stdin().is_terminal() => select_role()?,
        None => return Err("--role is required when input is not interactive".into()),
    };
    let mut components = options.components.clone();
    if role == MachineRole::Advanced && components.is_empty() && io::stdin().is_terminal() {
        components = select_components()?;
    }
    if role == MachineRole::Advanced && components.is_empty() {
        return Err("use --component at least once with --role advanced".into());
    }

    let root = install_root()?;
    let source =
        installed_value(&root, "INSTALL_SOURCE", "OORE_INSTALL_SOURCE", "archive")?.parse()?;
    let scope = installed_value(&root, "INSTALL_SCOPE", "OORE_INSTALL_SCOPE", "user")?.parse()?;
    let channel = installed_channel()?;
    let plan = InstallPlan::new(
        source,
        channel,
        installed_version()?,
        scope,
        role,
        components,
    )?;
    let plan_path = root.join(PLAN_FILE);
    write_atomic(&plan_path, &plan.to_json()?)?;
    remove_file_if_present(&root.join(RECEIPT_FILE))?;

    let mut installed = prebundled_components(&plan)?;
    for component in &mut installed {
        if component.path.is_none() {
            component.path = Some(install_catalog_component(&component.id)?);
        }
    }

    if options.json {
        io::stdout().write_all(&plan.to_json()?)?;
        println!();
    } else {
        println!("Saved the {} machine plan.", plan.machine_role());
        if plan.components().is_empty() {
            println!("This machine will keep only the Oore control shell.");
        } else {
            println!("Required components: {}", plan.components().join(", "));
        }
        println!("Plan: {}", plan_path.display());
    }

    let mut owned_paths = vec![env::current_exe()?.to_string_lossy().into_owned()];
    owned_paths.extend(
        installed
            .into_iter()
            .filter_map(|component| component.path)
            .map(|path| path.to_string_lossy().into_owned()),
    );
    owned_paths.sort();
    owned_paths.dedup();
    let receipt = InstallReceipt::from_plan(&plan, owned_paths)?;
    let receipt_path = root.join(RECEIPT_FILE);
    write_atomic(&receipt_path, &receipt.to_json()?)?;
    if !options.json {
        println!("Install receipt: {}", receipt_path.display());
    }

    Ok(ExitCode::SUCCESS)
}

struct ComponentLocation {
    id: String,
    path: Option<PathBuf>,
}

fn prebundled_components(
    plan: &InstallPlan,
) -> Result<Vec<ComponentLocation>, Box<dyn std::error::Error>> {
    let binary_dir = env::current_exe()?
        .parent()
        .ok_or("the Oore executable has no parent directory")?
        .to_path_buf();
    let managed_root = install_root()?.join("libexec/components");
    let components = plan
        .components()
        .iter()
        .map(|component| {
            let transition_binary = match component.as_str() {
                "oore-runner" => binary_dir.join("oore-core"),
                value => binary_dir.join(value),
            };
            let prebundled = fs::symlink_metadata(&transition_binary)
                .ok()
                .filter(|metadata| metadata.file_type().is_file())
                .map(|_| transition_binary);
            let component_root = managed_root.join(component);
            let managed_binary = component_root.join("current").join(component);
            let managed = managed_component_path(component).or_else(|| {
                fs::canonicalize(&managed_binary).ok().and_then(|binary| {
                    let root = fs::canonicalize(&component_root).ok()?;
                    (binary.starts_with(root) && binary.is_file()).then_some(binary)
                })
            });
            ComponentLocation {
                id: component.clone(),
                path: prebundled.or(managed),
            }
        })
        .collect();
    Ok(components)
}

fn install_catalog_component(component_id: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let (chain, state) = verified_catalog()?;
    let (os, arch) = current_target()?;
    let component = chain
        .component_for_host(component_id, os, arch)?
        .ok_or_else(|| {
            format!("the signed catalog has no active {component_id} for {os}/{arch}")
        })?;
    verify_minimum_os(component.minimum_os_version())?;

    let root = install_root()?;
    let downloads = root.join("downloads");
    fs::create_dir_all(&downloads)?;
    let mut archive = tempfile::NamedTempFile::new_in(&downloads)?;
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(120))
        .user_agent(concat!("oore/", env!("CARGO_PKG_VERSION")))
        .build()?;
    let mut response = client.get(component_download_url(&component)?).send()?;
    if !response.status().is_success() {
        return Err(format!("component download failed with HTTP {}", response.status()).into());
    }
    if let Some(length) = response.content_length()
        && length != component.archive_length()
    {
        return Err("component download length differs from the signed catalog".into());
    }
    let copied = io::copy(
        &mut response.by_ref().take(component.archive_length() + 1),
        archive.as_file_mut(),
    )?;
    if copied != component.archive_length() {
        return Err("component download did not match the signed length".into());
    }
    archive.as_file().sync_all()?;
    let installed = install_archive(&component, archive.path(), &root.join("components"))?;
    write_atomic(&root.join(CATALOG_STATE_FILE), &state.to_bytes()?)?;
    Ok(installed.entrypoint().to_path_buf())
}

fn component_download_url(
    component: &oore_catalog::VerifiedComponent,
) -> Result<String, Box<dyn std::error::Error>> {
    if let Ok(url) = env::var("OORE_COMPONENT_URL") {
        return validate_transport_url(url);
    }
    let root = install_root()?;
    let direct_paths = [
        root.join("COMPONENT_URL"),
        package_metadata_path("COMPONENT_URL")?,
    ];
    if let Some(url) = read_first_metadata(&direct_paths)? {
        return validate_transport_url(url.trim().to_owned());
    }
    let base = installed_value(
        &root,
        "COMPONENT_BASE_URL",
        "OORE_COMPONENT_BASE_URL",
        "https://components.oore.build/",
    )?;
    if !base.starts_with("https://") || !base.ends_with('/') {
        return Err("the component base URL must use HTTPS and end with /".into());
    }
    Ok(format!("{base}{}", component.archive_path()))
}

fn validate_transport_url(url: String) -> Result<String, Box<dyn std::error::Error>> {
    let parsed = reqwest::Url::parse(&url)?;
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.host_str().is_none()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("the component transport URL is not a plain HTTPS URL".into());
    }
    Ok(url)
}

fn verified_catalog() -> Result<(VerifiedMetadataChain, CatalogState), Box<dyn std::error::Error>> {
    let directory = catalog_directory()?;
    let root = read_catalog_file(&directory.join("root.json"), 1024 * 1024)?;
    let targets = read_catalog_file(&directory.join("targets.json"), 8 * 1024 * 1024)?;
    let snapshot = read_catalog_file(&directory.join("snapshot.json"), 2 * 1024 * 1024)?;
    let timestamp = read_catalog_file(&directory.join("timestamp.json"), 256 * 1024)?;
    let now = Utc::now();
    let verifier = CatalogVerifier::from_pinned_root(&root, now)?;
    let state_path = install_root()?.join(CATALOG_STATE_FILE);
    let mut state = match fs::read(&state_path) {
        Ok(bytes) => CatalogState::from_bytes(&bytes)?,
        Err(error) if error.kind() == io::ErrorKind::NotFound => verifier.initial_state(),
        Err(error) => return Err(error.into()),
    };
    let chain = verifier.verify_update(
        &mut state,
        CatalogUpdate {
            root_rotations: &[],
            targets: &targets,
            snapshot: &snapshot,
            timestamp: &timestamp,
        },
        now,
    )?;
    Ok((chain, state))
}

fn catalog_directory() -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Some(path) = env::var_os("OORE_CATALOG_DIR") {
        return Ok(PathBuf::from(path));
    }
    let executable = env::current_exe()?;
    let prefix = executable
        .parent()
        .and_then(Path::parent)
        .ok_or("the Oore executable has no package prefix")?;
    Ok(prefix.join("share/oore/catalog"))
}

fn read_catalog_file(path: &Path, limit: u64) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_file() || metadata.len() > limit {
        return Err(format!("{} is not a bounded catalog file", path.display()).into());
    }
    Ok(fs::read(path)?)
}

fn current_target() -> Result<(&'static str, &'static str), Box<dyn std::error::Error>> {
    let os = match env::consts::OS {
        "macos" => "macos",
        "linux" => "linux",
        _ => return Err("this operating system cannot run Oore components".into()),
    };
    let arch = match env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x86_64",
        _ => return Err("this processor cannot run Oore components".into()),
    };
    Ok((os, arch))
}

fn verify_minimum_os(minimum: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let Some(minimum) = minimum else {
        return Ok(());
    };
    if env::consts::OS != "macos" {
        return Ok(());
    }
    let output = Command::new("/usr/bin/sw_vers")
        .arg("-productVersion")
        .output()?;
    if !output.status.success() {
        return Err("cannot read the macOS version".into());
    }
    let actual = String::from_utf8(output.stdout)?;
    if parse_os_version(actual.trim())? < parse_os_version(minimum)? {
        return Err(format!("this component needs macOS {minimum} or newer").into());
    }
    Ok(())
}

fn parse_os_version(value: &str) -> Result<semver::Version, Box<dyn std::error::Error>> {
    let dots = value.bytes().filter(|byte| *byte == b'.').count();
    let normalized = match dots {
        0 => format!("{value}.0.0"),
        1 => format!("{value}.0"),
        _ => value.to_owned(),
    };
    Ok(semver::Version::parse(&normalized)?)
}

fn managed_component_path(component_id: &str) -> Option<PathBuf> {
    let root = install_root().ok()?.join("components");
    let digest = fs::read_to_string(root.join("active").join(component_id)).ok()?;
    let digest = digest.trim();
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let object = root.join("objects/sha256").join(digest);
    let entrypoint = match component_id {
        "oore-apple-sign" => object.join("bin/oore-apple-sign"),
        _ => return None,
    };
    let canonical = fs::canonicalize(&entrypoint).ok()?;
    let canonical_root = fs::canonicalize(&object).ok()?;
    (canonical.starts_with(canonical_root) && canonical.is_file()).then_some(canonical)
}

fn verified_component_path(component_id: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let (chain, state) = verified_catalog()?;
    let (os, arch) = current_target()?;
    let component = chain
        .component_for_host(component_id, os, arch)?
        .ok_or_else(|| {
            format!("the signed catalog has no active {component_id} for {os}/{arch}")
        })?;
    verify_minimum_os(component.minimum_os_version())?;
    let root = install_root()?;
    let installed = load_active(&component, &root.join("components"))?;
    write_atomic(&root.join(CATALOG_STATE_FILE), &state.to_bytes()?)?;
    Ok(installed.entrypoint().to_path_buf())
}

struct InstallOptions {
    role: Option<MachineRole>,
    components: Vec<String>,
    json: bool,
}

impl InstallOptions {
    fn parse(arguments: &[OsString]) -> Result<Self, Box<dyn std::error::Error>> {
        let mut role = None;
        let mut components = Vec::new();
        let mut json = false;
        let mut index = 0;
        while index < arguments.len() {
            let value = arguments[index]
                .to_str()
                .ok_or("install arguments must use UTF-8")?;
            match value {
                "--role" => {
                    index += 1;
                    let value = arguments
                        .get(index)
                        .and_then(|value| value.to_str())
                        .ok_or("--role needs a value")?;
                    role = Some(MachineRole::from_str(value)?);
                }
                "--component" => {
                    index += 1;
                    let value = arguments
                        .get(index)
                        .and_then(|value| value.to_str())
                        .ok_or("--component needs a value")?;
                    components.push(value.to_owned());
                }
                "--json" => json = true,
                _ => return Err(format!("unknown install option: {value}").into()),
            }
            index += 1;
        }
        Ok(Self {
            role,
            components,
            json,
        })
    }
}

fn select_role() -> Result<MachineRole, Box<dyn std::error::Error>> {
    println!("How will this machine run Oore?");
    println!("  1) Local Oore with a runner (recommended)");
    println!("  2) Runner only");
    println!("  3) Control shell only");
    println!("  4) Choose components");
    print!("Select an option [1]: ");
    io::stdout().flush()?;

    let mut answer = String::new();
    io::stdin().read_line(&mut answer)?;
    match answer.trim() {
        "" | "1" => Ok(MachineRole::LocalOore),
        "2" => Ok(MachineRole::Runner),
        "3" => Ok(MachineRole::ShellOnly),
        "4" => Ok(MachineRole::Advanced),
        _ => Err("select 1, 2, 3, or 4".into()),
    }
}

fn select_components() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    print!("Enter component IDs, separated by commas: ");
    io::stdout().flush()?;
    let mut answer = String::new();
    io::stdin().read_line(&mut answer)?;
    let components = answer
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if components.is_empty() {
        return Err("enter at least one component ID".into());
    }
    Ok(components)
}

fn env_value(name: &str, default: &str) -> Result<String, Box<dyn std::error::Error>> {
    match env::var(name) {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        Ok(_) => Err(format!("{name} cannot be empty").into()),
        Err(env::VarError::NotPresent) => Ok(default.to_owned()),
        Err(error) => Err(error.into()),
    }
}

fn installed_value(
    root: &Path,
    file: &str,
    environment: &str,
    default: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let paths = [root.join(file), package_metadata_path(file)?];
    if let Some(value) = read_first_metadata(&paths)? {
        let value = value.trim();
        if value.is_empty() {
            return Err(format!("the installed {file} file is empty").into());
        }
        return Ok(value.to_owned());
    }
    env_value(environment, default)
}

fn read_first_metadata(paths: &[PathBuf]) -> Result<Option<String>, Box<dyn std::error::Error>> {
    for path in paths {
        match fs::read_to_string(path) {
            Ok(value) => return Ok(Some(value)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    Ok(None)
}

fn package_metadata_path(file: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let executable = env::current_exe()?;
    let prefix = executable
        .parent()
        .and_then(Path::parent)
        .ok_or("the Oore executable has no package prefix")?;
    Ok(prefix.join("share/oore").join(file))
}

fn installed_channel() -> Result<ReleaseChannel, Box<dyn std::error::Error>> {
    if let Ok(value) = env::var("OORE_RELEASE_CHANNEL") {
        return Ok(value.parse()?);
    }
    let root = install_root()?;
    let paths = [root.join("CHANNEL"), package_metadata_path("CHANNEL")?];
    if let Some(value) = read_first_metadata(&paths)? {
        return Ok(value.trim().parse()?);
    }
    let version = installed_version()?;
    if version.contains("-alpha.") {
        Ok(ReleaseChannel::Alpha)
    } else if version.contains("-beta.") {
        Ok(ReleaseChannel::Beta)
    } else {
        Ok(ReleaseChannel::Stable)
    }
}

fn installed_version() -> Result<String, Box<dyn std::error::Error>> {
    let root = install_root()?;
    let paths = [root.join("VERSION"), package_metadata_path("VERSION")?];
    match read_first_metadata(&paths)? {
        Some(value) if !value.trim().is_empty() => Ok(value.trim().to_owned()),
        Some(_) => Err("the installed VERSION file is empty".into()),
        None => Ok(env!("CARGO_PKG_VERSION").to_owned()),
    }
}

fn install_root() -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Some(root) = env::var_os("OORE_INSTALL_ROOT") {
        let root = PathBuf::from(root);
        validate_install_root(&root)?;
        return Ok(root);
    }
    let home = env::var_os("HOME").ok_or("HOME is not set")?;
    let root = PathBuf::from(home).join(".oore");
    validate_install_root(&root)?;
    Ok(root)
}

fn validate_install_root(root: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if !root.is_absolute()
        || root == Path::new("/")
        || root
            .components()
            .any(|component| !matches!(component, Component::RootDir | Component::Normal(_)))
    {
        return Err("OORE_INSTALL_ROOT must be a normalized, specific absolute path".into());
    }
    match fs::symlink_metadata(root) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err("OORE_INSTALL_ROOT cannot be a symbolic link".into())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn write_atomic(path: &Path, contents: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let parent = path
        .parent()
        .ok_or("the install plan has no parent directory")?;
    fs::create_dir_all(parent)?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("the install state filename is invalid")?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let temporary = parent.join(format!(".{file_name}.{}-{nonce}.tmp", std::process::id()));
    let mut options = OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary)?;
    let write_result = file
        .write_all(contents)
        .and_then(|()| file.write_all(b"\n"))
        .and_then(|()| file.sync_all());
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary);
        return Err(error.into());
    }
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(error.into());
    }
    fs::File::open(parent)?.sync_all()?;
    Ok(())
}

fn remove_file_if_present(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn forward_to_core(arguments: &[OsString]) -> Result<ExitCode, Box<dyn std::error::Error>> {
    let executable = core_executable()?;
    let status = Command::new(executable).args(arguments).status()?;
    Ok(ExitCode::from(
        status
            .code()
            .and_then(|code| u8::try_from(code).ok())
            .unwrap_or(1),
    ))
}

fn forward_to_component(
    component_id: &str,
    arguments: &[OsString],
) -> Result<ExitCode, Box<dyn std::error::Error>> {
    let executable = verified_component_path(component_id).map_err(|error| {
        format!(
            "{component_id} is not ready: {error}; run `oore install --role advanced --component {component_id}`"
        )
    })?;
    let status = Command::new(executable).args(arguments).status()?;
    Ok(ExitCode::from(
        status
            .code()
            .and_then(|code| u8::try_from(code).ok())
            .unwrap_or(1),
    ))
}

fn core_executable() -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Some(path) = env::var_os("OORE_CORE_PATH") {
        return Ok(PathBuf::from(path));
    }
    let current = env::current_exe()?;
    let sibling = current.with_file_name("oore-core");
    if sibling.is_file() {
        return Ok(sibling);
    }
    let managed = install_root()?.join("libexec/components/oore-core/current/oore-core");
    if managed.is_file() {
        return Ok(managed);
    }
    Err("this command needs the Oore core component; run `oore install` first".into())
}
