use std::env::VarError;

use sqlx::SqlitePool;
use tracing::info;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunnerMode {
    External,
}

impl RunnerMode {
    fn from_value(raw: Option<&str>) -> anyhow::Result<Self> {
        match raw.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
            None | Some("external") => Ok(Self::External),
            Some("embedded" | "hybrid") => anyhow::bail!(
                "embedded runner execution is disabled; use an external Direct macOS runner"
            ),
            Some(raw) => anyhow::bail!("invalid OORED_RUNNER_MODE: {raw:?}"),
        }
    }

    pub fn from_env() -> anyhow::Result<Self> {
        match std::env::var("OORED_RUNNER_MODE") {
            Ok(raw) => Self::from_value(Some(&raw)),
            Err(VarError::NotPresent) => Self::from_value(None),
            Err(error) => Err(error.into()),
        }
    }
}

pub async fn start_if_enabled(
    _pool: SqlitePool,
    _daemon_url: String,
) -> anyhow::Result<Option<tokio::task::JoinHandle<()>>> {
    RunnerMode::from_env()?;
    info!("embedded runner disabled; use an external Direct macOS runner");
    Ok(None)
}
