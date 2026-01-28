//! Database operations for repositories, webhook events, and builds.

use chrono::Utc;
use sqlx::Row;

use super::DbPool;
use crate::error::{OoreError, Result};
use crate::models::{
    Build, BuildId, BuildStatus, ConfigSource, GitProvider, Repository, RepositoryId,
    WebhookEvent, WebhookEventId,
};

/// Repository database operations.
pub struct RepositoryRepo;

impl RepositoryRepo {
    /// Creates a new repository.
    pub async fn create(pool: &DbPool, repo: &Repository) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO repositories (
                id, name, provider, owner, repo_name, clone_url, default_branch,
                webhook_secret_hmac, is_active, github_repository_id,
                github_installation_id, gitlab_project_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(repo.id.to_string())
        .bind(&repo.name)
        .bind(repo.provider.as_str())
        .bind(&repo.owner)
        .bind(&repo.repo_name)
        .bind(&repo.clone_url)
        .bind(&repo.default_branch)
        .bind(&repo.webhook_secret_hmac)
        .bind(repo.is_active)
        .bind(repo.github_repository_id)
        .bind(repo.github_installation_id)
        .bind(repo.gitlab_project_id)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a repository by ID.
    pub async fn get_by_id(pool: &DbPool, id: &RepositoryId) -> Result<Option<Repository>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, provider, owner, repo_name, clone_url, default_branch,
                   webhook_secret_hmac, is_active, github_repository_id,
                   github_installation_id, gitlab_project_id, created_at, updated_at
            FROM repositories
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_repository(&r)).transpose()
    }

    /// Gets a repository by GitHub repository ID.
    pub async fn get_by_github_repo_id(
        pool: &DbPool,
        github_repo_id: i64,
    ) -> Result<Option<Repository>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, provider, owner, repo_name, clone_url, default_branch,
                   webhook_secret_hmac, is_active, github_repository_id,
                   github_installation_id, gitlab_project_id, created_at, updated_at
            FROM repositories
            WHERE github_repository_id = ?
            "#,
        )
        .bind(github_repo_id)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_repository(&r)).transpose()
    }

    /// Gets a repository by GitLab project ID.
    pub async fn get_by_gitlab_project_id(
        pool: &DbPool,
        gitlab_project_id: i64,
    ) -> Result<Option<Repository>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, provider, owner, repo_name, clone_url, default_branch,
                   webhook_secret_hmac, is_active, github_repository_id,
                   github_installation_id, gitlab_project_id, created_at, updated_at
            FROM repositories
            WHERE gitlab_project_id = ?
            "#,
        )
        .bind(gitlab_project_id)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_repository(&r)).transpose()
    }

    /// Gets a repository by provider, owner, and repo name.
    pub async fn get_by_full_name(
        pool: &DbPool,
        provider: GitProvider,
        owner: &str,
        repo_name: &str,
    ) -> Result<Option<Repository>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, provider, owner, repo_name, clone_url, default_branch,
                   webhook_secret_hmac, is_active, github_repository_id,
                   github_installation_id, gitlab_project_id, created_at, updated_at
            FROM repositories
            WHERE provider = ? AND owner = ? AND repo_name = ?
            "#,
        )
        .bind(provider.as_str())
        .bind(owner)
        .bind(repo_name)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_repository(&r)).transpose()
    }

    /// Lists all repositories.
    pub async fn list(pool: &DbPool) -> Result<Vec<Repository>> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, provider, owner, repo_name, clone_url, default_branch,
                   webhook_secret_hmac, is_active, github_repository_id,
                   github_installation_id, gitlab_project_id, created_at, updated_at
            FROM repositories
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_repository).collect()
    }

    /// Updates a repository.
    pub async fn update(pool: &DbPool, repo: &Repository) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE repositories SET
                name = ?, default_branch = ?, webhook_secret_hmac = ?, is_active = ?,
                github_installation_id = ?, gitlab_project_id = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&repo.name)
        .bind(&repo.default_branch)
        .bind(&repo.webhook_secret_hmac)
        .bind(repo.is_active)
        .bind(repo.github_installation_id)
        .bind(repo.gitlab_project_id)
        .bind(&now)
        .bind(repo.id.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Deletes a repository.
    pub async fn delete(pool: &DbPool, id: &RepositoryId) -> Result<()> {
        sqlx::query("DELETE FROM repositories WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Deactivates a repository (soft delete).
    pub async fn deactivate(pool: &DbPool, id: &RepositoryId) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE repositories SET is_active = 0, updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    fn row_to_repository(row: &sqlx::sqlite::SqliteRow) -> Result<Repository> {
        let id_str: String = row.get("id");
        let provider_str: String = row.get("provider");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(Repository {
            id: RepositoryId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            provider: provider_str.parse()?,
            owner: row.get("owner"),
            repo_name: row.get("repo_name"),
            clone_url: row.get("clone_url"),
            default_branch: row.get("default_branch"),
            webhook_secret_hmac: row.get("webhook_secret_hmac"),
            is_active: row.get("is_active"),
            github_repository_id: row.get("github_repository_id"),
            github_installation_id: row.get("github_installation_id"),
            gitlab_project_id: row.get("gitlab_project_id"),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map_err(|e| OoreError::DateParse {
                    field: "repository.created_at",
                    message: e.to_string(),
                })?
                .with_timezone(&Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                .map_err(|e| OoreError::DateParse {
                    field: "repository.updated_at",
                    message: e.to_string(),
                })?
                .with_timezone(&Utc),
        })
    }
}

/// Webhook event database operations.
pub struct WebhookEventRepo;

impl WebhookEventRepo {
    /// Creates a new webhook event.
    pub async fn create(pool: &DbPool, event: &WebhookEvent) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO webhook_events (
                id, repository_id, provider, event_type, delivery_id,
                payload, processed, error_message, received_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(event.id.to_string())
        .bind(event.repository_id.as_ref().map(|id| id.to_string()))
        .bind(event.provider.as_str())
        .bind(&event.event_type)
        .bind(&event.delivery_id)
        .bind(&event.payload)
        .bind(event.processed)
        .bind(&event.error_message)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a webhook event by ID.
    pub async fn get_by_id(pool: &DbPool, id: &WebhookEventId) -> Result<Option<WebhookEvent>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, provider, event_type, delivery_id,
                   payload, processed, error_message, received_at
            FROM webhook_events
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_event(&r)).transpose()
    }

    /// Checks if a delivery ID already exists (idempotency check).
    pub async fn exists_by_delivery(
        pool: &DbPool,
        provider: GitProvider,
        delivery_id: &str,
    ) -> Result<bool> {
        let row = sqlx::query(
            r#"
            SELECT 1 FROM webhook_events
            WHERE provider = ? AND delivery_id = ?
            LIMIT 1
            "#,
        )
        .bind(provider.as_str())
        .bind(delivery_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.is_some())
    }

    /// Lists webhook events, optionally filtered by repository.
    pub async fn list(pool: &DbPool, repository_id: Option<&RepositoryId>) -> Result<Vec<WebhookEvent>> {
        let rows = match repository_id {
            Some(repo_id) => {
                sqlx::query(
                    r#"
                    SELECT id, repository_id, provider, event_type, delivery_id,
                           payload, processed, error_message, received_at
                    FROM webhook_events
                    WHERE repository_id = ?
                    ORDER BY received_at DESC
                    LIMIT 100
                    "#,
                )
                .bind(repo_id.to_string())
                .fetch_all(pool)
                .await?
            }
            None => {
                sqlx::query(
                    r#"
                    SELECT id, repository_id, provider, event_type, delivery_id,
                           payload, processed, error_message, received_at
                    FROM webhook_events
                    ORDER BY received_at DESC
                    LIMIT 100
                    "#,
                )
                .fetch_all(pool)
                .await?
            }
        };

        rows.iter().map(Self::row_to_event).collect()
    }

    /// Gets unprocessed webhook events for recovery on startup.
    ///
    /// Uses pagination to avoid loading all events into memory at once.
    /// Call repeatedly with increasing `offset` until an empty result is returned.
    pub async fn get_unprocessed(pool: &DbPool) -> Result<Vec<WebhookEvent>> {
        Self::get_unprocessed_batch(pool, 100, 0).await
    }

    /// Gets a batch of unprocessed webhook events with pagination.
    ///
    /// # Arguments
    /// * `limit` - Maximum number of events to return
    /// * `offset` - Number of events to skip (for pagination)
    pub async fn get_unprocessed_batch(
        pool: &DbPool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<WebhookEvent>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, provider, event_type, delivery_id,
                   payload, processed, error_message, received_at
            FROM webhook_events
            WHERE processed = 0
            ORDER BY received_at ASC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_event).collect()
    }

    /// Counts the total number of unprocessed webhook events.
    pub async fn count_unprocessed(pool: &DbPool) -> Result<i64> {
        let row = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM webhook_events WHERE processed = 0",
        )
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    /// Marks a webhook event as processed.
    pub async fn mark_processed(pool: &DbPool, id: &WebhookEventId) -> Result<()> {
        sqlx::query("UPDATE webhook_events SET processed = 1 WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Sets an error message on a webhook event.
    pub async fn set_error(pool: &DbPool, id: &WebhookEventId, error: &str) -> Result<()> {
        sqlx::query("UPDATE webhook_events SET error_message = ? WHERE id = ?")
            .bind(error)
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    fn row_to_event(row: &sqlx::sqlite::SqliteRow) -> Result<WebhookEvent> {
        let id_str: String = row.get("id");
        let repo_id_str: Option<String> = row.get("repository_id");
        let provider_str: String = row.get("provider");
        let received_at_str: String = row.get("received_at");

        Ok(WebhookEvent {
            id: WebhookEventId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: repo_id_str
                .map(|s| RepositoryId::from_string(&s))
                .transpose()
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            provider: provider_str.parse()?,
            event_type: row.get("event_type"),
            delivery_id: row.get("delivery_id"),
            payload: row.get("payload"),
            processed: row.get("processed"),
            error_message: row.get("error_message"),
            received_at: chrono::DateTime::parse_from_rfc3339(&received_at_str)
                .map_err(|e| OoreError::DateParse {
                    field: "webhook_event.received_at",
                    message: e.to_string(),
                })?
                .with_timezone(&Utc),
        })
    }
}

/// Build database operations.
pub struct BuildRepo;

impl BuildRepo {
    /// Creates a new build.
    pub async fn create(pool: &DbPool, build: &Build) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO builds (
                id, repository_id, webhook_event_id, commit_sha, branch,
                trigger_type, status, started_at, finished_at, created_at,
                workflow_name, config_source, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(build.id.to_string())
        .bind(build.repository_id.to_string())
        .bind(build.webhook_event_id.as_ref().map(|id| id.to_string()))
        .bind(&build.commit_sha)
        .bind(&build.branch)
        .bind(build.trigger_type.as_str())
        .bind(build.status.as_str())
        .bind(build.started_at.map(|t| t.to_rfc3339()))
        .bind(build.finished_at.map(|t| t.to_rfc3339()))
        .bind(&now)
        .bind(&build.workflow_name)
        .bind(build.config_source.map(|s| s.as_str()))
        .bind(&build.error_message)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a build by ID.
    pub async fn get_by_id(pool: &DbPool, id: &BuildId) -> Result<Option<Build>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, webhook_event_id, commit_sha, branch,
                   trigger_type, status, started_at, finished_at, created_at,
                   workflow_name, config_source, error_message
            FROM builds
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_build(&r)).transpose()
    }

    /// Lists builds, optionally filtered by repository.
    pub async fn list(pool: &DbPool, repository_id: Option<&RepositoryId>) -> Result<Vec<Build>> {
        let rows = match repository_id {
            Some(repo_id) => {
                sqlx::query(
                    r#"
                    SELECT id, repository_id, webhook_event_id, commit_sha, branch,
                           trigger_type, status, started_at, finished_at, created_at,
                           workflow_name, config_source, error_message
                    FROM builds
                    WHERE repository_id = ?
                    ORDER BY created_at DESC
                    LIMIT 100
                    "#,
                )
                .bind(repo_id.to_string())
                .fetch_all(pool)
                .await?
            }
            None => {
                sqlx::query(
                    r#"
                    SELECT id, repository_id, webhook_event_id, commit_sha, branch,
                           trigger_type, status, started_at, finished_at, created_at,
                           workflow_name, config_source, error_message
                    FROM builds
                    ORDER BY created_at DESC
                    LIMIT 100
                    "#,
                )
                .fetch_all(pool)
                .await?
            }
        };

        rows.iter().map(Self::row_to_build).collect()
    }

    /// Gets pending builds for recovery on startup.
    pub async fn get_pending(pool: &DbPool) -> Result<Vec<Build>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, webhook_event_id, commit_sha, branch,
                   trigger_type, status, started_at, finished_at, created_at,
                   workflow_name, config_source, error_message
            FROM builds
            WHERE status = 'pending'
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_build).collect()
    }

    /// Marks running builds as failed (for recovery after crash).
    pub async fn fail_running_builds(pool: &DbPool, error_message: &str) -> Result<u64> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            r#"
            UPDATE builds SET status = 'failure', finished_at = ?, error_message = ?
            WHERE status = 'running'
            "#,
        )
        .bind(&now)
        .bind(error_message)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Updates build with workflow info when starting execution.
    pub async fn update_workflow_info(
        pool: &DbPool,
        id: &BuildId,
        workflow_name: &str,
        config_source: ConfigSource,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE builds SET workflow_name = ?, config_source = ? WHERE id = ?",
        )
        .bind(workflow_name)
        .bind(config_source.as_str())
        .bind(id.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Sets an error message on a build.
    pub async fn set_error(pool: &DbPool, id: &BuildId, error: &str) -> Result<()> {
        sqlx::query("UPDATE builds SET error_message = ? WHERE id = ?")
            .bind(error)
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Updates build status.
    pub async fn update_status(pool: &DbPool, id: &BuildId, status: BuildStatus) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        let (started, finished) = match status {
            BuildStatus::Running => (Some(now.clone()), None),
            BuildStatus::Success | BuildStatus::Failure | BuildStatus::Cancelled => {
                (None, Some(now))
            }
            BuildStatus::Pending => (None, None),
        };

        if let Some(started) = started {
            sqlx::query("UPDATE builds SET status = ?, started_at = ? WHERE id = ?")
                .bind(status.as_str())
                .bind(started)
                .bind(id.to_string())
                .execute(pool)
                .await?;
        } else if let Some(finished) = finished {
            sqlx::query("UPDATE builds SET status = ?, finished_at = ? WHERE id = ?")
                .bind(status.as_str())
                .bind(finished)
                .bind(id.to_string())
                .execute(pool)
                .await?;
        } else {
            sqlx::query("UPDATE builds SET status = ? WHERE id = ?")
                .bind(status.as_str())
                .bind(id.to_string())
                .execute(pool)
                .await?;
        }

        Ok(())
    }

    fn row_to_build(row: &sqlx::sqlite::SqliteRow) -> Result<Build> {
        let id_str: String = row.get("id");
        let repo_id_str: String = row.get("repository_id");
        let webhook_event_id_str: Option<String> = row.get("webhook_event_id");
        let trigger_type_str: String = row.get("trigger_type");
        let status_str: String = row.get("status");
        let created_at_str: String = row.get("created_at");
        let started_at_str: Option<String> = row.get("started_at");
        let finished_at_str: Option<String> = row.get("finished_at");
        let config_source_str: Option<String> = row.get("config_source");

        let parse_datetime =
            |s: &str, field: &'static str| -> Result<chrono::DateTime<Utc>> {
                chrono::DateTime::parse_from_rfc3339(s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| OoreError::DateParse {
                        field,
                        message: e.to_string(),
                    })
            };

        Ok(Build {
            id: BuildId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repo_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            webhook_event_id: webhook_event_id_str
                .map(|s| WebhookEventId::from_string(&s))
                .transpose()
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            commit_sha: row.get("commit_sha"),
            branch: row.get("branch"),
            trigger_type: trigger_type_str.parse().map_err(|e: String| {
                OoreError::Database(sqlx::Error::Decode(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    e,
                ))))
            })?,
            status: status_str.parse().map_err(|e: String| {
                OoreError::Database(sqlx::Error::Decode(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    e,
                ))))
            })?,
            started_at: started_at_str
                .map(|s| parse_datetime(&s, "build.started_at"))
                .transpose()?,
            finished_at: finished_at_str
                .map(|s| parse_datetime(&s, "build.finished_at"))
                .transpose()?,
            created_at: parse_datetime(&created_at_str, "build.created_at")?,
            workflow_name: row.get("workflow_name"),
            config_source: config_source_str
                .map(|s| s.parse::<ConfigSource>())
                .transpose()
                .map_err(|e: String| {
                    OoreError::Database(sqlx::Error::Decode(Box::new(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        e,
                    ))))
                })?,
            error_message: row.get("error_message"),
        })
    }
}
