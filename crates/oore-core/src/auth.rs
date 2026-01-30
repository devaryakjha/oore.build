//! Repository authentication token management.
//!
//! Provides a unified interface for obtaining authentication tokens to clone
//! private repositories from GitHub and GitLab.

use crate::db::credentials::{
    GitHubAppCredentialsRepo, GitLabEnabledProjectRepo, GitLabOAuthAppRepo,
    GitLabOAuthCredentials, GitLabOAuthCredentialsRepo,
};
use crate::db::DbPool;
use crate::error::{OoreError, Result};
use crate::models::{GitProvider, Repository};
use crate::oauth::github::GitHubClient;
use crate::oauth::gitlab::GitLabClient;
use crate::oauth::EncryptionKey;

/// Gets an authentication token for repository access.
///
/// Returns:
/// - `Ok(Some(token))` if credentials are configured and valid
/// - `Ok(None)` if repository is public or no credentials configured
/// - `Err(...)` if credentials are configured but invalid/expired
pub async fn get_repository_auth_token(
    db: &DbPool,
    encryption_key: &EncryptionKey,
    repository: &Repository,
) -> Result<Option<String>> {
    match repository.provider {
        GitProvider::GitHub => get_github_token(db, encryption_key, repository).await,
        GitProvider::GitLab => get_gitlab_token(db, encryption_key, repository).await,
    }
}

/// Gets a GitHub installation access token for the repository.
async fn get_github_token(
    db: &DbPool,
    encryption_key: &EncryptionKey,
    repository: &Repository,
) -> Result<Option<String>> {
    // Check if we have an installation ID for this repo
    let installation_id = match repository.github_installation_id {
        Some(id) => id,
        None => {
            tracing::debug!(
                "Repository {} has no github_installation_id, assuming public",
                repository.id
            );
            return Ok(None);
        }
    };

    // Get GitHub App credentials
    let creds = GitHubAppCredentialsRepo::get_active(db)
        .await?
        .ok_or_else(|| {
            OoreError::Configuration(
                "GitHub App not configured. Run 'oore github setup' first.".to_string(),
            )
        })?;

    // Create client and mint installation token
    let client = GitHubClient::new(encryption_key.clone())?;
    let token = client.get_installation_token(&creds, installation_id).await?;

    tracing::debug!(
        "Minted GitHub installation token for repository {} (installation {})",
        repository.id,
        installation_id
    );

    Ok(Some(token))
}

/// Gets a GitLab OAuth access token for the repository.
async fn get_gitlab_token(
    db: &DbPool,
    encryption_key: &EncryptionKey,
    repository: &Repository,
) -> Result<Option<String>> {
    // Check if we have a GitLab project ID
    let _project_id = match repository.gitlab_project_id {
        Some(id) => id,
        None => {
            tracing::debug!(
                "Repository {} has no gitlab_project_id, assuming public",
                repository.id
            );
            return Ok(None);
        }
    };

    // Find the enabled project record to get the credential ID
    let enabled_project = GitLabEnabledProjectRepo::get_by_repository_id(db, &repository.id)
        .await?
        .ok_or_else(|| {
            OoreError::Configuration(format!(
                "GitLab project not enabled for repository {}. Run 'oore gitlab enable' first.",
                repository.id
            ))
        })?;

    // Get the OAuth credentials
    let mut creds =
        GitLabOAuthCredentialsRepo::get_by_id(db, &enabled_project.gitlab_credential_id)
            .await?
            .ok_or_else(|| {
                OoreError::Configuration(
                    "GitLab OAuth credentials not found. Run 'oore gitlab setup' first."
                        .to_string(),
                )
            })?;

    let client = GitLabClient::new(encryption_key.clone())?;

    // Check if token needs refresh
    if client.token_needs_refresh(&creds) {
        tracing::info!(
            "GitLab token for {} is expired or expiring soon, refreshing...",
            creds.instance_url
        );
        let token = refresh_and_update_gitlab_token(db, &client, &mut creds).await?;
        return Ok(Some(token));
    }

    // Decrypt and return the existing token
    let token = client.decrypt_access_token(&creds)?;

    tracing::debug!(
        "Using GitLab OAuth token for repository {} (instance {})",
        repository.id,
        creds.instance_url
    );

    Ok(Some(token))
}

/// Refreshes an expired GitLab token and updates the database.
async fn refresh_and_update_gitlab_token(
    db: &DbPool,
    client: &GitLabClient,
    creds: &mut GitLabOAuthCredentials,
) -> Result<String> {
    // Get OAuth app credentials for this instance
    let app = GitLabOAuthAppRepo::get_by_instance(db, &creds.instance_url)
        .await?
        .ok_or_else(|| {
            OoreError::Configuration(format!(
                "GitLab OAuth app not configured for {}. Token refresh not possible.",
                creds.instance_url
            ))
        })?;

    // Decrypt client secret and refresh token
    let client_secret = client.decrypt_client_secret(&app)?;
    let refresh_token = client.decrypt_refresh_token(creds)?.ok_or_else(|| {
        OoreError::Configuration(
            "No refresh token available. Re-authenticate with 'oore gitlab setup'.".to_string(),
        )
    })?;

    // Call GitLab to refresh the token
    let token_response = client
        .refresh_token(&creds.instance_url, &app.client_id, &client_secret, &refresh_token)
        .await?;

    // Encrypt the new tokens
    let (access_encrypted, access_nonce, refresh_encrypted, refresh_nonce, expires_at) =
        client.encrypt_new_tokens(&creds.id, &token_response)?;

    // Update database
    GitLabOAuthCredentialsRepo::update_tokens(
        db,
        &creds.id,
        &access_encrypted,
        &access_nonce,
        refresh_encrypted.as_deref(),
        refresh_nonce.as_deref(),
        expires_at,
    )
    .await?;

    // Update in-memory struct for any subsequent use
    creds.access_token_encrypted = access_encrypted;
    creds.access_token_nonce = access_nonce;
    if let Some(ref enc) = refresh_encrypted {
        creds.refresh_token_encrypted = Some(enc.clone());
    }
    if let Some(ref nonce) = refresh_nonce {
        creds.refresh_token_nonce = Some(nonce.clone());
    }
    creds.token_expires_at = expires_at;

    tracing::info!("Successfully refreshed GitLab token for {}", creds.instance_url);

    // Return the new access token (already decrypted from response)
    Ok(token_response.access_token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Repository;

    #[test]
    fn test_public_github_repo_returns_none() {
        // A repository without github_installation_id is considered public
        let repo = Repository::new(
            "test-repo".to_string(),
            GitProvider::GitHub,
            "owner".to_string(),
            "repo".to_string(),
            "https://github.com/owner/repo.git".to_string(),
        );
        assert!(repo.github_installation_id.is_none());
    }

    #[test]
    fn test_public_gitlab_repo_returns_none() {
        // A repository without gitlab_project_id is considered public
        let repo = Repository::new(
            "test-repo".to_string(),
            GitProvider::GitLab,
            "owner".to_string(),
            "repo".to_string(),
            "https://gitlab.com/owner/repo.git".to_string(),
        );
        assert!(repo.gitlab_project_id.is_none());
    }
}
