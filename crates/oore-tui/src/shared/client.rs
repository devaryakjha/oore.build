//! HTTP client wrapper for Oore server API.

#![allow(dead_code)]

use anyhow::{Context, Result};
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::Serialize;

/// HTTP client for communicating with the Oore server.
#[derive(Debug, Clone)]
pub struct OoreClient {
    inner: reqwest::Client,
    server: String,
    admin_token: Option<String>,
}

/// API error response from the server.
#[derive(Debug, serde::Deserialize)]
pub struct ApiError {
    pub error: String,
}

impl OoreClient {
    /// Creates a new client with the given server URL and optional admin token.
    pub fn new(server: String, admin_token: Option<String>) -> Self {
        Self {
            inner: reqwest::Client::new(),
            server,
            admin_token,
        }
    }

    /// Returns the server URL.
    pub fn server(&self) -> &str {
        &self.server
    }

    /// Returns whether an admin token is configured.
    pub fn has_admin_token(&self) -> bool {
        self.admin_token.is_some()
    }

    /// Builds the full URL for an API endpoint.
    fn url(&self, path: &str) -> String {
        format!("{}/api{}", self.server, path)
    }

    /// Adds authorization header if admin token is available.
    fn with_auth(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(ref token) = self.admin_token {
            builder.header("Authorization", format!("Bearer {}", token))
        } else {
            builder
        }
    }

    /// Performs a GET request and deserializes the response.
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = self.url(path);
        let request = self.with_auth(self.inner.get(&url));

        let response = request.send().await.context("Failed to connect to server")?;

        handle_response(response).await
    }

    /// Performs a POST request with a JSON body and deserializes the response.
    pub async fn post<T: DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> Result<T> {
        let url = self.url(path);
        let request = self.with_auth(self.inner.post(&url)).json(body);

        let response = request.send().await.context("Failed to connect to server")?;

        handle_response(response).await
    }

    /// Performs a PUT request with a JSON body and deserializes the response.
    pub async fn put<T: DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> Result<T> {
        let url = self.url(path);
        let request = self.with_auth(self.inner.put(&url)).json(body);

        let response = request.send().await.context("Failed to connect to server")?;

        handle_response(response).await
    }

    /// Performs a DELETE request.
    pub async fn delete(&self, path: &str) -> Result<()> {
        let url = self.url(path);
        let request = self.with_auth(self.inner.delete(&url));

        let response = request.send().await.context("Failed to connect to server")?;

        if response.status() == StatusCode::NO_CONTENT || response.status().is_success() {
            return Ok(());
        }

        // Try to parse error response
        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if let Ok(err) = serde_json::from_str::<ApiError>(&body) {
            anyhow::bail!("{} ({})", err.error, status);
        } else {
            anyhow::bail!("Request failed ({}): {}", status, body);
        }
    }
}

/// Handles the HTTP response, parsing JSON or returning an error.
async fn handle_response<T: DeserializeOwned>(response: reqwest::Response) -> Result<T> {
    let status = response.status();

    if status.is_success() {
        response
            .json()
            .await
            .context("Failed to parse response JSON")
    } else {
        let body = response.text().await.unwrap_or_default();

        if let Ok(err) = serde_json::from_str::<ApiError>(&body) {
            anyhow::bail!("{} ({})", err.error, status);
        } else {
            anyhow::bail!("Request failed ({}): {}", status, body);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_url_building() {
        let client = OoreClient::new("http://localhost:8080".to_string(), None);
        assert_eq!(client.url("/health"), "http://localhost:8080/api/health");
        assert_eq!(
            client.url("/repositories"),
            "http://localhost:8080/api/repositories"
        );
    }

    #[test]
    fn test_client_has_admin_token() {
        let client_without = OoreClient::new("http://localhost:8080".to_string(), None);
        assert!(!client_without.has_admin_token());

        let client_with =
            OoreClient::new("http://localhost:8080".to_string(), Some("token".to_string()));
        assert!(client_with.has_admin_token());
    }
}
