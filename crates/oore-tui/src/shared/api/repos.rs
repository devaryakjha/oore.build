//! Repository API operations.

use anyhow::Result;

use super::types::{CreateRepositoryRequest, RepositoryResponse, WebhookUrlResponse};
use crate::shared::client::OoreClient;

/// List all repositories.
pub async fn list_repositories(client: &OoreClient) -> Result<Vec<RepositoryResponse>> {
    client.get("/repositories").await
}

/// Get a repository by ID.
pub async fn get_repository(client: &OoreClient, id: &str) -> Result<RepositoryResponse> {
    client.get(&format!("/repositories/{}", id)).await
}

/// Create a new repository.
pub async fn create_repository(
    client: &OoreClient,
    request: &CreateRepositoryRequest,
) -> Result<RepositoryResponse> {
    client.post("/repositories", request).await
}

/// Delete a repository.
pub async fn delete_repository(client: &OoreClient, id: &str) -> Result<()> {
    client.delete(&format!("/repositories/{}", id)).await
}

/// Get the webhook URL for a repository.
pub async fn get_webhook_url(client: &OoreClient, id: &str) -> Result<WebhookUrlResponse> {
    client.get(&format!("/repositories/{}/webhook-url", id)).await
}
