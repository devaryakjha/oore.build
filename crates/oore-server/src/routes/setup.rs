//! Setup status endpoint.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

use oore_core::db::credentials::{GitHubAppCredentialsRepo, GitLabOAuthCredentialsRepo};
use oore_core::oauth::github::GitHubAppStatus;
use oore_core::oauth::gitlab::GitLabCredentialsStatus;

use crate::state::AppState;

/// Combined setup status response.
#[derive(Debug, Serialize)]
pub struct SetupStatusResponse {
    pub github: GitHubAppStatus,
    pub gitlab: Vec<GitLabCredentialsStatus>,
    pub encryption_configured: bool,
    pub admin_token_configured: bool,
    /// Whether demo mode is enabled (all data is fake/simulated).
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub demo_mode: bool,
}

/// GET /api/setup/status - Returns provider connection status.
pub async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    // If demo mode is enabled, return demo data
    if let Some(ref demo) = state.demo_provider {
        let response = SetupStatusResponse {
            github: demo.get_github_status(),
            gitlab: demo.get_gitlab_statuses(),
            encryption_configured: true,
            admin_token_configured: true,
            demo_mode: true,
        };
        return (StatusCode::OK, Json(response));
    }

    // Check GitHub App credentials
    let github_status = match GitHubAppCredentialsRepo::get_active(&state.db).await {
        Ok(Some(creds)) => {
            // Count installations
            let installations_count = match oore_core::db::credentials::GitHubAppInstallationRepo::list_by_app(
                &state.db,
                &creds.id,
            )
            .await
            {
                Ok(installations) => installations.len(),
                Err(_) => 0,
            };
            GitHubAppStatus::from_credentials(&creds, installations_count)
        }
        Ok(None) => GitHubAppStatus::not_configured(),
        Err(e) => {
            tracing::error!("Failed to fetch GitHub credentials: {}", e);
            GitHubAppStatus::not_configured()
        }
    };

    // Check GitLab OAuth credentials
    let gitlab_statuses = match GitLabOAuthCredentialsRepo::list_active(&state.db).await {
        Ok(creds_list) => {
            let mut statuses = Vec::new();
            for creds in &creds_list {
                // Get enabled projects count
                let projects_count = match oore_core::db::credentials::GitLabEnabledProjectRepo::list_by_credential(
                    &state.db,
                    &creds.id,
                )
                .await
                {
                    Ok(projects) => projects.len(),
                    Err(_) => 0,
                };

                // Create client to check token status
                if let Some(ref key) = state.encryption_key {
                    if let Ok(client) = oore_core::oauth::gitlab::GitLabClient::new(key.clone()) {
                        statuses.push(GitLabCredentialsStatus::from_credentials(
                            creds,
                            &client,
                            projects_count,
                        ));
                    }
                } else {
                    statuses.push(GitLabCredentialsStatus {
                        id: creds.id.to_string(),
                        configured: true,
                        instance_url: Some(creds.instance_url.clone()),
                        username: Some(creds.username.clone()),
                        user_id: Some(creds.user_id),
                        token_expires_at: creds.token_expires_at.map(|t| t.to_rfc3339()),
                        needs_refresh: false,
                        enabled_projects_count: projects_count,
                    });
                }
            }
            statuses
        }
        Err(e) => {
            tracing::error!("Failed to fetch GitLab credentials: {}", e);
            vec![]
        }
    };

    let response = SetupStatusResponse {
        github: github_status,
        gitlab: gitlab_statuses,
        encryption_configured: state.encryption_key.is_some(),
        admin_token_configured: state.admin_auth_config.is_configured(),
        demo_mode: false,
    };

    (StatusCode::OK, Json(response))
}
