//! Git provider types.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

use crate::error::OoreError;

/// Supported Git providers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../types/")]
pub enum GitProvider {
    GitHub,
    GitLab,
}

impl GitProvider {
    /// Returns the provider as a lowercase string.
    pub fn as_str(&self) -> &'static str {
        match self {
            GitProvider::GitHub => "github",
            GitProvider::GitLab => "gitlab",
        }
    }
}

impl fmt::Display for GitProvider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for GitProvider {
    type Err = OoreError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "github" => Ok(GitProvider::GitHub),
            "gitlab" => Ok(GitProvider::GitLab),
            _ => Err(OoreError::InvalidProvider(s.to_string())),
        }
    }
}

impl From<GitProvider> for String {
    fn from(provider: GitProvider) -> Self {
        provider.as_str().to_string()
    }
}
