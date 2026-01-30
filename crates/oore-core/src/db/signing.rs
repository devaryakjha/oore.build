//! Database operations for code signing credentials.

use chrono::{DateTime, Utc};
use sqlx::Row;

use super::DbPool;
use crate::error::{OoreError, Result};
use crate::models::{
    AndroidKeystore, AndroidKeystoreId, AppStoreConnectApiKey, AppStoreConnectApiKeyId,
    IosCertificate, IosCertificateId, IosProfile, IosProfileId, RepositoryId,
};

// ============================================================================
// iOS Signing Certificates
// ============================================================================

/// iOS signing certificate repository.
pub struct IosCertificateRepo;

impl IosCertificateRepo {
    /// Creates a new iOS certificate.
    pub async fn create(pool: &DbPool, cert: &IosCertificate) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO ios_signing_certificates (
                id, repository_id, name, certificate_type,
                certificate_data_encrypted, certificate_data_nonce,
                password_encrypted, password_nonce,
                common_name, team_id, serial_number, expires_at,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(cert.id.to_string())
        .bind(cert.repository_id.to_string())
        .bind(&cert.name)
        .bind(cert.certificate_type.as_str())
        .bind(&cert.certificate_data_encrypted)
        .bind(&cert.certificate_data_nonce)
        .bind(&cert.password_encrypted)
        .bind(&cert.password_nonce)
        .bind(&cert.common_name)
        .bind(&cert.team_id)
        .bind(&cert.serial_number)
        .bind(cert.expires_at.map(|t| t.to_rfc3339()))
        .bind(cert.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a certificate by ID.
    pub async fn get_by_id(pool: &DbPool, id: &IosCertificateId) -> Result<Option<IosCertificate>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name, certificate_type,
                   certificate_data_encrypted, certificate_data_nonce,
                   password_encrypted, password_nonce,
                   common_name, team_id, serial_number, expires_at,
                   is_active, created_at, updated_at
            FROM ios_signing_certificates
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_cert(&r)).transpose()
    }

    /// Lists all active certificates for a repository.
    pub async fn list_active_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<IosCertificate>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, certificate_type,
                   certificate_data_encrypted, certificate_data_nonce,
                   password_encrypted, password_nonce,
                   common_name, team_id, serial_number, expires_at,
                   is_active, created_at, updated_at
            FROM ios_signing_certificates
            WHERE repository_id = ? AND is_active = 1
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_cert).collect()
    }

    /// Lists all certificates for a repository (including inactive).
    pub async fn list_all_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<IosCertificate>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, certificate_type,
                   certificate_data_encrypted, certificate_data_nonce,
                   password_encrypted, password_nonce,
                   common_name, team_id, serial_number, expires_at,
                   is_active, created_at, updated_at
            FROM ios_signing_certificates
            WHERE repository_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_cert).collect()
    }

    /// Deactivates a certificate.
    pub async fn deactivate(pool: &DbPool, id: &IosCertificateId) -> Result<bool> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "UPDATE ios_signing_certificates SET is_active = 0, updated_at = ? WHERE id = ?",
        )
        .bind(&now)
        .bind(id.to_string())
        .execute(pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Deletes a certificate.
    pub async fn delete(pool: &DbPool, id: &IosCertificateId) -> Result<bool> {
        let result = sqlx::query("DELETE FROM ios_signing_certificates WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Counts active certificates for a repository.
    pub async fn count_active_for_repo(pool: &DbPool, repository_id: &RepositoryId) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM ios_signing_certificates WHERE repository_id = ? AND is_active = 1",
        )
        .bind(repository_id.to_string())
        .fetch_one(pool)
        .await?;

        Ok(row.get("count"))
    }

    fn row_to_cert(row: &sqlx::sqlite::SqliteRow) -> Result<IosCertificate> {
        let id_str: String = row.get("id");
        let repo_id_str: String = row.get("repository_id");
        let cert_type_str: String = row.get("certificate_type");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");
        let expires_at_str: Option<String> = row.get("expires_at");

        Ok(IosCertificate {
            id: IosCertificateId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repo_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            certificate_type: cert_type_str
                .parse()
                .map_err(|e: String| OoreError::Database(sqlx::Error::Decode(Box::new(
                    std::io::Error::new(std::io::ErrorKind::InvalidData, e),
                ))))?,
            certificate_data_encrypted: row.get("certificate_data_encrypted"),
            certificate_data_nonce: row.get("certificate_data_nonce"),
            password_encrypted: row.get("password_encrypted"),
            password_nonce: row.get("password_nonce"),
            common_name: row.get("common_name"),
            team_id: row.get("team_id"),
            serial_number: row.get("serial_number"),
            expires_at: expires_at_str.map(|s| parse_datetime(&s)).transpose()?,
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// iOS Provisioning Profiles
// ============================================================================

/// iOS provisioning profile repository.
pub struct IosProfileRepo;

impl IosProfileRepo {
    /// Creates a new iOS profile.
    pub async fn create(pool: &DbPool, profile: &IosProfile) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO ios_provisioning_profiles (
                id, repository_id, name, profile_type,
                profile_data_encrypted, profile_data_nonce,
                bundle_identifier, team_id, uuid, app_id_name, expires_at,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(profile.id.to_string())
        .bind(profile.repository_id.to_string())
        .bind(&profile.name)
        .bind(profile.profile_type.as_str())
        .bind(&profile.profile_data_encrypted)
        .bind(&profile.profile_data_nonce)
        .bind(&profile.bundle_identifier)
        .bind(&profile.team_id)
        .bind(&profile.uuid)
        .bind(&profile.app_id_name)
        .bind(profile.expires_at.map(|t| t.to_rfc3339()))
        .bind(profile.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a profile by ID.
    pub async fn get_by_id(pool: &DbPool, id: &IosProfileId) -> Result<Option<IosProfile>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name, profile_type,
                   profile_data_encrypted, profile_data_nonce,
                   bundle_identifier, team_id, uuid, app_id_name, expires_at,
                   is_active, created_at, updated_at
            FROM ios_provisioning_profiles
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_profile(&r)).transpose()
    }

    /// Gets a profile by UUID for a repository.
    pub async fn get_by_uuid(
        pool: &DbPool,
        repository_id: &RepositoryId,
        uuid: &str,
    ) -> Result<Option<IosProfile>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name, profile_type,
                   profile_data_encrypted, profile_data_nonce,
                   bundle_identifier, team_id, uuid, app_id_name, expires_at,
                   is_active, created_at, updated_at
            FROM ios_provisioning_profiles
            WHERE repository_id = ? AND uuid = ?
            "#,
        )
        .bind(repository_id.to_string())
        .bind(uuid)
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_profile(&r)).transpose()
    }

    /// Lists all active profiles for a repository.
    pub async fn list_active_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<IosProfile>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, profile_type,
                   profile_data_encrypted, profile_data_nonce,
                   bundle_identifier, team_id, uuid, app_id_name, expires_at,
                   is_active, created_at, updated_at
            FROM ios_provisioning_profiles
            WHERE repository_id = ? AND is_active = 1
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_profile).collect()
    }

    /// Lists all profiles for a repository (including inactive).
    pub async fn list_all_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<IosProfile>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, profile_type,
                   profile_data_encrypted, profile_data_nonce,
                   bundle_identifier, team_id, uuid, app_id_name, expires_at,
                   is_active, created_at, updated_at
            FROM ios_provisioning_profiles
            WHERE repository_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_profile).collect()
    }

    /// Deactivates a profile.
    pub async fn deactivate(pool: &DbPool, id: &IosProfileId) -> Result<bool> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "UPDATE ios_provisioning_profiles SET is_active = 0, updated_at = ? WHERE id = ?",
        )
        .bind(&now)
        .bind(id.to_string())
        .execute(pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Deletes a profile.
    pub async fn delete(pool: &DbPool, id: &IosProfileId) -> Result<bool> {
        let result = sqlx::query("DELETE FROM ios_provisioning_profiles WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Counts active profiles for a repository.
    pub async fn count_active_for_repo(pool: &DbPool, repository_id: &RepositoryId) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM ios_provisioning_profiles WHERE repository_id = ? AND is_active = 1",
        )
        .bind(repository_id.to_string())
        .fetch_one(pool)
        .await?;

        Ok(row.get("count"))
    }

    fn row_to_profile(row: &sqlx::sqlite::SqliteRow) -> Result<IosProfile> {
        let id_str: String = row.get("id");
        let repo_id_str: String = row.get("repository_id");
        let profile_type_str: String = row.get("profile_type");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");
        let expires_at_str: Option<String> = row.get("expires_at");

        Ok(IosProfile {
            id: IosProfileId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repo_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            profile_type: profile_type_str
                .parse()
                .map_err(|e: String| OoreError::Database(sqlx::Error::Decode(Box::new(
                    std::io::Error::new(std::io::ErrorKind::InvalidData, e),
                ))))?,
            profile_data_encrypted: row.get("profile_data_encrypted"),
            profile_data_nonce: row.get("profile_data_nonce"),
            bundle_identifier: row.get("bundle_identifier"),
            team_id: row.get("team_id"),
            uuid: row.get("uuid"),
            app_id_name: row.get("app_id_name"),
            expires_at: expires_at_str.map(|s| parse_datetime(&s)).transpose()?,
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// App Store Connect API Keys
// ============================================================================

/// App Store Connect API key repository.
pub struct AppStoreConnectApiKeyRepo;

impl AppStoreConnectApiKeyRepo {
    /// Creates a new App Store Connect API key.
    pub async fn create(pool: &DbPool, key: &AppStoreConnectApiKey) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO appstore_connect_api_keys (
                id, repository_id, name, key_id, issuer_id,
                private_key_encrypted, private_key_nonce,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(key.id.to_string())
        .bind(key.repository_id.to_string())
        .bind(&key.name)
        .bind(&key.key_id)
        .bind(&key.issuer_id)
        .bind(&key.private_key_encrypted)
        .bind(&key.private_key_nonce)
        .bind(key.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets an API key by ID.
    pub async fn get_by_id(
        pool: &DbPool,
        id: &AppStoreConnectApiKeyId,
    ) -> Result<Option<AppStoreConnectApiKey>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name, key_id, issuer_id,
                   private_key_encrypted, private_key_nonce,
                   is_active, created_at, updated_at
            FROM appstore_connect_api_keys
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_api_key(&r)).transpose()
    }

    /// Lists all API keys for a repository (including inactive).
    pub async fn list_all_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<AppStoreConnectApiKey>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, key_id, issuer_id,
                   private_key_encrypted, private_key_nonce,
                   is_active, created_at, updated_at
            FROM appstore_connect_api_keys
            WHERE repository_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_api_key).collect()
    }

    /// Lists all active API keys for a repository.
    pub async fn list_active_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<AppStoreConnectApiKey>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name, key_id, issuer_id,
                   private_key_encrypted, private_key_nonce,
                   is_active, created_at, updated_at
            FROM appstore_connect_api_keys
            WHERE repository_id = ? AND is_active = 1
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_api_key).collect()
    }

    /// Deletes an API key.
    pub async fn delete(pool: &DbPool, id: &AppStoreConnectApiKeyId) -> Result<bool> {
        let result = sqlx::query("DELETE FROM appstore_connect_api_keys WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Counts active API keys for a repository.
    pub async fn count_active_for_repo(pool: &DbPool, repository_id: &RepositoryId) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM appstore_connect_api_keys WHERE repository_id = ? AND is_active = 1",
        )
        .bind(repository_id.to_string())
        .fetch_one(pool)
        .await?;

        Ok(row.get("count"))
    }

    fn row_to_api_key(row: &sqlx::sqlite::SqliteRow) -> Result<AppStoreConnectApiKey> {
        let id_str: String = row.get("id");
        let repo_id_str: String = row.get("repository_id");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(AppStoreConnectApiKey {
            id: AppStoreConnectApiKeyId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repo_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            key_id: row.get("key_id"),
            issuer_id: row.get("issuer_id"),
            private_key_encrypted: row.get("private_key_encrypted"),
            private_key_nonce: row.get("private_key_nonce"),
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
        })
    }
}

// ============================================================================
// Android Keystores
// ============================================================================

/// Android keystore repository.
pub struct AndroidKeystoreRepo;

impl AndroidKeystoreRepo {
    /// Creates a new Android keystore.
    pub async fn create(pool: &DbPool, keystore: &AndroidKeystore) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO android_keystores (
                id, repository_id, name,
                keystore_data_encrypted, keystore_data_nonce,
                keystore_password_encrypted, keystore_password_nonce,
                key_alias, key_password_encrypted, key_password_nonce,
                keystore_type, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(keystore.id.to_string())
        .bind(keystore.repository_id.to_string())
        .bind(&keystore.name)
        .bind(&keystore.keystore_data_encrypted)
        .bind(&keystore.keystore_data_nonce)
        .bind(&keystore.keystore_password_encrypted)
        .bind(&keystore.keystore_password_nonce)
        .bind(&keystore.key_alias)
        .bind(&keystore.key_password_encrypted)
        .bind(&keystore.key_password_nonce)
        .bind(keystore.keystore_type.as_str())
        .bind(keystore.is_active)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Gets a keystore by ID.
    pub async fn get_by_id(
        pool: &DbPool,
        id: &AndroidKeystoreId,
    ) -> Result<Option<AndroidKeystore>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name,
                   keystore_data_encrypted, keystore_data_nonce,
                   keystore_password_encrypted, keystore_password_nonce,
                   key_alias, key_password_encrypted, key_password_nonce,
                   keystore_type, is_active, created_at, updated_at
            FROM android_keystores
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_keystore(&r)).transpose()
    }

    /// Gets the active keystore for a repository.
    pub async fn get_active_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Option<AndroidKeystore>> {
        let row = sqlx::query(
            r#"
            SELECT id, repository_id, name,
                   keystore_data_encrypted, keystore_data_nonce,
                   keystore_password_encrypted, keystore_password_nonce,
                   key_alias, key_password_encrypted, key_password_nonce,
                   keystore_type, is_active, created_at, updated_at
            FROM android_keystores
            WHERE repository_id = ? AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_optional(pool)
        .await?;

        row.map(|r| Self::row_to_keystore(&r)).transpose()
    }

    /// Lists all active keystores for a repository.
    pub async fn list_active_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<AndroidKeystore>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name,
                   keystore_data_encrypted, keystore_data_nonce,
                   keystore_password_encrypted, keystore_password_nonce,
                   key_alias, key_password_encrypted, key_password_nonce,
                   keystore_type, is_active, created_at, updated_at
            FROM android_keystores
            WHERE repository_id = ? AND is_active = 1
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_keystore).collect()
    }

    /// Lists all keystores for a repository (including inactive).
    pub async fn list_all_for_repo(
        pool: &DbPool,
        repository_id: &RepositoryId,
    ) -> Result<Vec<AndroidKeystore>> {
        let rows = sqlx::query(
            r#"
            SELECT id, repository_id, name,
                   keystore_data_encrypted, keystore_data_nonce,
                   keystore_password_encrypted, keystore_password_nonce,
                   key_alias, key_password_encrypted, key_password_nonce,
                   keystore_type, is_active, created_at, updated_at
            FROM android_keystores
            WHERE repository_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(repository_id.to_string())
        .fetch_all(pool)
        .await?;

        rows.iter().map(Self::row_to_keystore).collect()
    }

    /// Deactivates a keystore.
    pub async fn deactivate(pool: &DbPool, id: &AndroidKeystoreId) -> Result<bool> {
        let now = Utc::now().to_rfc3339();
        let result =
            sqlx::query("UPDATE android_keystores SET is_active = 0, updated_at = ? WHERE id = ?")
                .bind(&now)
                .bind(id.to_string())
                .execute(pool)
                .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Deletes a keystore.
    pub async fn delete(pool: &DbPool, id: &AndroidKeystoreId) -> Result<bool> {
        let result = sqlx::query("DELETE FROM android_keystores WHERE id = ?")
            .bind(id.to_string())
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Counts active keystores for a repository.
    pub async fn count_active_for_repo(pool: &DbPool, repository_id: &RepositoryId) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM android_keystores WHERE repository_id = ? AND is_active = 1",
        )
        .bind(repository_id.to_string())
        .fetch_one(pool)
        .await?;

        Ok(row.get("count"))
    }

    fn row_to_keystore(row: &sqlx::sqlite::SqliteRow) -> Result<AndroidKeystore> {
        let id_str: String = row.get("id");
        let repo_id_str: String = row.get("repository_id");
        let keystore_type_str: String = row.get("keystore_type");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        Ok(AndroidKeystore {
            id: AndroidKeystoreId::from_string(&id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            repository_id: RepositoryId::from_string(&repo_id_str)
                .map_err(|e| OoreError::Database(sqlx::Error::Decode(Box::new(e))))?,
            name: row.get("name"),
            keystore_data_encrypted: row.get("keystore_data_encrypted"),
            keystore_data_nonce: row.get("keystore_data_nonce"),
            keystore_password_encrypted: row.get("keystore_password_encrypted"),
            keystore_password_nonce: row.get("keystore_password_nonce"),
            key_alias: row.get("key_alias"),
            key_password_encrypted: row.get("key_password_encrypted"),
            key_password_nonce: row.get("key_password_nonce"),
            keystore_type: keystore_type_str
                .parse()
                .map_err(|e: String| OoreError::Database(sqlx::Error::Decode(Box::new(
                    std::io::Error::new(std::io::ErrorKind::InvalidData, e),
                ))))?,
            is_active: row.get("is_active"),
            created_at: parse_datetime(&created_at_str)?,
            updated_at: parse_datetime(&updated_at_str)?,
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
