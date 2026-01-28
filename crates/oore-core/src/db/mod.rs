//! Database module for the Oore platform.

pub mod credentials;
pub mod pipeline;
pub mod repository;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::str::FromStr;

use crate::error::{OoreError, Result};

/// Database connection pool.
pub type DbPool = SqlitePool;

/// Default maximum database connections.
const DEFAULT_MAX_CONNECTIONS: u32 = 20;

/// Creates and initializes the database connection pool.
///
/// The pool size can be configured via `DATABASE_MAX_CONNECTIONS` environment variable.
/// Default is 20 connections, which should handle concurrent webhook processing,
/// API requests, and background tasks without exhaustion.
pub async fn create_pool(database_url: &str) -> Result<DbPool> {
    let max_connections = std::env::var("DATABASE_MAX_CONNECTIONS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_MAX_CONNECTIONS);

    let options = SqliteConnectOptions::from_str(database_url)
        .map_err(|e| OoreError::Configuration(format!("Invalid database URL: {}", e)))?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .busy_timeout(std::time::Duration::from_secs(30));

    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .connect_with(options)
        .await?;

    tracing::debug!("Database pool created with max_connections={}", max_connections);

    Ok(pool)
}

/// Runs database migrations.
pub async fn run_migrations(pool: &DbPool) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    tracing::info!("Database migrations completed");
    Ok(())
}
