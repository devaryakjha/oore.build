//! GitHub App manifest flow and API client.

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use url::Url;

use crate::db::credentials::{
    GitHubAppCredentials, GitHubAppCredentialsId, GitHubAppInstallation, GitHubInstallationId,
    GitHubInstallationRepoId, GitHubInstallationRepository,
};
use crate::error::{OoreError, Result};

use super::{decrypt_with_aad, encrypt_with_aad, EncryptionKey};

const GITHUB_API_BASE: &str = "https://api.github.com";

/// GitHub App manifest for creating a new app.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct GitHubAppManifest {
    pub name: String,
    pub url: String,
    pub hook_attributes: HookAttributes,
    pub redirect_url: String,
    /// URL to redirect users after they install the app
    pub setup_url: String,
    pub public: bool,
    pub default_permissions: DefaultPermissions,
    pub default_events: Vec<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct HookAttributes {
    pub url: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct DefaultPermissions {
    pub contents: String,
    pub metadata: String,
    pub statuses: String,
    pub checks: String,
}

impl GitHubAppManifest {
    /// Creates a new manifest with the given base URL.
    ///
    /// # Panics
    /// Panics if the base URL cannot be joined with the path segments (should never happen
    /// with a valid base URL).
    pub fn new(base_url: &Url, app_name: Option<&str>) -> Self {
        let name = app_name.unwrap_or("Oore CI").to_string();
        // Use proper URL joining to handle trailing slashes correctly
        let webhook_url = base_url
            .join("api/webhooks/github")
            .expect("valid base URL should join with path")
            .to_string();
        let redirect_url = base_url
            .join("setup/github/callback")
            .expect("valid base URL should join with path")
            .to_string();
        let setup_url = base_url
            .join("setup/github/installed")
            .expect("valid base URL should join with path")
            .to_string();

        Self {
            name,
            url: base_url.to_string(),
            hook_attributes: HookAttributes {
                url: webhook_url,
                active: true,
            },
            redirect_url,
            setup_url,
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
        // GitHub requires JWT lifetime to be no longer than 10 minutes total.
        // We set iat to current time and exp to 9 minutes to allow for clock skew
        // while staying within the 10-minute limit.
        let iat = now.timestamp();
        let exp = now.timestamp() + 540; // 9 minutes from now (allows 1 min clock skew)

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

    /// Default maximum repositories to fetch per installation.
    /// Can be overridden with GITHUB_MAX_REPOS_PER_INSTALLATION environment variable.
    const DEFAULT_MAX_REPOS: usize = 1000;

    /// Lists repositories accessible to an installation (with pagination).
    ///
    /// Limits the number of repositories fetched to prevent resource exhaustion.
    /// Configure via `GITHUB_MAX_REPOS_PER_INSTALLATION` environment variable.
    pub async fn list_installation_repos(
        &self,
        creds: &GitHubAppCredentials,
        installation_id: i64,
    ) -> Result<Vec<GitHubRepoResponse>> {
        let max_repos: usize = std::env::var("GITHUB_MAX_REPOS_PER_INSTALLATION")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(Self::DEFAULT_MAX_REPOS);

        let token = self.get_installation_token(creds, installation_id).await?;

        #[derive(Deserialize)]
        struct ReposResponse {
            repositories: Vec<GitHubRepoResponse>,
            #[allow(dead_code)]
            total_count: i64,
        }

        let mut all_repos = Vec::new();
        let mut page = 1i64;
        let per_page = 100; // Max allowed by GitHub

        loop {
            let url = format!(
                "{}/installation/repositories?per_page={}&page={}",
                GITHUB_API_BASE, per_page, page
            );

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

            let repos: ReposResponse = response
                .json()
                .await
                .map_err(|e| OoreError::Provider(format!("Failed to parse repositories: {}", e)))?;

            let fetched_count = repos.repositories.len();
            all_repos.extend(repos.repositories);

            // Log progress for large syncs
            if all_repos.len() >= 500 && all_repos.len() % 500 < per_page as usize {
                tracing::debug!(
                    "Fetching repositories for installation {}: {} so far",
                    installation_id,
                    all_repos.len()
                );
            }

            // If we got fewer than per_page, we've reached the end
            if fetched_count < per_page as usize {
                break;
            }

            // Check if we've hit the configured limit
            if all_repos.len() >= max_repos {
                tracing::warn!(
                    "Reached repository limit ({}) for installation {}. \
                     Set GITHUB_MAX_REPOS_PER_INSTALLATION to increase.",
                    max_repos,
                    installation_id
                );
                break;
            }

            page = page.saturating_add(1);

            // Safety limit to prevent infinite loops (in case of API issues)
            if page > 100 {
                tracing::warn!(
                    "Reached pagination safety limit for installation {}",
                    installation_id
                );
                break;
            }
        }

        Ok(all_repos)
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

    /// Posts a commit status to GitHub.
    ///
    /// This updates the status check shown on commits and pull requests.
    ///
    /// # Arguments
    /// * `creds` - GitHub App credentials
    /// * `installation_id` - GitHub installation ID
    /// * `owner` - Repository owner
    /// * `repo` - Repository name
    /// * `sha` - Commit SHA
    /// * `state` - Status state: "pending", "success", "failure", or "error"
    /// * `description` - Short description (max 140 characters)
    /// * `target_url` - URL to link to from the status
    pub async fn post_commit_status(
        &self,
        creds: &GitHubAppCredentials,
        installation_id: i64,
        owner: &str,
        repo: &str,
        sha: &str,
        state: &str,
        description: &str,
        target_url: &str,
    ) -> Result<()> {
        let token = self.get_installation_token(creds, installation_id).await?;

        let url = format!(
            "{}/repos/{}/{}/statuses/{}",
            GITHUB_API_BASE, owner, repo, sha
        );

        let response = self
            .client
            .post(&url)
            .header("Accept", "application/vnd.github+json")
            .header("Authorization", format!("Bearer {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&serde_json::json!({
                "state": state,
                "description": description,
                "target_url": target_url,
                "context": "oore-ci/build"
            }))
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitHub API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!(
                "Failed to post GitHub commit status ({}): {}",
                status,
                body
            );
            return Err(OoreError::Provider(format!(
                "GitHub API error {}: {}",
                status, body
            )));
        }

        tracing::debug!(
            "Posted GitHub commit status: {} on {}/{} @ {}",
            state,
            owner,
            repo,
            &sha[..7.min(sha.len())]
        );

        Ok(())
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
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct ManifestResponse {
    pub manifest: GitHubAppManifest,
    pub create_url: String,
    pub state: String,
}

/// Response for GitHub App status.
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct GitHubAppStatus {
    pub configured: bool,
    #[ts(optional, type = "number")]
    pub app_id: Option<i64>,
    #[ts(optional)]
    pub app_name: Option<String>,
    #[ts(optional)]
    pub app_slug: Option<String>,
    #[ts(optional)]
    pub owner_login: Option<String>,
    #[ts(optional)]
    pub owner_type: Option<String>,
    #[ts(optional)]
    pub html_url: Option<String>,
    #[ts(type = "number")]
    pub installations_count: usize,
    #[ts(optional)]
    pub created_at: Option<String>,
}

impl GitHubAppStatus {
    pub fn not_configured() -> Self {
        Self {
            configured: false,
            app_id: None,
            app_name: None,
            app_slug: None,
            owner_login: None,
            created_at: None,
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
            created_at: Some(creds.created_at.to_rfc3339()),
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
