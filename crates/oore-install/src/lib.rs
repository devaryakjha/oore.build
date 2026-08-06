//! Stable data types for the small Oore bootstrap.
//!
//! This crate does not install services or download components. Native packages
//! use it to record the small control layer that they own. The `oore` shell uses
//! the same receipt when it selects and installs optional components.

use std::collections::BTreeSet;
use std::error::Error;
use std::fmt;
use std::path::{Component, Path};
use std::str::FromStr;

use serde::{Deserialize, Serialize};

pub const INSTALL_RECEIPT_SCHEMA_VERSION: u32 = 1;

const MAX_VERSION_LENGTH: usize = 64;
const MAX_OWNED_PATHS: usize = 32;
const MAX_OWNED_PATH_LENGTH: usize = 1_024;

macro_rules! impl_string_enum {
    ($type:ty { $($variant:ident => $value:literal,)+ }) => {
        impl fmt::Display for $type {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                let value = match self {
                    $(Self::$variant => $value,)+
                };
                formatter.write_str(value)
            }
        }

        impl FromStr for $type {
            type Err = ParseValueError;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                match value {
                    $($value => Ok(Self::$variant),)+
                    _ => Err(ParseValueError::new(stringify!($type), value)),
                }
            }
        }
    };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallSource {
    MacosPkg,
    Homebrew,
    Apt,
    Rpm,
    Archive,
}

impl_string_enum!(InstallSource {
    MacosPkg => "macos-pkg",
    Homebrew => "homebrew",
    Apt => "apt",
    Rpm => "rpm",
    Archive => "archive",
});

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReleaseChannel {
    Stable,
    Beta,
    Alpha,
}

impl_string_enum!(ReleaseChannel {
    Stable => "stable",
    Beta => "beta",
    Alpha => "alpha",
});

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallScope {
    User,
    System,
}

impl_string_enum!(InstallScope {
    User => "user",
    System => "system",
});

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MachineRole {
    LocalOore,
    Runner,
    ShellOnly,
    Advanced,
}

impl_string_enum!(MachineRole {
    LocalOore => "local-oore",
    Runner => "runner",
    ShellOnly => "shell-only",
    Advanced => "advanced",
});

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseValueError {
    kind: &'static str,
    value: String,
}

impl ParseValueError {
    fn new(kind: &'static str, value: &str) -> Self {
        Self {
            kind,
            value: value.to_owned(),
        }
    }
}

impl fmt::Display for ParseValueError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "invalid {} value: {}", self.kind, self.value)
    }
}

impl Error for ParseValueError {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InstallReceipt {
    schema_version: u32,
    source: InstallSource,
    channel: ReleaseChannel,
    version: String,
    scope: InstallScope,
    machine_role: MachineRole,
    owned_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct UncheckedInstallReceipt {
    schema_version: u32,
    source: InstallSource,
    channel: ReleaseChannel,
    version: String,
    scope: InstallScope,
    machine_role: MachineRole,
    owned_paths: Vec<String>,
}

impl InstallReceipt {
    pub fn new(
        source: InstallSource,
        channel: ReleaseChannel,
        version: impl Into<String>,
        scope: InstallScope,
        machine_role: MachineRole,
        owned_paths: Vec<String>,
    ) -> Result<Self, InstallReceiptError> {
        let receipt = Self {
            schema_version: INSTALL_RECEIPT_SCHEMA_VERSION,
            source,
            channel,
            version: version.into(),
            scope,
            machine_role,
            owned_paths,
        };
        receipt.validate()?;
        Ok(receipt)
    }

    pub fn from_json(input: &[u8]) -> Result<Self, InstallReceiptError> {
        if input.len() > InstallReceiptError::MAX_JSON_BYTES {
            return Err(InstallReceiptError::JsonTooLarge);
        }

        let unchecked: UncheckedInstallReceipt =
            serde_json::from_slice(input).map_err(InstallReceiptError::InvalidJson)?;
        let receipt = Self {
            schema_version: unchecked.schema_version,
            source: unchecked.source,
            channel: unchecked.channel,
            version: unchecked.version,
            scope: unchecked.scope,
            machine_role: unchecked.machine_role,
            owned_paths: unchecked.owned_paths,
        };
        receipt.validate()?;
        Ok(receipt)
    }

    pub fn to_json(&self) -> Result<Vec<u8>, InstallReceiptError> {
        self.validate()?;
        serde_json::to_vec_pretty(self).map_err(InstallReceiptError::InvalidJson)
    }

    pub const fn source(&self) -> InstallSource {
        self.source
    }

    pub const fn channel(&self) -> ReleaseChannel {
        self.channel
    }

    pub fn version(&self) -> &str {
        &self.version
    }

    pub const fn scope(&self) -> InstallScope {
        self.scope
    }

    pub const fn machine_role(&self) -> MachineRole {
        self.machine_role
    }

    pub fn owned_paths(&self) -> &[String] {
        &self.owned_paths
    }

    fn validate(&self) -> Result<(), InstallReceiptError> {
        if self.schema_version != INSTALL_RECEIPT_SCHEMA_VERSION {
            return Err(InstallReceiptError::UnsupportedSchema(self.schema_version));
        }
        if self.version.is_empty()
            || self.version.len() > MAX_VERSION_LENGTH
            || !self
                .version
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'+'))
        {
            return Err(InstallReceiptError::InvalidVersion);
        }
        if self.owned_paths.is_empty() || self.owned_paths.len() > MAX_OWNED_PATHS {
            return Err(InstallReceiptError::InvalidOwnedPathCount);
        }

        let mut unique_paths = BTreeSet::new();
        for path in &self.owned_paths {
            validate_owned_path(path)?;
            if !unique_paths.insert(path) {
                return Err(InstallReceiptError::DuplicateOwnedPath(path.clone()));
            }
        }
        Ok(())
    }
}

fn validate_owned_path(path: &str) -> Result<(), InstallReceiptError> {
    if path.is_empty()
        || path == "/"
        || path.len() > MAX_OWNED_PATH_LENGTH
        || path.contains('\0')
        || path.contains("//")
        || path.ends_with('/')
    {
        return Err(InstallReceiptError::InvalidOwnedPath(path.to_owned()));
    }

    let parsed = Path::new(path);
    if !parsed.is_absolute()
        || parsed
            .components()
            .any(|component| !matches!(component, Component::RootDir | Component::Normal(_)))
    {
        return Err(InstallReceiptError::InvalidOwnedPath(path.to_owned()));
    }
    Ok(())
}

#[derive(Debug)]
pub enum InstallReceiptError {
    JsonTooLarge,
    InvalidJson(serde_json::Error),
    UnsupportedSchema(u32),
    InvalidVersion,
    InvalidOwnedPathCount,
    InvalidOwnedPath(String),
    DuplicateOwnedPath(String),
}

impl InstallReceiptError {
    pub const MAX_JSON_BYTES: usize = 64 * 1024;
}

impl fmt::Display for InstallReceiptError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::JsonTooLarge => formatter.write_str("the install receipt is too large"),
            Self::InvalidJson(error) => write!(formatter, "invalid install receipt JSON: {error}"),
            Self::UnsupportedSchema(version) => {
                write!(formatter, "unsupported install receipt schema: {version}")
            }
            Self::InvalidVersion => formatter.write_str("the installed version is invalid"),
            Self::InvalidOwnedPathCount => {
                formatter.write_str("the install receipt has an invalid owned-path count")
            }
            Self::InvalidOwnedPath(path) => write!(formatter, "invalid owned path: {path}"),
            Self::DuplicateOwnedPath(path) => write!(formatter, "duplicate owned path: {path}"),
        }
    }
}

impl Error for InstallReceiptError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::InvalidJson(error) => Some(error),
            _ => None,
        }
    }
}
