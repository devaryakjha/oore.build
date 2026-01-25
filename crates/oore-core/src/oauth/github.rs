//! GitHub App manifest flow and API client.

use serde::{Deserialize, Serialize};
use url::Url;

use crate::db::credentials::{
    GitHubAppCredentials, GitHubAppCredentialsId, GitHubAppInstallation, GitHubInstallationId,
    GitHubInstallationRepoId, GitHubInstallationRepository,
};
use crate::error::{OoreError, Result};

use super::{decrypt_with_aad, encrypt_with_aad, EncryptionKey};

const GITHUB_API_BASE: &str = "https://api.github.com";

/// GitHub App manifest for creating a new app.
#[derive(Debug, Clone, Serialize)]
pub struct GitHubAppManifest {
    pub name: String,
    pub url: String,
    pub hook_attributes: HookAttributes,
    pub redirect_url: String,
    pub public: bool,
    pub default_permissions: DefaultPermissions,
    pub default_events: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HookAttributes {
    pub url: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DefaultPermissions {
    pub contents: String,
    pub metadata: String,
    pub statuses: String,
    pub checks: String,
}

impl GitHubAppManifest {
    /// Creates a new manifest with the given base URL.
    pub fn new(base_url: &Url, app_name: Option<&str>) -> Self {
        let name = app_name.unwrap_or("Oore CI").to_string();
        let webhook_url = format!("{}api/webhooks/github", base_url);
        let redirect_url = format!("{}setup/github/callback", base_url);

        Self {
            name,
            url: base_url.to_string(),
            hook_attributes: HookAttributes {
                url: webhook_url,
                active: true,
            },
            redirect_url,
            public: false,
            default_permissions: DefaultPermissions {
                contents: "read".to_string(),
                metadata: "read".to_string(),
                statuses: "write".to_string(),
                checks: "write".to_string(),
            },
            // Only events that match our permissions
            // - push: requires contents:read
            // - check_run, check_suite: requires checks:write
            // Note: installation events are sent automatically to all GitHub Apps
            default_events: vec![
                "push".to_string(),
                "check_run".to_string(),
                "check_suite".to_string(),
            ],
        }
    }
}

/// Response from GitHub after manifest conversion.
#[derive(Debug, Clone, Deserialize)]
pub struct GitHubAppFromManifest {
    pub id: i64,
    pub slug: String,
    pub node_id: String,
    pub name: String,
    pub owner: GitHubOwner,
    pub client_id: String,
    pub client_secret: String,
    pub webhook_secret: String,
    pub pem: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GitHubOwner {
    pub login: String,
    pub id: i64,
    #[serde(rename = "type")]
    pub owner_type: String, // "User" or "Organization"
}

/// GitHub installation info from API.
#[derive(Debug, Clone, Deserialize)]
pub struct GitHubInstallationResponse {
    pub id: i64,
    pub account: GitHubAccount,
    pub repository_selection: String,
    pub permissions: serde_json::Value,
    pub events: Vec<String>,
    pub suspended_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GitHubAccount {
    pub login: String,
    pub id: i64,
    #[serde(rename = "type")]
    pub account_type: String,
}

/// Repository info from installation.
#[derive(Debug, Clone, Deserialize)]
pub struct GitHubRepoResponse {
    pub id: i64,
    pub full_name: String,
    pub private: bool,
}

/// GitHub API client.
pub struct GitHubClient {
    client: reqwest::Client,
    encryption_key: EncryptionKey,
}

impl GitHubClient {
    /// Creates a new GitHub client.
    pub fn new(encryption_key: EncryptionKey) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent("oore-ci/0.1.0")
            .build()
            .map_err(|e| OoreError::Configuration(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            client,
            encryption_key,
        })
    }

    /// Exchanges a manifest code for app credentials.
    pub async fn exchange_manifest_code(&self, code: &str) -> Result<GitHubAppFromManifest> {
        let url = format!(
            "https://api.github.com/app-manifests/{}/conversions",
            code
        );

        let response = self
            .client
            .post(&url)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitHub API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitHub API error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse GitHub response: {}", e)))
    }

    /// Converts GitHub API response to database credentials.
    pub fn create_credentials(
        &self,
        app: &GitHubAppFromManifest,
    ) -> Result<GitHubAppCredentials> {
        let id = GitHubAppCredentialsId::new();
        let id_str = id.to_string();

        // Encrypt sensitive fields with AAD
        let (private_key_encrypted, private_key_nonce) = encrypt_with_aad(
            &self.encryption_key,
            app.pem.as_bytes(),
            "github_app_credentials",
            &id_str,
        )?;

        let (webhook_secret_encrypted, webhook_secret_nonce) = encrypt_with_aad(
            &self.encryption_key,
            app.webhook_secret.as_bytes(),
            "github_app_credentials",
            &id_str,
        )?;

        let (client_secret_encrypted, client_secret_nonce) = encrypt_with_aad(
            &self.encryption_key,
            app.client_secret.as_bytes(),
            "github_app_credentials",
            &id_str,
        )?;

        let now = chrono::Utc::now();

        Ok(GitHubAppCredentials {
            id,
            app_id: app.id,
            app_name: app.name.clone(),
            app_slug: app.slug.clone(),
            owner_login: app.owner.login.clone(),
            owner_type: app.owner.owner_type.clone(),
            private_key_encrypted,
            private_key_nonce,
            webhook_secret_encrypted,
            webhook_secret_nonce,
            client_id: Some(app.client_id.clone()),
            client_secret_encrypted: Some(client_secret_encrypted),
            client_secret_nonce: Some(client_secret_nonce),
            html_url: app.html_url.clone(),
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    /// Decrypts the private key from stored credentials.
    pub fn decrypt_private_key(&self, creds: &GitHubAppCredentials) -> Result<String> {
        let decrypted = decrypt_with_aad(
            &self.encryption_key,
            &creds.private_key_encrypted,
            &creds.private_key_nonce,
            "github_app_credentials",
            &creds.id.to_string(),
        )?;

        String::from_utf8(decrypted)
            .map_err(|e| OoreError::Encryption(format!("Invalid UTF-8 in private key: {}", e)))
    }

    /// Decrypts the webhook secret from stored credentials.
    pub fn decrypt_webhook_secret(&self, creds: &GitHubAppCredentials) -> Result<String> {
        let decrypted = decrypt_with_aad(
            &self.encryption_key,
            &creds.webhook_secret_encrypted,
            &creds.webhook_secret_nonce,
            "github_app_credentials",
            &creds.id.to_string(),
        )?;

        String::from_utf8(decrypted)
            .map_err(|e| OoreError::Encryption(format!("Invalid UTF-8 in webhook secret: {}", e)))
    }

    /// Generates a JWT for GitHub App authentication.
    pub fn generate_app_jwt(&self, creds: &GitHubAppCredentials) -> Result<String> {
        use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};

        let private_key = self.decrypt_private_key(creds)?;

        let now = chrono::Utc::now();
        let iat = now.timestamp() - 60; // 1 minute in the past
        let exp = now.timestamp() + 600; // 10 minutes from now

        #[derive(Debug, Serialize)]
        struct Claims {
            iat: i64,
            exp: i64,
            iss: String,
        }

        let claims = Claims {
            iat,
            exp,
            iss: creds.app_id.to_string(),
        };

        let header = Header::new(Algorithm::RS256);
        let key = EncodingKey::from_rsa_pem(private_key.as_bytes())
            .map_err(|e| OoreError::Encryption(format!("Invalid RSA private key: {}", e)))?;

        encode(&header, &claims, &key)
            .map_err(|e| OoreError::Encryption(format!("Failed to generate JWT: {}", e)))
    }

    /// Gets an installation access token.
    pub async fn get_installation_token(
        &self,
        creds: &GitHubAppCredentials,
        installation_id: i64,
    ) -> Result<String> {
        let jwt = self.generate_app_jwt(creds)?;

        let url = format!(
            "{}/app/installations/{}/access_tokens",
            GITHUB_API_BASE, installation_id
        );

        let response = self
            .client
            .post(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {}", jwt))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitHub API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitHub API error {}: {}",
                status, body
            )));
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            token: String,
        }

        let token_response: TokenResponse = response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse token response: {}", e)))?;

        Ok(token_response.token)
    }

    /// Lists all installations for the app.
    pub async fn list_installations(
        &self,
        creds: &GitHubAppCredentials,
    ) -> Result<Vec<GitHubInstallationResponse>> {
        let jwt = self.generate_app_jwt(creds)?;

        let url = format!("{}/app/installations", GITHUB_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {}", jwt))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitHub API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitHub API error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse installations: {}", e)))
    }

    /// Lists repositories accessible to an installation.
    pub async fn list_installation_repos(
        &self,
        creds: &GitHubAppCredentials,
        installation_id: i64,
    ) -> Result<Vec<GitHubRepoResponse>> {
        let token = self.get_installation_token(creds, installation_id).await?;

        let url = format!("{}/installation/repositories", GITHUB_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitHub API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitHub API error {}: {}",
                status, body
            )));
        }

        #[derive(Deserialize)]
        struct ReposResponse {
            repositories: Vec<GitHubRepoResponse>,
        }

        let repos: ReposResponse = response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse repositories: {}", e)))?;

        Ok(repos.repositories)
    }

    /// Converts API installation to database model.
    pub fn to_installation_model(
        &self,
        app_id: &GitHubAppCredentialsId,
        installation: &GitHubInstallationResponse,
    ) -> GitHubAppInstallation {
        let now = chrono::Utc::now();

        GitHubAppInstallation {
            id: GitHubInstallationId::new(),
            github_app_id: app_id.clone(),
            installation_id: installation.id,
            account_login: installation.account.login.clone(),
            account_type: installation.account.account_type.clone(),
            account_id: installation.account.id,
            repository_selection: installation.repository_selection.clone(),
            permissions: installation.permissions.to_string(),
            events: serde_json::to_string(&installation.events).unwrap_or_default(),
            is_active: installation.suspended_at.is_none(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Converts API repo to database model.
    pub fn to_repo_model(
        &self,
        installation_id: &GitHubInstallationId,
        repo: &GitHubRepoResponse,
    ) -> GitHubInstallationRepository {
        let now = chrono::Utc::now();

        GitHubInstallationRepository {
            id: GitHubInstallationRepoId::new(),
            installation_id: installation_id.clone(),
            github_repository_id: repo.id,
            full_name: repo.full_name.clone(),
            is_private: repo.private,
            created_at: now,
        }
    }
}

/// Builds the GitHub manifest creation URL.
pub fn build_manifest_create_url(state: &str) -> String {
    format!(
        "https://github.com/settings/apps/new?state={}",
        urlencoding::encode(state)
    )
}

/// Response for the manifest endpoint.
#[derive(Debug, Serialize)]
pub struct ManifestResponse {
    pub manifest: GitHubAppManifest,
    pub create_url: String,
    pub state: String,
}

/// Response for GitHub App status.
#[derive(Debug, Serialize)]
pub struct GitHubAppStatus {
    pub configured: bool,
    pub app_id: Option<i64>,
    pub app_name: Option<String>,
    pub app_slug: Option<String>,
    pub owner_login: Option<String>,
    pub owner_type: Option<String>,
    pub html_url: Option<String>,
    pub installations_count: usize,
}

impl GitHubAppStatus {
    pub fn not_configured() -> Self {
        Self {
            configured: false,
            app_id: None,
            app_name: None,
            app_slug: None,
            owner_login: None,
            owner_type: None,
            html_url: None,
            installations_count: 0,
        }
    }

    pub fn from_credentials(creds: &GitHubAppCredentials, installations_count: usize) -> Self {
        Self {
            configured: true,
            app_id: Some(creds.app_id),
            app_name: Some(creds.app_name.clone()),
            app_slug: Some(creds.app_slug.clone()),
            owner_login: Some(creds.owner_login.clone()),
            owner_type: Some(creds.owner_type.clone()),
            html_url: Some(creds.html_url.clone()),
            installations_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_creation() {
        let base_url = Url::parse("https://ci.example.com/").unwrap();
        let manifest = GitHubAppManifest::new(&base_url, None);

        assert_eq!(manifest.name, "Oore CI");
        assert_eq!(manifest.url, "https://ci.example.com/");
        assert_eq!(
            manifest.hook_attributes.url,
            "https://ci.example.com/api/webhooks/github"
        );
        assert_eq!(
            manifest.redirect_url,
            "https://ci.example.com/setup/github/callback"
        );
        assert!(!manifest.public);
    }

    #[test]
    fn test_build_manifest_url() {
        let state = "abc123";
        let url = build_manifest_create_url(state);
        assert_eq!(url, "https://github.com/settings/apps/new?state=abc123");
    }
}
