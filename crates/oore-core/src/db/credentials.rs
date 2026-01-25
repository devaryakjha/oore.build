//! Database operations for provider credentials and OAuth state.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use super::DbPool;
use crate::error::{OoreError, Result};
use crate::models::RepositoryId;

// ============================================================================
// GitHub App Credentials
// ============================================================================

/// Unique identifier for GitHub App credentials.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GitHubAppCredentialsId(String);

impl GitHubAppCredentialsId {
    pub fn new() -> Self {
        Self(ulid::Ulid::new().to_string())
    }

    pub fn from_string(s: &str) -> std::result::Result<Self, ulid::DecodeError> {
        ulid::Ulid::from_string(s)?;
        Ok(Self(s.to_string()))
    }
}

impl std::fmt::Display for GitHubAppCredentialsId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for GitHubAppCredentialsId {
    fn default() -> Self {
        Self::new()
    }
}

/// GitHub App credentials created via manifest flow.
#[derive(Debug, Clone)]
pub struct GitHubAppCredentials {
    pub id: GitHubAppCredentialsId,
    pub app_id: i64,
    pub app_name: String,
    pub app_slug: String,
    pub owner_login: String,
    pub owner_type: String, // "User" or "Organization"
    pub private_key_encrypted: Vec<u8>,
    pub private_key_nonce: Vec<u8>,
    pub webhook_secret_encrypted: Vec<u8>,
    pub webhook_secret_nonce: Vec<u8>,
    pub client_id: Option<String>,
    pub client_secret_encrypted: Option<Vec<u8>>,
    pub client_secret_nonce: Option<Vec<u8>>,
    pub html_url: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// GitHub App credentials repository.
pub struct GitHubAppCredentialsRepo;

impl GitHubAppCredentialsRepo {
    /// Creates new GitHub App credentials.
    pub async fn create(pool: &DbPool, creds: &GitHubAppCredentials) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO github_app_credentials (
                id, app_id, app_name, app_slug, owner_login, owner_type,
                private_key_encrypted, private_key_nonce,
                webhook_secret_encrypted, webhook_secret_nonce,
                client_id, client_secret_encrypted, client_secret_nonce,
                html_url, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(creds.id.to_string())
        .bind(creds.app_id)
        .bind(&creds.app_name)
        .bind(&creds.app_slug)
        .bind(&creds.owner_login)
        .bind(&creds.owner_type)
        .bind(&creds.private_key_encrypted)
        .bind(&creds.private_key_nonce)
        .bind(&creds.webhook_secret_encrypted)
        .bind(&creds.webhook_secret_nonce)
        .bind(&creds.client_id)
        .bind(&creds.client_secret_encrypted)
        .bind(&creds.client_secret_nonce)
        .bind(&creds.html_url)
        .bind(creds.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets the active GitHub App credentials.
    pub async fn get_active(pool: &DbPool) -> Result<Option<GitHubAppCredentials>> {
        let row = sqlx::query(
            r#"
            SELECT id, app_id, app_name, app_slug, owner_login, owner_type,
                   private_key_encrypted, private_key_nonce,
                   webhook_secret_encrypted, webhook_secret_nonce,
                   client_id, client_secret_encrypted, client_secret_nonce,
                   html_url, is_active, created_at, updated_at
            FROM github_app_credentials
            WHERE is_active = 1
            LIMIT 1
            "#,
        )
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_credentials(&r)).transpose()
    }

    /// Gets GitHub App credentials by app_id.
    pub async fn get_by_app_id(pool: &DbPool, app_id: i64) -> Result<Option<GitHubAppCredentials>> {
        let row = sqlx::query(
            r#"
            SELECT id, app_id, app_name, app_slug, owner_login, owner_type,
                   private_key_encrypted, private_key_nonce,
                   webhook_secret_encrypted, webhook_secret_nonce,
                   client_id, client_secret_encrypted, client_secret_nonce,
                   html_url, is_active, created_at, updated_at
            FROM github_app_credentials
            WHERE app_id = ?
            "#,
        )
        .bind(app_id)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_credentials(&r)).transpose()
    }

    /// Deactivates all GitHub App credentials.
    pub async fn deactivate_all(pool: &DbPool) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE github_app_credentials SET is_active = 0, updated_at = ?")
            .bind(&now)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Deletes GitHub App credentials by ID.
    pub async fn delete(pool: &DbPool, id: &GitHubAppCredentialsId) -> Result<()> {
        sqlx::query("DELETE FROM github_app_credentials WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;
        Ok(())
    }

    fn row_to_credentials(row: &sqlx::sqlite::SqliteRow) -> Result<GitHubAppCredentials> {
        let id_str: String = row.get("id");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(GitHubAppCredentials {
            id: GitHubAppCredentialsId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            app_id: row.get("app_id"),
            app_name: row.get("app_name"),
            app_slug: row.get("app_slug"),
            owner_login: row.get("owner_login"),
            owner_type: row.get("owner_type"),
            private_key_encrypted: row.get("private_key_encrypted"),
            private_key_nonce: row.get("private_key_nonce"),
            webhook_secret_encrypted: row.get("webhook_secret_encrypted"),
            webhook_secret_nonce: row.get("webhook_secret_nonce"),
            client_id: row.get("client_id"),
            client_secret_encrypted: row.get("client_secret_encrypted"),
            client_secret_nonce: row.get("client_secret_nonce"),
            html_url: row.get("html_url"),
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// GitHub App Installations
// ============================================================================

/// Unique identifier for GitHub App installation.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GitHubInstallationId(String);

impl GitHubInstallationId {
    pub fn new() -> Self {
        Self(ulid::Ulid::new().to_string())
    }

    pub fn from_string(s: &str) -> std::result::Result<Self, ulid::DecodeError> {
        ulid::Ulid::from_string(s)?;
        Ok(Self(s.to_string()))
    }
}

impl std::fmt::Display for GitHubInstallationId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for GitHubInstallationId {
    fn default() -> Self {
        Self::new()
    }
}

/// GitHub App installation record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAppInstallation {
    pub id: GitHubInstallationId,
    pub github_app_id: GitHubAppCredentialsId,
    pub installation_id: i64,
    pub account_login: String,
    pub account_type: String, // "User" or "Organization"
    pub account_id: i64,
    pub repository_selection: String, // "all" or "selected"
    pub permissions: String,          // JSON
    pub events: String,               // JSON array
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// GitHub App installation repository.
pub struct GitHubAppInstallationRepo;

impl GitHubAppInstallationRepo {
    /// Creates or updates an installation.
    pub async fn upsert(pool: &DbPool, installation: &GitHubAppInstallation) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO github_app_installations (
                id, github_app_id, installation_id, account_login, account_type,
                account_id, repository_selection, permissions, events,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(installation_id) DO UPDATE SET
                account_login = excluded.account_login,
                account_type = excluded.account_type,
                repository_selection = excluded.repository_selection,
                permissions = excluded.permissions,
                events = excluded.events,
                is_active = excluded.is_active,
                updated_at = ?
            "#,
        )
        .bind(installation.id.to_string())
        .bind(installation.github_app_id.to_string())
        .bind(installation.installation_id)
        .bind(&installation.account_login)
        .bind(&installation.account_type)
        .bind(installation.account_id)
        .bind(&installation.repository_selection)
        .bind(&installation.permissions)
        .bind(&installation.events)
        .bind(installation.is_active)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Lists all active installations for a GitHub App.
    pub async fn list_by_app(
        pool: &DbPool,
        app_id: &GitHubAppCredentialsId,
    ) -> Result<Vec<GitHubAppInstallation>> {
        let rows = sqlx::query(
            r#"
            SELECT id, github_app_id, installation_id, account_login, account_type,
                   account_id, repository_selection, permissions, events,
                   is_active, created_at, updated_at
            FROM github_app_installations
            WHERE github_app_id = ? AND is_active = 1
            ORDER BY account_login
            "#,
        )
        .bind(app_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_installation).collect()
    }

    /// Gets an installation by GitHub installation ID.
    pub async fn get_by_installation_id(
        pool: &DbPool,
        installation_id: i64,
    ) -> Result<Option<GitHubAppInstallation>> {
        let row = sqlx::query(
            r#"
            SELECT id, github_app_id, installation_id, account_login, account_type,
                   account_id, repository_selection, permissions, events,
                   is_active, created_at, updated_at
            FROM github_app_installations
            WHERE installation_id = ?
            "#,
        )
        .bind(installation_id)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_installation(&r)).transpose()
    }

    /// Marks an installation as inactive.
    pub async fn deactivate(pool: &DbPool, installation_id: i64) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE github_app_installations SET is_active = 0, updated_at = ? WHERE installation_id = ?",
        )
        .bind(&now)
        .bind(installation_id)
        .execute(pool)
        .await?;
        Ok(())
    }

    fn row_to_installation(row: &sqlx::sqlite::SqliteRow) -> Result<GitHubAppInstallation> {
        let id_str: String = row.get("id");
        let app_id_str: String = row.get("github_app_id");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(GitHubAppInstallation {
            id: GitHubInstallationId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            github_app_id: GitHubAppCredentialsId::from_string(&app_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            installation_id: row.get("installation_id"),
            account_login: row.get("account_login"),
            account_type: row.get("account_type"),
            account_id: row.get("account_id"),
            repository_selection: row.get("repository_selection"),
            permissions: row.get("permissions"),
            events: row.get("events"),
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// GitHub Installation Repositories
// ============================================================================

/// Unique identifier for GitHub installation repository.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GitHubInstallationRepoId(String);

impl GitHubInstallationRepoId {
    pub fn new() -> Self {
        Self(ulid::Ulid::new().to_string())
    }

    pub fn from_string(s: &str) -> std::result::Result<Self, ulid::DecodeError> {
        ulid::Ulid::from_string(s)?;
        Ok(Self(s.to_string()))
    }
}

impl std::fmt::Display for GitHubInstallationRepoId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for GitHubInstallationRepoId {
    fn default() -> Self {
        Self::new()
    }
}

/// GitHub installation repository record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubInstallationRepository {
    pub id: GitHubInstallationRepoId,
    pub installation_id: GitHubInstallationId,
    pub github_repository_id: i64,
    pub full_name: String, // owner/repo
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
}

/// GitHub installation repository database operations.
pub struct GitHubInstallationRepoRepo;

impl GitHubInstallationRepoRepo {
    /// Creates or updates an installation repository.
    pub async fn upsert(pool: &DbPool, repo: &GitHubInstallationRepository) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO github_installation_repositories (
                id, installation_id, github_repository_id, full_name, is_private, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(installation_id, github_repository_id) DO UPDATE SET
                full_name = excluded.full_name,
                is_private = excluded.is_private
            "#,
        )
        .bind(repo.id.to_string())
        .bind(repo.installation_id.to_string())
        .bind(repo.github_repository_id)
        .bind(&repo.full_name)
        .bind(repo.is_private)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Lists repositories for an installation.
    pub async fn list_by_installation(
        pool: &DbPool,
        installation_id: &GitHubInstallationId,
    ) -> Result<Vec<GitHubInstallationRepository>> {
        let rows = sqlx::query(
            r#"
            SELECT id, installation_id, github_repository_id, full_name, is_private, created_at
            FROM github_installation_repositories
            WHERE installation_id = ?
            ORDER BY full_name
            "#,
        )
        .bind(installation_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_repo).collect()
    }

    /// Deletes repositories not in the given list for an installation.
    pub async fn delete_not_in(
        pool: &DbPool,
        installation_id: &GitHubInstallationId,
        keep_repo_ids: &[i64],
    ) -> Result<u64> {
        if keep_repo_ids.is_empty() {
            // Delete all for this installation
            let result =
                sqlx::query("DELETE FROM github_installation_repositories WHERE installation_id = ?")
                    .bind(installation_id.to_string())
                    .execute(pool)
                    .await?;
            return Ok(result.rows_affected());
        }

        // Build IN clause
        let placeholders: Vec<String> = keep_repo_ids.iter().map(|_| "?".to_string()).collect();
        let query = format!(
            "DELETE FROM github_installation_repositories WHERE installation_id = ? AND github_repository_id NOT IN ({})",
            placeholders.join(", ")
        );

        let mut q = sqlx::query(&query).bind(installation_id.to_string());
        for id in keep_repo_ids {
            q = q.bind(*id);
        }

        let result = q.execute(pool).await?;
        Ok(result.rows_affected())
    }

    fn row_to_repo(row: &sqlx::sqlite::SqliteRow) -> Result<GitHubInstallationRepository> {
        let id_str: String = row.get("id");
        let installation_id_str: String = row.get("installation_id");
        let created_at_str: String = row.get("created_at");

        Ok(GitHubInstallationRepository {
            id: GitHubInstallationRepoId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            installation_id: GitHubInstallationId::from_string(&installation_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            github_repository_id: row.get("github_repository_id"),
            full_name: row.get("full_name"),
            is_private: row.get("is_private"),
            created_at: parse_datetime(&created_at_str)?,
        })
    }
}

// ============================================================================
// GitLab OAuth Credentials
// ============================================================================

/// Unique identifier for GitLab OAuth credentials.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GitLabOAuthCredentialsId(String);

impl GitLabOAuthCredentialsId {
    pub fn new() -> Self {
        Self(ulid::Ulid::new().to_string())
    }

    pub fn from_string(s: &str) -> std::result::Result<Self, ulid::DecodeError> {
        ulid::Ulid::from_string(s)?;
        Ok(Self(s.to_string()))
    }
}

impl std::fmt::Display for GitLabOAuthCredentialsId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for GitLabOAuthCredentialsId {
    fn default() -> Self {
        Self::new()
    }
}

/// GitLab OAuth credentials.
#[derive(Debug, Clone)]
pub struct GitLabOAuthCredentials {
    pub id: GitLabOAuthCredentialsId,
    pub instance_url: String,
    pub access_token_encrypted: Vec<u8>,
    pub access_token_nonce: Vec<u8>,
    pub refresh_token_encrypted: Option<Vec<u8>>,
    pub refresh_token_nonce: Option<Vec<u8>>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub user_id: i64,
    pub username: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// GitLab OAuth credentials repository.
pub struct GitLabOAuthCredentialsRepo;

impl GitLabOAuthCredentialsRepo {
    /// Creates new GitLab OAuth credentials.
    pub async fn create(pool: &DbPool, creds: &GitLabOAuthCredentials) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO gitlab_oauth_credentials (
                id, instance_url, access_token_encrypted, access_token_nonce,
                refresh_token_encrypted, refresh_token_nonce, token_expires_at,
                user_id, username, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(creds.id.to_string())
        .bind(&creds.instance_url)
        .bind(&creds.access_token_encrypted)
        .bind(&creds.access_token_nonce)
        .bind(&creds.refresh_token_encrypted)
        .bind(&creds.refresh_token_nonce)
        .bind(creds.token_expires_at.map(|t| t.to_rfc3339()))
        .bind(creds.user_id)
        .bind(&creds.username)
        .bind(creds.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets GitLab credentials by instance URL.
    pub async fn get_by_instance(
        pool: &DbPool,
        instance_url: &str,
    ) -> Result<Option<GitLabOAuthCredentials>> {
        let row = sqlx::query(
            r#"
            SELECT id, instance_url, access_token_encrypted, access_token_nonce,
                   refresh_token_encrypted, refresh_token_nonce, token_expires_at,
                   user_id, username, is_active, created_at, updated_at
            FROM gitlab_oauth_credentials
            WHERE instance_url = ? AND is_active = 1
            "#,
        )
        .bind(instance_url)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_credentials(&r)).transpose()
    }

    /// Gets GitLab credentials by ID.
    pub async fn get_by_id(
        pool: &DbPool,
        id: &GitLabOAuthCredentialsId,
    ) -> Result<Option<GitLabOAuthCredentials>> {
        let row = sqlx::query(
            r#"
            SELECT id, instance_url, access_token_encrypted, access_token_nonce,
                   refresh_token_encrypted, refresh_token_nonce, token_expires_at,
                   user_id, username, is_active, created_at, updated_at
            FROM gitlab_oauth_credentials
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_credentials(&r)).transpose()
    }

    /// Lists all active GitLab credentials.
    pub async fn list_active(pool: &DbPool) -> Result<Vec<GitLabOAuthCredentials>> {
        let rows = sqlx::query(
            r#"
            SELECT id, instance_url, access_token_encrypted, access_token_nonce,
                   refresh_token_encrypted, refresh_token_nonce, token_expires_at,
                   user_id, username, is_active, created_at, updated_at
            FROM gitlab_oauth_credentials
            WHERE is_active = 1
            ORDER BY instance_url
            "#,
        )
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_credentials).collect()
    }

    /// Updates tokens for credentials.
    pub async fn update_tokens(
        pool: &DbPool,
        id: &GitLabOAuthCredentialsId,
        access_token_encrypted: &[u8],
        access_token_nonce: &[u8],
        refresh_token_encrypted: Option<&[u8]>,
        refresh_token_nonce: Option<&[u8]>,
        token_expires_at: Option<DateTime<Utc>>,
    ) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE gitlab_oauth_credentials SET
                access_token_encrypted = ?,
                access_token_nonce = ?,
                refresh_token_encrypted = ?,
                refresh_token_nonce = ?,
                token_expires_at = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(access_token_encrypted)
        .bind(access_token_nonce)
        .bind(refresh_token_encrypted)
        .bind(refresh_token_nonce)
        .bind(token_expires_at.map(|t| t.to_rfc3339()))
        .bind(&now)
        .bind(id.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Deactivates credentials by instance URL.
    pub async fn deactivate_by_instance(pool: &DbPool, instance_url: &str) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE gitlab_oauth_credentials SET is_active = 0, updated_at = ? WHERE instance_url = ?",
        )
        .bind(&now)
        .bind(instance_url)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Deletes credentials by ID.
    pub async fn delete(pool: &DbPool, id: &GitLabOAuthCredentialsId) -> Result<()> {
        sqlx::query("DELETE FROM gitlab_oauth_credentials WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;
        Ok(())
    }

    fn row_to_credentials(row: &sqlx::sqlite::SqliteRow) -> Result<GitLabOAuthCredentials> {
        let id_str: String = row.get("id");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");
        let token_expires_at_str: Option<String> = row.get("token_expires_at");

        Ok(GitLabOAuthCredentials {
            id: GitLabOAuthCredentialsId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            instance_url: row.get("instance_url"),
            access_token_encrypted: row.get("access_token_encrypted"),
            access_token_nonce: row.get("access_token_nonce"),
            refresh_token_encrypted: row.get("refresh_token_encrypted"),
            refresh_token_nonce: row.get("refresh_token_nonce"),
            token_expires_at: token_expires_at_str
                .map(|s| parse_datetime(&s))
                .transpose()?,
            user_id: row.get("user_id"),
            username: row.get("username"),
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// GitLab Enabled Projects
// ============================================================================

/// Unique identifier for GitLab enabled project.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GitLabEnabledProjectId(String);

impl GitLabEnabledProjectId {
    pub fn new() -> Self {
        Self(ulid::Ulid::new().to_string())
    }

    pub fn from_string(s: &str) -> std::result::Result<Self, ulid::DecodeError> {
        ulid::Ulid::from_string(s)?;
        Ok(Self(s.to_string()))
    }
}

impl std::fmt::Display for GitLabEnabledProjectId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for GitLabEnabledProjectId {
    fn default() -> Self {
        Self::new()
    }
}

/// GitLab enabled project record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLabEnabledProject {
    pub id: GitLabEnabledProjectId,
    pub gitlab_credential_id: GitLabOAuthCredentialsId,
    pub repository_id: RepositoryId,
    pub project_id: i64,
    pub webhook_id: Option<i64>,
    pub webhook_token_hmac: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// GitLab enabled project repository.
pub struct GitLabEnabledProjectRepo;

impl GitLabEnabledProjectRepo {
    /// Creates a new enabled project.
    pub async fn create(pool: &DbPool, project: &GitLabEnabledProject) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO gitlab_enabled_projects (
                id, gitlab_credential_id, repository_id, project_id,
                webhook_id, webhook_token_hmac, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(project.id.to_string())
        .bind(project.gitlab_credential_id.to_string())
        .bind(project.repository_id.to_string())
        .bind(project.project_id)
        .bind(project.webhook_id)
        .bind(&project.webhook_token_hmac)
        .bind(project.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets enabled project by GitLab project ID.
    pub async fn get_by_project_id(
        pool: &DbPool,
        credential_id: &GitLabOAuthCredentialsId,
        project_id: i64,
    ) -> Result<Option<GitLabEnabledProject>> {
        let row = sqlx::query(
            r#"
            SELECT id, gitlab_credential_id, repository_id, project_id,
                   webhook_id, webhook_token_hmac, is_active, created_at, updated_at
            FROM gitlab_enabled_projects
            WHERE gitlab_credential_id = ? AND project_id = ?
            "#,
        )
        .bind(credential_id.to_string())
        .bind(project_id)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_project(&r)).transpose()
    }

    /// Lists all enabled projects for a credential.
    pub async fn list_by_credential(
        pool: &DbPool,
        credential_id: &GitLabOAuthCredentialsId,
    ) -> Result<Vec<GitLabEnabledProject>> {
        let rows = sqlx::query(
            r#"
            SELECT id, gitlab_credential_id, repository_id, project_id,
                   webhook_id, webhook_token_hmac, is_active, created_at, updated_at
            FROM gitlab_enabled_projects
            WHERE gitlab_credential_id = ? AND is_active = 1
            ORDER BY created_at DESC
            "#,
        )
        .bind(credential_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_project).collect()
    }

    /// Updates webhook info for a project.
    pub async fn update_webhook(
        pool: &DbPool,
        id: &GitLabEnabledProjectId,
        webhook_id: i64,
        webhook_token_hmac: &str,
    ) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE gitlab_enabled_projects SET
                webhook_id = ?, webhook_token_hmac = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(webhook_id)
        .bind(webhook_token_hmac)
        .bind(&now)
        .bind(id.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Deactivates an enabled project.
    pub async fn deactivate(pool: &DbPool, id: &GitLabEnabledProjectId) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE gitlab_enabled_projects SET is_active = 0, updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id.to_string())
            .execute(pool)
            .await?;
        Ok(())
    }

    fn row_to_project(row: &sqlx::sqlite::SqliteRow) -> Result<GitLabEnabledProject> {
        let id_str: String = row.get("id");
        let credential_id_str: String = row.get("gitlab_credential_id");
        let repository_id_str: String = row.get("repository_id");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(GitLabEnabledProject {
            id: GitLabEnabledProjectId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            gitlab_credential_id: GitLabOAuthCredentialsId::from_string(&credential_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repository_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            project_id: row.get("project_id"),
            webhook_id: row.get("webhook_id"),
            webhook_token_hmac: row.get("webhook_token_hmac"),
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// OAuth State
// ============================================================================

/// OAuth state for CSRF protection and setup completion tracking.
#[derive(Debug, Clone)]
pub struct OAuthState {
    pub state: String,
    pub provider: String,
    pub instance_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub consumed_at: Option<DateTime<Utc>>,
    /// When the OAuth flow completed (app credentials stored)
    pub completed_at: Option<DateTime<Utc>>,
    /// Error message if the flow failed
    pub error_message: Option<String>,
    /// GitHub App ID (for status polling)
    pub app_id: Option<i64>,
    /// GitHub App name (for status polling)
    pub app_name: Option<String>,
}

/// OAuth state repository.
pub struct OAuthStateRepo;

impl OAuthStateRepo {
    /// Creates a new OAuth state.
    pub async fn create(pool: &DbPool, state: &OAuthState) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO oauth_state (
                state, provider, instance_url, created_at, expires_at, consumed_at,
                completed_at, error_message, app_id, app_name
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&state.state)
        .bind(&state.provider)
        .bind(&state.instance_url)
        .bind(state.created_at.to_rfc3339())
        .bind(state.expires_at.to_rfc3339())
        .bind(state.consumed_at.map(|t| t.to_rfc3339()))
        .bind(state.completed_at.map(|t| t.to_rfc3339()))
        .bind(&state.error_message)
        .bind(state.app_id)
        .bind(&state.app_name)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets an OAuth state by state token without consuming it (for status polling).
    pub async fn get_by_state(
        pool: &DbPool,
        state: &str,
        provider: &str,
    ) -> Result<Option<OAuthState>> {
        let row = sqlx::query(
            r#"
            SELECT state, provider, instance_url, created_at, expires_at, consumed_at,
                   completed_at, error_message, app_id, app_name
            FROM oauth_state
            WHERE state = ? AND provider = ?
            "#,
        )
        .bind(state)
        .bind(provider)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_state(&r)).transpose()
    }

    /// Atomically validates and consumes an OAuth state.
    /// Returns the state if valid and not yet consumed.
    pub async fn consume(
        pool: &DbPool,
        state: &str,
        provider: &str,
    ) -> Result<Option<OAuthState>> {
        let now = Utc::now();
        let now_str = now.to_rfc3339();

        // Use a transaction to ensure atomicity
        let mut tx = pool.begin().await?;

        // Try to consume the state atomically
        let result = sqlx::query(
            r#"
            UPDATE oauth_state
            SET consumed_at = ?
            WHERE state = ? AND provider = ? AND consumed_at IS NULL AND expires_at > ?
            "#,
        )
        .bind(&now_str)
        .bind(state)
        .bind(provider)
        .bind(&now_str)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 0 {
            tx.rollback().await?;
            return Ok(None);
        }

        // Fetch the consumed state
        let row = sqlx::query(
            r#"
            SELECT state, provider, instance_url, created_at, expires_at, consumed_at,
                   completed_at, error_message, app_id, app_name
            FROM oauth_state
            WHERE state = ?
            "#,
        )
        .bind(state)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        row.map(|r| Self::row_to_state(&r)).transpose()
    }

    /// Marks an OAuth state as completed with app info.
    pub async fn mark_completed(
        pool: &DbPool,
        state: &str,
        app_id: i64,
        app_name: &str,
    ) -> Result<bool> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            r#"
            UPDATE oauth_state
            SET completed_at = ?, app_id = ?, app_name = ?
            WHERE state = ?
            "#,
        )
        .bind(&now)
        .bind(app_id)
        .bind(app_name)
        .bind(state)
        .execute(pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Marks an OAuth state as failed with an error message.
    pub async fn mark_failed(pool: &DbPool, state: &str, error: &str) -> Result<bool> {
        let result = sqlx::query(
            r#"
            UPDATE oauth_state
            SET error_message = ?
            WHERE state = ?
            "#,
        )
        .bind(error)
        .bind(state)
        .execute(pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Deletes expired OAuth states.
    pub async fn delete_expired(pool: &DbPool) -> Result<u64> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query("DELETE FROM oauth_state WHERE expires_at < ?")
            .bind(&now)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Generates a new cryptographically random state token.
    pub fn generate_state() -> String {
        use rand::RngCore;
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        hex::encode(bytes)
    }

    /// Creates a new state with default expiry (10 minutes).
    pub fn new_state(provider: &str, instance_url: Option<String>) -> OAuthState {
        let now = Utc::now();
        OAuthState {
            state: Self::generate_state(),
            provider: provider.to_string(),
            instance_url,
            created_at: now,
            expires_at: now + Duration::minutes(10),
            consumed_at: None,
            completed_at: None,
            error_message: None,
            app_id: None,
            app_name: None,
        }
    }

    fn row_to_state(row: &sqlx::sqlite::SqliteRow) -> Result<OAuthState> {
        let created_at_str: String = row.get("created_at");
        let expires_at_str: String = row.get("expires_at");
        let consumed_at_str: Option<String> = row.get("consumed_at");
        let completed_at_str: Option<String> = row.get("completed_at");

        Ok(OAuthState {
            state: row.get("state"),
            provider: row.get("provider"),
            instance_url: row.get("instance_url"),
            created_at: parse_datetime(&created_at_str)?,
            expires_at: parse_datetime(&expires_at_str)?,
            consumed_at: consumed_at_str.map(|s| parse_datetime(&s)).transpose()?,
            completed_at: completed_at_str.map(|s| parse_datetime(&s)).transpose()?,
            error_message: row.get("error_message"),
            app_id: row.get("app_id"),
            app_name: row.get("app_name"),
        })
    }
}

// ============================================================================
// Webhook Deliveries
// ============================================================================

/// Webhook delivery record for replay detection.
#[derive(Debug, Clone)]
pub struct WebhookDelivery {
    pub provider: String,
    pub delivery_id: String,
    pub repository_id: Option<RepositoryId>,
    pub received_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Webhook delivery repository.
pub struct WebhookDeliveryRepo;

impl WebhookDeliveryRepo {
    /// Records a webhook delivery. Returns false if already exists (replay).
    pub async fn record(pool: &DbPool, delivery: &WebhookDelivery) -> Result<bool> {
        let result = sqlx::query(
            r#"
            INSERT OR IGNORE INTO webhook_deliveries (
                provider, delivery_id, repository_id, received_at, expires_at
            ) VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&delivery.provider)
        .bind(&delivery.delivery_id)
        .bind(delivery.repository_id.as_ref().map(|id| id.to_string()))
        .bind(delivery.received_at.to_rfc3339())
        .bind(delivery.expires_at.to_rfc3339())
        .execute(pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Checks if a delivery ID exists.
    pub async fn exists(pool: &DbPool, provider: &str, delivery_id: &str) -> Result<bool> {
        let row = sqlx::query(
            "SELECT 1 FROM webhook_deliveries WHERE provider = ? AND delivery_id = ? LIMIT 1",
        )
        .bind(provider)
        .bind(delivery_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.is_some())
    }

    /// Deletes expired deliveries.
    pub async fn delete_expired(pool: &DbPool) -> Result<u64> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query("DELETE FROM webhook_deliveries WHERE expires_at < ?")
            .bind(&now)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Creates a new delivery record with 1-hour TTL.
    pub fn new_delivery(
        provider: &str,
        delivery_id: &str,
        repository_id: Option<RepositoryId>,
    ) -> WebhookDelivery {
        let now = Utc::now();
        WebhookDelivery {
            provider: provider.to_string(),
            delivery_id: delivery_id.to_string(),
            repository_id,
            received_at: now,
            expires_at: now + Duration::hours(1),
        }
    }
}

// ============================================================================
// GitLab OAuth Apps (for self-hosted instances)
// ============================================================================

/// Unique identifier for GitLab OAuth app.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GitLabOAuthAppId(String);

impl GitLabOAuthAppId {
    pub fn new() -> Self {
        Self(ulid::Ulid::new().to_string())
    }

    pub fn from_string(s: &str) -> std::result::Result<Self, ulid::DecodeError> {
        ulid::Ulid::from_string(s)?;
        Ok(Self(s.to_string()))
    }
}

impl std::fmt::Display for GitLabOAuthAppId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for GitLabOAuthAppId {
    fn default() -> Self {
        Self::new()
    }
}

/// GitLab OAuth app credentials for a self-hosted instance.
#[derive(Debug, Clone)]
pub struct GitLabOAuthApp {
    pub id: GitLabOAuthAppId,
    pub instance_url: String,
    pub client_id: String,
    pub client_secret_encrypted: Vec<u8>,
    pub client_secret_nonce: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

/// GitLab OAuth app repository.
pub struct GitLabOAuthAppRepo;

impl GitLabOAuthAppRepo {
    /// Creates or updates OAuth app credentials for an instance.
    pub async fn upsert(pool: &DbPool, app: &GitLabOAuthApp) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO gitlab_oauth_apps (
                id, instance_url, client_id, client_secret_encrypted, client_secret_nonce, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(instance_url) DO UPDATE SET
                client_id = excluded.client_id,
                client_secret_encrypted = excluded.client_secret_encrypted,
                client_secret_nonce = excluded.client_secret_nonce
            "#,
        )
        .bind(app.id.to_string())
        .bind(&app.instance_url)
        .bind(&app.client_id)
        .bind(&app.client_secret_encrypted)
        .bind(&app.client_secret_nonce)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets OAuth app credentials for an instance.
    pub async fn get_by_instance(pool: &DbPool, instance_url: &str) -> Result<Option<GitLabOAuthApp>> {
        let row = sqlx::query(
            r#"
            SELECT id, instance_url, client_id, client_secret_encrypted, client_secret_nonce, created_at
            FROM gitlab_oauth_apps
            WHERE instance_url = ?
            "#,
        )
        .bind(instance_url)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_app(&r)).transpose()
    }

    /// Deletes OAuth app credentials for an instance.
    pub async fn delete_by_instance(pool: &DbPool, instance_url: &str) -> Result<()> {
        sqlx::query("DELETE FROM gitlab_oauth_apps WHERE instance_url = ?")
            .bind(instance_url)
            .execute(pool)
            .await?;
        Ok(())
    }

    fn row_to_app(row: &sqlx::sqlite::SqliteRow) -> Result<GitLabOAuthApp> {
        let id_str: String = row.get("id");
        let created_at_str: String = row.get("created_at");

        Ok(GitLabOAuthApp {
            id: GitLabOAuthAppId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            instance_url: row.get("instance_url"),
            client_id: row.get("client_id"),
            client_secret_encrypted: row.get("client_secret_encrypted"),
            client_secret_nonce: row.get("client_secret_nonce"),
            created_at: parse_datetime(&created_at_str)?,
        })
    }
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

/// Periodic cleanup task for expired state and deliveries.
pub async fn cleanup_expired(pool: &DbPool) -> Result<(u64, u64)> {
    let oauth_deleted = OAuthStateRepo::delete_expired(pool).await?;
    let webhook_deleted = WebhookDeliveryRepo::delete_expired(pool).await?;
    Ok((oauth_deleted, webhook_deleted))
}
