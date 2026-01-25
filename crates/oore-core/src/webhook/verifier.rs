//! Webhook signature verification.

use crate::crypto::{verify_github_signature, verify_gitlab_token_hmac};

/// Verifier for GitHub webhook signatures.
pub struct GitHubVerifier<'a> {
    secret: &'a str,
}

impl<'a> GitHubVerifier<'a> {
    /// Creates a new GitHub verifier with the webhook secret.
    pub fn new(secret: &'a str) -> Self {
        Self { secret }
    }

    /// Verifies a GitHub webhook signature.
    ///
    /// # Arguments
    /// * `signature` - The X-Hub-Signature-256 header value
    /// * `body` - The raw request body
    pub fn verify(&self, signature: &str, body: &[u8]) -> bool {
        verify_github_signature(self.secret, signature, body)
    }
}

/// Verifier for GitLab webhook tokens.
pub struct GitLabVerifier<'a> {
    server_pepper: &'a str,
}

impl<'a> GitLabVerifier<'a> {
    /// Creates a new GitLab verifier with the server pepper.
    pub fn new(server_pepper: &'a str) -> Self {
        Self { server_pepper }
    }

    /// Verifies a GitLab webhook token against a stored HMAC.
    ///
    /// # Arguments
    /// * `stored_hmac` - The HMAC stored in the database
    /// * `token` - The X-Gitlab-Token header value
    pub fn verify(&self, stored_hmac: &str, token: &str) -> bool {
        verify_gitlab_token_hmac(self.server_pepper, stored_hmac, token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{compute_gitlab_token_hmac, hmac_sha256_hex};

    #[test]
    fn test_github_verifier() {
        let secret = "test-secret";
        let body = b"test payload";
        let signature = format!("sha256={}", hmac_sha256_hex(secret.as_bytes(), body));

        let verifier = GitHubVerifier::new(secret);
        assert!(verifier.verify(&signature, body));
        assert!(!verifier.verify("sha256=invalid", body));
    }

    #[test]
    fn test_gitlab_verifier() {
        let pepper = "server-pepper";
        let token = "webhook-token";
        let stored_hmac = compute_gitlab_token_hmac(pepper, token);

        let verifier = GitLabVerifier::new(pepper);
        assert!(verifier.verify(&stored_hmac, token));
        assert!(!verifier.verify(&stored_hmac, "wrong-token"));
    }
}
