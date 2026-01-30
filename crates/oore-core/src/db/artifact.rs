//! Database operations for build artifacts.

use chrono::{DateTime, Utc};
use sqlx::Row;

use super::DbPool;
use crate::error::{OoreError, Result};
use crate::models::{BuildArtifact, BuildArtifactId, BuildId};

/// Build artifact repository.
pub struct BuildArtifactRepo;

impl BuildArtifactRepo {
    /// Creates a new build artifact.
    pub async fn create(pool: &DbPool, artifact: &BuildArtifact) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO build_artifacts (
                id, build_id, name, relative_path, storage_path,
                size_bytes, content_type, checksum_sha256, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(artifact.id.to_string())
        .bind(artifact.build_id.to_string())
        .bind(&artifact.name)
        .bind(&artifact.relative_path)
        .bind(&artifact.storage_path)
        .bind(artifact.size_bytes)
        .bind(&artifact.content_type)
        .bind(&artifact.checksum_sha256)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets an artifact by ID.
    pub async fn get_by_id(pool: &DbPool, id: &str) -> Result<Option<BuildArtifact>> {
        let row = sqlx::query(
            r#"
            SELECT id, build_id, name, relative_path, storage_path,
                   size_bytes, content_type, checksum_sha256, created_at
            FROM build_artifacts
            WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_artifact(&r)).transpose()
    }

    /// Lists all artifacts for a build.
    pub async fn list_for_build(pool: &DbPool, build_id: &BuildId) -> Result<Vec<BuildArtifact>> {
        let rows = sqlx::query(
            r#"
            SELECT id, build_id, name, relative_path, storage_path,
                   size_bytes, content_type, checksum_sha256, created_at
            FROM build_artifacts
            WHERE build_id = ?
            ORDER BY relative_path ASC
            "#,
        )
        .bind(build_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_artifact).collect()
    }

    /// Counts artifacts for a build.
    pub async fn count_for_build(pool: &DbPool, build_id: &BuildId) -> Result<i64> {
        let row = sqlx::query("SELECT COUNT(*) as count FROM build_artifacts WHERE build_id = ?")
            .bind(build_id.to_string())
            .fetch_one(pool)
            .await?;

        Ok(row.get("count"))
    }

    /// Gets total size of artifacts for a build.
    pub async fn total_size_for_build(pool: &DbPool, build_id: &BuildId) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COALESCE(SUM(size_bytes), 0) as total FROM build_artifacts WHERE build_id = ?",
        )
        .bind(build_id.to_string())
        .fetch_one(pool)
        .await?;

        Ok(row.get("total"))
    }

    /// Deletes all artifacts for a build.
    /// Returns the storage paths for file cleanup.
    pub async fn delete_for_build(pool: &DbPool, build_id: &BuildId) -> Result<Vec<String>> {
        // First get the storage paths
        let rows = sqlx::query("SELECT storage_path FROM build_artifacts WHERE build_id = ?")
            .bind(build_id.to_string())
            .fetch_all(pool)
            .await?;

        let paths: Vec<String> = rows.iter().map(|r| r.get("storage_path")).collect();

        // Then delete the records
        sqlx::query("DELETE FROM build_artifacts WHERE build_id = ?")
            .bind(build_id.to_string())
            .execute(pool)
            .await?;

        Ok(paths)
    }

    /// Deletes artifacts older than the given date.
    /// Returns the storage paths for file cleanup.
    pub async fn delete_older_than(pool: &DbPool, cutoff: &DateTime<Utc>) -> Result<Vec<String>> {
        let cutoff_str = cutoff.to_rfc3339();

        // First get the storage paths
        let rows = sqlx::query("SELECT storage_path FROM build_artifacts WHERE created_at < ?")
            .bind(&cutoff_str)
            .fetch_all(pool)
            .await?;

        let paths: Vec<String> = rows.iter().map(|r| r.get("storage_path")).collect();

        // Then delete the records
        sqlx::query("DELETE FROM build_artifacts WHERE created_at < ?")
            .bind(&cutoff_str)
            .execute(pool)
            .await?;

        Ok(paths)
    }

    /// Gets storage statistics for all artifacts.
    pub async fn get_storage_stats(pool: &DbPool) -> Result<ArtifactStorageStats> {
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) as total_count,
                COALESCE(SUM(size_bytes), 0) as total_size,
                COUNT(DISTINCT build_id) as builds_with_artifacts
            FROM build_artifacts
            "#,
        )
        .fetch_one(pool)
        .await?;

        Ok(ArtifactStorageStats {
            total_count: row.get("total_count"),
            total_size_bytes: row.get("total_size"),
            builds_with_artifacts: row.get("builds_with_artifacts"),
        })
    }

    fn row_to_artifact(row: &sqlx::sqlite::SqliteRow) -> Result<BuildArtifact> {
        let id_str: String = row.get("id");
        let build_id_str: String = row.get("build_id");
        let created_at_str: String = row.get("created_at");

        Ok(BuildArtifact {
            id: BuildArtifactId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            build_id: BuildId::from_string(&build_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            relative_path: row.get("relative_path"),
            storage_path: row.get("storage_path"),
            size_bytes: row.get("size_bytes"),
            content_type: row.get("content_type"),
            checksum_sha256: row.get("checksum_sha256"),
            created_at: parse_datetime(&created_at_str)?,
        })
    }
}

/// Storage statistics for artifacts.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ArtifactStorageStats {
    pub total_count: i64,
    pub total_size_bytes: i64,
    pub builds_with_artifacts: i64,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_datetime(s: &str) -> Result<DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| {
            OoreError::Database(sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                e.to_string(),
            ))))
        })
}
