//! Database operations for pipeline configs, build steps, and build logs.

use chrono::Utc;
use sqlx::Row;

use super::DbPool;
use crate::error::{OoreError, Result};
use crate::models::{
    BuildId, BuildLog, BuildLogId, BuildStep, BuildStepId, PipelineConfig,
    PipelineConfigId, RepositoryId, StepStatus,
};

/// Pipeline configuration database operations.
pub struct PipelineConfigRepo;

impl PipelineConfigRepo {
    /// Creates a new pipeline config.
    pub async fn create(pool: &DbPool, config: &PipelineConfig) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO pipeline_configs (
                id, repository_id, name, config_yaml, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(config.id.to_string())
        .bind(config.repository_id.to_string())
        .bind(&config.name)
        .bind(&config.config_yaml)
        .bind(config.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a pipeline config by ID.
    pub async fn get_by_id(pool: &DbPool, id: &PipelineConfigId) -> Result<Option<PipelineConfig>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name, config_yaml, is_active, created_at, updated_at
            FROM pipeline_configs
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_config(&r)).transpose()
    }

    /// Gets the active pipeline config for a repository.
    pub async fn get_active_for_repository(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Option<PipelineConfig>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name, config_yaml, is_active, created_at, updated_at
            FROM pipeline_configs
            WHERE repository_id = ? AND is_active = 1
            ORDER BY updated_at DESC
            LIMIT 1
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_config(&r)).transpose()
    }

    /// Lists all pipeline configs for a repository.
    pub async fn list_for_repository(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<PipelineConfig>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, config_yaml, is_active, created_at, updated_at
            FROM pipeline_configs
            WHERE repository_id = ?
            ORDER BY updated_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_config).collect()
    }

    /// Updates a pipeline config.
    pub async fn update(pool: &DbPool, config: &PipelineConfig) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE pipeline_configs SET
                name = ?, config_yaml = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&config.name)
        .bind(&config.config_yaml)
        .bind(config.is_active)
        .bind(&now)
        .bind(config.id.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Upserts a pipeline config (creates or updates based on repository_id + name).
    pub async fn upsert(pool: &DbPool, config: &PipelineConfig) -> Result<()> {
        let now = Utc::now().to_rfc3339();

        // First, deactivate any existing active configs for this repository
        if config.is_active {
            sqlx::query(
                r#"
                UPDATE pipeline_configs SET is_active = 0, updated_at = ?
                WHERE repository_id = ? AND is_active = 1
                "#,
            )
            .bind(&now)
            .bind(config.repository_id.to_string())
            .execute(pool)
            .await?;
        }

        // Then upsert the new config
        sqlx::query(
            r#"
            INSERT INTO pipeline_configs (
                id, repository_id, name, config_yaml, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(repository_id, name) DO UPDATE SET
                config_yaml = excluded.config_yaml,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(config.id.to_string())
        .bind(config.repository_id.to_string())
        .bind(&config.name)
        .bind(&config.config_yaml)
        .bind(config.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Deletes a pipeline config.
    pub async fn delete(pool: &DbPool, id: &PipelineConfigId) -> Result<()> {
        sqlx::query("DELETE FROM pipeline_configs WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Deletes all pipeline configs for a repository.
    pub async fn delete_for_repository(pool: &DbPool, repository_id: &RepositoryId) -> Result<()> {
        sqlx::query("DELETE FROM pipeline_configs WHERE repository_id = ?")
            .bind(repository_id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    fn row_to_config(row: &sqlx::sqlite::SqliteRow) -> Result<PipelineConfig> {
        let id_str: String = row.get("id");
        let repo_id_str: String = row.get("repository_id");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(PipelineConfig {
            id: PipelineConfigId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repo_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            config_yaml: row.get("config_yaml"),
            is_active: row.get("is_active"),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map_err(|e| OoreError::DateParse {
                    field: "pipeline_config.created_at",
                    message: e.to_string(),
                })?
                .with_timezone(&Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                .map_err(|e| OoreError::DateParse {
                    field: "pipeline_config.updated_at",
                    message: e.to_string(),
                })?
                .with_timezone(&Utc),
        })
    }
}

/// Build step database operations.
pub struct BuildStepRepo;

impl BuildStepRepo {
    /// Creates a new build step.
    pub async fn create(pool: &DbPool, step: &BuildStep) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO build_steps (
                id, build_id, step_index, name, script, timeout_secs, ignore_failure,
                status, exit_code, started_at, finished_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(step.id.to_string())
        .bind(step.build_id.to_string())
        .bind(step.step_index)
        .bind(&step.name)
        .bind(&step.script)
        .bind(step.timeout_secs)
        .bind(step.ignore_failure)
        .bind(step.status.as_str())
        .bind(step.exit_code)
        .bind(step.started_at.map(|t| t.to_rfc3339()))
        .bind(step.finished_at.map(|t| t.to_rfc3339()))
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a build step by ID.
    pub async fn get_by_id(pool: &DbPool, id: &BuildStepId) -> Result<Option<BuildStep>> {
        let row = sqlx::query(
            r#"
            SELECT id, build_id, step_index, name, script, timeout_secs, ignore_failure,
                   status, exit_code, started_at, finished_at, created_at
            FROM build_steps
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_step(&r)).transpose()
    }

    /// Lists all steps for a build.
    pub async fn list_for_build(pool: &DbPool, build_id: &BuildId) -> Result<Vec<BuildStep>> {
        let rows = sqlx::query(
            r#"
            SELECT id, build_id, step_index, name, script, timeout_secs, ignore_failure,
                   status, exit_code, started_at, finished_at, created_at
            FROM build_steps
            WHERE build_id = ?
            ORDER BY step_index ASC
            "#,
        )
        .bind(build_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_step).collect()
    }

    /// Updates a build step's status.
    pub async fn update_status(
        pool: &DbPool,
        id: &BuildStepId,
        status: StepStatus,
        exit_code: Option<i32>,
    ) -> Result<()> {
        let now = Utc::now().to_rfc3339();

        match status {
            StepStatus::Running => {
                sqlx::query(
                    "UPDATE build_steps SET status = ?, started_at = ? WHERE id = ?",
                )
                .bind(status.as_str())
                .bind(&now)
                .bind(id.to_string())
                .execute(pool)
                .await?;
            }
            StepStatus::Success | StepStatus::Failure | StepStatus::Skipped | StepStatus::Cancelled => {
                sqlx::query(
                    "UPDATE build_steps SET status = ?, exit_code = ?, finished_at = ? WHERE id = ?",
                )
                .bind(status.as_str())
                .bind(exit_code)
                .bind(&now)
                .bind(id.to_string())
                .execute(pool)
                .await?;
            }
            StepStatus::Pending => {
                sqlx::query("UPDATE build_steps SET status = ? WHERE id = ?")
                    .bind(status.as_str())
                    .bind(id.to_string())
                    .execute(pool)
                    .await?;
            }
        }

        Ok(())
    }

    /// Marks all pending steps for a build as cancelled.
    pub async fn cancel_pending_for_build(pool: &DbPool, build_id: &BuildId) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE build_steps SET status = 'cancelled', finished_at = ?
            WHERE build_id = ? AND status = 'pending'
            "#,
        )
        .bind(&now)
        .bind(build_id.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    fn row_to_step(row: &sqlx::sqlite::SqliteRow) -> Result<BuildStep> {
        let id_str: String = row.get("id");
        let build_id_str: String = row.get("build_id");
        let status_str: String = row.get("status");
        let created_at_str: String = row.get("created_at");
        let started_at_str: Option<String> = row.get("started_at");
        let finished_at_str: Option<String> = row.get("finished_at");

        let parse_datetime =
            |s: &str, field: &'static str| -> Result<chrono::DateTime<Utc>> {
                chrono::DateTime::parse_from_rfc3339(s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| OoreError::DateParse {
                        field,
                        message: e.to_string(),
                    })
            };

        Ok(BuildStep {
            id: BuildStepId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            build_id: BuildId::from_string(&build_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            step_index: row.get("step_index"),
            name: row.get("name"),
            script: row.get("script"),
            timeout_secs: row.get("timeout_secs"),
            ignore_failure: row.get("ignore_failure"),
            status: status_str.parse().map_err(|e: String| {
                OoreError::Database(sqlx::Error::Decode(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    e,
                ))))
            })?,
            exit_code: row.get("exit_code"),
            started_at: started_at_str
                .map(|s| parse_datetime(&s, "build_step.started_at"))
                .transpose()?,
            finished_at: finished_at_str
                .map(|s| parse_datetime(&s, "build_step.finished_at"))
                .transpose()?,
            created_at: parse_datetime(&created_at_str, "build_step.created_at")?,
        })
    }
}

/// Build log database operations.
pub struct BuildLogRepo;

impl BuildLogRepo {
    /// Creates a new build log record.
    pub async fn create(pool: &DbPool, log: &BuildLog) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO build_logs (
                id, build_id, step_index, stream, log_file_path, line_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(log.id.to_string())
        .bind(log.build_id.to_string())
        .bind(log.step_index)
        .bind(log.stream.as_str())
        .bind(&log.log_file_path)
        .bind(log.line_count)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a build log by ID.
    pub async fn get_by_id(pool: &DbPool, id: &BuildLogId) -> Result<Option<BuildLog>> {
        let row = sqlx::query(
            r#"
            SELECT id, build_id, step_index, stream, log_file_path, line_count, created_at
            FROM build_logs
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_log(&r)).transpose()
    }

    /// Lists all logs for a build.
    pub async fn list_for_build(pool: &DbPool, build_id: &BuildId) -> Result<Vec<BuildLog>> {
        let rows = sqlx::query(
            r#"
            SELECT id, build_id, step_index, stream, log_file_path, line_count, created_at
            FROM build_logs
            WHERE build_id = ?
            ORDER BY step_index ASC, stream ASC
            "#,
        )
        .bind(build_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_log).collect()
    }

    /// Lists logs for a specific step.
    pub async fn list_for_step(
        pool: &DbPool,
        build_id: &BuildId,
        step_index: i32,
    ) -> Result<Vec<BuildLog>> {
        let rows = sqlx::query(
            r#"
            SELECT id, build_id, step_index, stream, log_file_path, line_count, created_at
            FROM build_logs
            WHERE build_id = ? AND step_index = ?
            ORDER BY stream ASC
            "#,
        )
        .bind(build_id.to_string())
        .bind(step_index)
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_log).collect()
    }

    /// Updates the line count for a log.
    pub async fn update_line_count(pool: &DbPool, id: &BuildLogId, line_count: i32) -> Result<()> {
        sqlx::query("UPDATE build_logs SET line_count = ? WHERE id = ?")
            .bind(line_count)
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    fn row_to_log(row: &sqlx::sqlite::SqliteRow) -> Result<BuildLog> {
        let id_str: String = row.get("id");
        let build_id_str: String = row.get("build_id");
        let stream_str: String = row.get("stream");
        let created_at_str: String = row.get("created_at");

        Ok(BuildLog {
            id: BuildLogId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            build_id: BuildId::from_string(&build_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            step_index: row.get("step_index"),
            stream: stream_str.parse().map_err(|e: String| {
                OoreError::Database(sqlx::Error::Decode(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    e,
                ))))
            })?,
            log_file_path: row.get("log_file_path"),
            line_count: row.get("line_count"),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map_err(|e| OoreError::DateParse {
                    field: "build_log.created_at",
                    message: e.to_string(),
                })?
                .with_timezone(&Utc),
        })
    }
}
