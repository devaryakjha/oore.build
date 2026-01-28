//! GitLab OAuth client and API utilities.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::db::credentials::{
    GitLabOAuthApp, GitLabOAuthAppId, GitLabOAuthCredentials, GitLabOAuthCredentialsId,
};
use crate::error::{OoreError, Result};

use super::{
    create_http_client, create_http_client_with_pinning, decrypt_with_aad, encrypt_with_aad,
    validate_gitlab_instance_url, EncryptionKey, SsrfConfig, ValidatedUrl,
};

const DEFAULT_GITLAB_URL: &str = "https://gitlab.com";

/// GitLab OAuth token response.
#[derive(Debug, Clone, Deserialize)]
pub struct GitLabTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
    pub created_at: i64,
    pub scope: Option<String>,
}

/// GitLab user info.
#[derive(Debug, Clone, Deserialize)]
pub struct GitLabUser {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub email: Option<String>,
}

/// GitLab project info.
#[derive(Debug, Clone, Deserialize)]
pub struct GitLabProject {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub path_with_namespace: String,
    pub visibility: String,
    pub default_branch: Option<String>,
    pub web_url: String,
    pub http_url_to_repo: String,
}

/// GitLab webhook info.
#[derive(Debug, Clone, Deserialize)]
pub struct GitLabWebhook {
    pub id: i64,
    pub url: String,
    pub push_events: bool,
    pub merge_requests_events: bool,
}

/// GitLab OAuth client.
pub struct GitLabClient {
    client: reqwest::Client,
    encryption_key: EncryptionKey,
    ssrf_config: SsrfConfig,
}

impl GitLabClient {
    /// Creates a new GitLab client.
    pub fn new(encryption_key: EncryptionKey) -> Result<Self> {
        let ssrf_config = SsrfConfig::from_env();
        let client = create_http_client(&ssrf_config)?;

        Ok(Self {
            client,
            encryption_key,
            ssrf_config,
        })
    }

    /// Validates and normalizes a GitLab instance URL.
    pub fn validate_instance_url(&self, url: &str) -> Result<ValidatedUrl> {
        validate_gitlab_instance_url(url, &self.ssrf_config)
    }

    /// Creates an HTTP client with IP pinning for a specific validated URL.
    ///
    /// This prevents DNS rebinding attacks by ensuring all requests go to
    /// the IPs that were validated during URL validation, not whatever
    /// DNS returns at request time.
    pub fn create_pinned_client(&self, validated_url: &ValidatedUrl) -> Result<reqwest::Client> {
        create_http_client_with_pinning(&self.ssrf_config, validated_url)
    }

    /// Gets the appropriate HTTP client for the given instance URL.
    ///
    /// For gitlab.com (trusted), uses the shared client.
    /// For self-hosted instances, re-validates and creates a pinned client
    /// to prevent DNS rebinding attacks.
    fn get_client_for_instance(&self, instance_url: &str) -> Result<reqwest::Client> {
        let normalized = instance_url.trim_end_matches('/').to_lowercase();

        // gitlab.com is trusted, use shared client
        if normalized == DEFAULT_GITLAB_URL.to_lowercase() || normalized.is_empty() {
            return Ok(self.client.clone());
        }

        // For self-hosted instances, validate and pin IPs to prevent DNS rebinding
        let validated = self.validate_instance_url(instance_url)?;
        self.create_pinned_client(&validated)
    }

    /// Builds the OAuth authorization URL.
    pub fn build_auth_url(
        &self,
        instance_url: &str,
        client_id: &str,
        redirect_uri: &str,
        state: &str,
    ) -> Result<String> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!(
            "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&state={}&scope=api",
            base,
            urlencoding::encode(client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(state)
        );

        Ok(url)
    }

    /// Exchanges an authorization code for tokens.
    pub async fn exchange_code(
        &self,
        instance_url: &str,
        client_id: &str,
        client_secret: &str,
        code: &str,
        redirect_uri: &str,
    ) -> Result<GitLabTokenResponse> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!("{}/oauth/token", base);
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .post(&url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("code", code),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri),
            ])
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab OAuth request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab OAuth error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse token response: {}", e)))
    }

    /// Refreshes an access token using the refresh token.
    pub async fn refresh_token(
        &self,
        instance_url: &str,
        client_id: &str,
        client_secret: &str,
        refresh_token: &str,
    ) -> Result<GitLabTokenResponse> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!("{}/oauth/token", base);
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .post(&url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab refresh request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab refresh error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse refresh response: {}", e)))
    }

    /// Gets the current user info.
    pub async fn get_user(&self, instance_url: &str, access_token: &str) -> Result<GitLabUser> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!("{}/api/v4/user", base);
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab API error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse user response: {}", e)))
    }

    /// Lists accessible projects.
    pub async fn list_projects(
        &self,
        instance_url: &str,
        access_token: &str,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<GitLabProject>> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!(
            "{}/api/v4/projects?membership=true&per_page={}&page={}",
            base, per_page, page
        );
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab API error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse projects response: {}", e)))
    }

    /// Gets a specific project.
    pub async fn get_project(
        &self,
        instance_url: &str,
        access_token: &str,
        project_id: i64,
    ) -> Result<GitLabProject> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!("{}/api/v4/projects/{}", base, project_id);
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab API error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse project response: {}", e)))
    }

    /// Creates a webhook for a project.
    pub async fn create_webhook(
        &self,
        instance_url: &str,
        access_token: &str,
        project_id: i64,
        webhook_url: &str,
        token: &str,
    ) -> Result<GitLabWebhook> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!("{}/api/v4/projects/{}/hooks", base, project_id);
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .json(&serde_json::json!({
                "url": webhook_url,
                "token": token,
                "push_events": true,
                "merge_requests_events": true,
                "enable_ssl_verification": true
            }))
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab API error {}: {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| OoreError::Provider(format!("Failed to parse webhook response: {}", e)))
    }

    /// Deletes a webhook from a project.
    pub async fn delete_webhook(
        &self,
        instance_url: &str,
        access_token: &str,
        project_id: i64,
        webhook_id: i64,
    ) -> Result<()> {
        let base = if instance_url.is_empty() {
            DEFAULT_GITLAB_URL.to_string()
        } else {
            instance_url.trim_end_matches('/').to_string()
        };

        let url = format!("{}/api/v4/projects/{}/hooks/{}", base, project_id, webhook_id);
        let client = self.get_client_for_instance(instance_url)?;

        let response = client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| OoreError::Provider(format!("GitLab API request failed: {}", e)))?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(OoreError::Provider(format!(
                "GitLab API error {}: {}",
                status, body
            )));
        }

        Ok(())
    }

    /// Creates OAuth credentials from token response.
    pub fn create_credentials(
        &self,
        instance_url: &str,
        token_response: &GitLabTokenResponse,
        user: &GitLabUser,
    ) -> Result<GitLabOAuthCredentials> {
        let id = GitLabOAuthCredentialsId::new();
        let id_str = id.to_string();
        let now = Utc::now();

        // Encrypt access token
        let (access_token_encrypted, access_token_nonce) = encrypt_with_aad(
            &self.encryption_key,
            token_response.access_token.as_bytes(),
            "gitlab_oauth_credentials",
            &id_str,
        )?;

        // Encrypt refresh token if present
        let (refresh_token_encrypted, refresh_token_nonce) =
            if let Some(ref refresh_token) = token_response.refresh_token {
                let (encrypted, nonce) = encrypt_with_aad(
                    &self.encryption_key,
                    refresh_token.as_bytes(),
                    "gitlab_oauth_credentials",
                    &id_str,
                )?;
                (Some(encrypted), Some(nonce))
            } else {
                (None, None)
            };

        // Calculate expiry
        let token_expires_at = token_response.expires_in.map(|secs| now + Duration::seconds(secs));

        Ok(GitLabOAuthCredentials {
            id,
            instance_url: instance_url.to_string(),
            access_token_encrypted,
            access_token_nonce,
            refresh_token_encrypted,
            refresh_token_nonce,
            token_expires_at,
            user_id: user.id,
            username: user.username.clone(),
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    /// Decrypts the access token from stored credentials.
    pub fn decrypt_access_token(&self, creds: &GitLabOAuthCredentials) -> Result<String> {
        let decrypted = decrypt_with_aad(
            &self.encryption_key,
            &creds.access_token_encrypted,
            &creds.access_token_nonce,
            "gitlab_oauth_credentials",
            &creds.id.to_string(),
        )?;

        String::from_utf8(decrypted)
            .map_err(|e| OoreError::Encryption(format!("Invalid UTF-8 in access token: {}", e)))
    }

    /// Decrypts the refresh token from stored credentials.
    pub fn decrypt_refresh_token(&self, creds: &GitLabOAuthCredentials) -> Result<Option<String>> {
        match (&creds.refresh_token_encrypted, &creds.refresh_token_nonce) {
            (Some(encrypted), Some(nonce)) => {
                let decrypted = decrypt_with_aad(
                    &self.encryption_key,
                    encrypted,
                    nonce,
                    "gitlab_oauth_credentials",
                    &creds.id.to_string(),
                )?;

                let token = String::from_utf8(decrypted).map_err(|e| {
                    OoreError::Encryption(format!("Invalid UTF-8 in refresh token: {}", e))
                })?;

                Ok(Some(token))
            }
            _ => Ok(None),
        }
    }

    /// Checks if token needs refresh (expires within 5 minutes).
    pub fn token_needs_refresh(&self, creds: &GitLabOAuthCredentials) -> bool {
        if let Some(expires_at) = creds.token_expires_at {
            let refresh_threshold = Utc::now() + Duration::minutes(5);
            expires_at <= refresh_threshold
        } else {
            false // No expiry set, assume token doesn't expire
        }
    }

    /// Creates encrypted new tokens for update.
    #[allow(clippy::type_complexity)]
    pub fn encrypt_new_tokens(
        &self,
        creds_id: &GitLabOAuthCredentialsId,
        token_response: &GitLabTokenResponse,
    ) -> Result<(Vec<u8>, Vec<u8>, Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)> {
        let id_str = creds_id.to_string();
        let now = Utc::now();

        let (access_token_encrypted, access_token_nonce) = encrypt_with_aad(
            &self.encryption_key,
            token_response.access_token.as_bytes(),
            "gitlab_oauth_credentials",
            &id_str,
        )?;

        let (refresh_token_encrypted, refresh_token_nonce) =
            if let Some(ref refresh_token) = token_response.refresh_token {
                let (encrypted, nonce) = encrypt_with_aad(
                    &self.encryption_key,
                    refresh_token.as_bytes(),
                    "gitlab_oauth_credentials",
                    &id_str,
                )?;
                (Some(encrypted), Some(nonce))
            } else {
                (None, None)
            };

        let token_expires_at = token_response.expires_in.map(|secs| now + Duration::seconds(secs));

        Ok((
            access_token_encrypted,
            access_token_nonce,
            refresh_token_encrypted,
            refresh_token_nonce,
            token_expires_at,
        ))
    }

    /// Creates a GitLab OAuth app record.
    pub fn create_oauth_app(
        &self,
        instance_url: &str,
        client_id: &str,
        client_secret: &str,
    ) -> Result<GitLabOAuthApp> {
        let id = GitLabOAuthAppId::new();
        let id_str = id.to_string();
        let now = Utc::now();

        let (client_secret_encrypted, client_secret_nonce) = encrypt_with_aad(
            &self.encryption_key,
            client_secret.as_bytes(),
            "gitlab_oauth_apps",
            &id_str,
        )?;

        Ok(GitLabOAuthApp {
            id,
            instance_url: instance_url.to_string(),
            client_id: client_id.to_string(),
            client_secret_encrypted,
            client_secret_nonce,
            created_at: now,
        })
    }

    /// Decrypts the client secret from an OAuth app record.
    pub fn decrypt_client_secret(&self, app: &GitLabOAuthApp) -> Result<String> {
        let decrypted = decrypt_with_aad(
            &self.encryption_key,
            &app.client_secret_encrypted,
            &app.client_secret_nonce,
            "gitlab_oauth_apps",
            &app.id.to_string(),
        )?;

        String::from_utf8(decrypted)
            .map_err(|e| OoreError::Encryption(format!("Invalid UTF-8 in client secret: {}", e)))
    }
}

/// Gets OAuth app credentials for an instance.
/// Falls back to environment variables for gitlab.com.
pub fn get_oauth_app_credentials(
    instance_url: &str,
    db_app: Option<&GitLabOAuthApp>,
    client: &GitLabClient,
) -> Result<(String, String)> {
    // Check database first
    if let Some(app) = db_app {
        let client_secret = client.decrypt_client_secret(app)?;
        return Ok((app.client_id.clone(), client_secret));
    }

    // Fall back to env vars for gitlab.com
    let normalized = instance_url.trim_end_matches('/').to_lowercase();
    if normalized == DEFAULT_GITLAB_URL.to_lowercase() || normalized.is_empty() {
        let client_id = std::env::var("OORE_GITLAB_CLIENT_ID").map_err(|_| {
            OoreError::Configuration(
                "OORE_GITLAB_CLIENT_ID not set. Register an OAuth app at gitlab.com.".to_string(),
            )
        })?;

        let client_secret = std::env::var("OORE_GITLAB_CLIENT_SECRET").map_err(|_| {
            OoreError::Configuration("OORE_GITLAB_CLIENT_SECRET not set.".to_string())
        })?;

        return Ok((client_id, client_secret));
    }

    Err(OoreError::Configuration(format!(
        "No OAuth app registered for instance {}. Use 'oore gitlab register' first.",
        instance_url
    )))
}

/// Response for GitLab credentials status.
#[derive(Debug, Serialize)]
pub struct GitLabCredentialsStatus {
    pub id: String,
    pub configured: bool,
    pub instance_url: Option<String>,
    pub username: Option<String>,
    pub user_id: Option<i64>,
    pub token_expires_at: Option<String>,
    pub needs_refresh: bool,
    pub enabled_projects_count: usize,
}

impl GitLabCredentialsStatus {
    pub fn not_configured() -> Self {
        Self {
            id: String::new(),
            configured: false,
            instance_url: None,
            username: None,
            user_id: None,
            token_expires_at: None,
            needs_refresh: false,
            enabled_projects_count: 0,
        }
    }

    pub fn from_credentials(
        creds: &GitLabOAuthCredentials,
        client: &GitLabClient,
        enabled_projects_count: usize,
    ) -> Self {
        Self {
            id: creds.id.to_string(),
            configured: true,
            instance_url: Some(creds.instance_url.clone()),
            username: Some(creds.username.clone()),
            user_id: Some(creds.user_id),
            token_expires_at: creds.token_expires_at.map(|t| t.to_rfc3339()),
            needs_refresh: client.token_needs_refresh(creds),
            enabled_projects_count,
        }
    }
}

/// Project info for API response.
#[derive(Debug, Serialize)]
pub struct GitLabProjectInfo {
    pub id: i64,
    pub name: String,
    pub path_with_namespace: String,
    pub web_url: String,
    pub visibility: String,
    pub default_branch: Option<String>,
    pub ci_enabled: bool,
}

impl GitLabProjectInfo {
    pub fn from_api_project(project: &GitLabProject, ci_enabled: bool) -> Self {
        Self {
            id: project.id,
            name: project.name.clone(),
            path_with_namespace: project.path_with_namespace.clone(),
            web_url: project.web_url.clone(),
            visibility: project.visibility.clone(),
            default_branch: project.default_branch.clone(),
            ci_enabled,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_auth_url() {
        let encryption_key = EncryptionKey::from_string(
            "K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=",
        )
        .unwrap();
        let client = GitLabClient {
            client: reqwest::Client::new(),
            encryption_key,
            ssrf_config: SsrfConfig::default(),
        };

        let url = client
            .build_auth_url(
                "https://gitlab.com",
                "client123",
                "https://ci.example.com/callback",
                "state456",
            )
            .unwrap();

        assert!(url.starts_with("https://gitlab.com/oauth/authorize"));
        assert!(url.contains("client_id=client123"));
        assert!(url.contains("state=state456"));
        assert!(url.contains("scope=api"));
    }
}
