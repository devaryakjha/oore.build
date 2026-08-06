use std::env;
use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::{self, IsTerminal, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitCode};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

use oore_install::{InstallPlan, InstallReceipt, MachineRole, ReleaseChannel};

const PLAN_FILE: &str = "install-plan.json";
const RECEIPT_FILE: &str = "install-receipt.json";

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
        _ => forward_to_core(&remaining),
    }
}

fn print_help() {
    println!(
        "Oore control shell\n\nUsage: oore <COMMAND>\n\nCommands:\n  install  Select how this machine runs Oore\n  version  Print the Oore version\n  help     Print this help\n\nOther commands load the Oore core component when it is available."
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

    let installed = prebundled_components(&plan)?;
    let missing = installed
        .iter()
        .filter_map(|component| component.path.is_none().then_some(component.id.as_str()))
        .collect::<Vec<_>>();

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

    if !missing.is_empty() {
        return Err(format!(
            "the signed package does not contain these required components: {}; the plan is saved and `oore install` can resume later",
            missing.join(", ")
        )
        .into());
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
            let managed = fs::canonicalize(&managed_binary).ok().and_then(|binary| {
                let root = fs::canonicalize(&component_root).ok()?;
                (binary.starts_with(root) && binary.is_file()).then_some(binary)
            });
            ComponentLocation {
                id: component.clone(),
                path: prebundled.or(managed),
            }
        })
        .collect();
    Ok(components)
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
