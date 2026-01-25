//! Cryptographic utilities for webhook verification and token encryption.

use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, KeyInit},
};
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::Sha256;
use subtle::ConstantTimeEq;

use crate::error::{OoreError, Result};

type HmacSha256 = Hmac<Sha256>;

/// Maximum webhook payload size (10MB).
pub const MAX_WEBHOOK_SIZE: usize = 10 * 1024 * 1024;

/// Computes SHA-256 hash of data and returns as hex string.
pub fn sha256_hex(data: &[u8]) -> String {
    use sha2::Digest;
    let hash = sha2::Sha256::digest(data);
    hex::encode(hash)
}

/// Computes HMAC-SHA256 of data with the given key and returns as hex string.
pub fn hmac_sha256_hex(key: &[u8], data: &[u8]) -> String {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(data);
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// Verifies a GitHub webhook signature using constant-time comparison.
///
/// GitHub sends signatures in the format `sha256=<hex>`.
pub fn verify_github_signature(secret: &str, signature: &str, body: &[u8]) -> bool {
    // GitHub signature format: sha256=<hex>
    let expected_prefix = "sha256=";
    if !signature.starts_with(expected_prefix) {
        return false;
    }

    let provided_signature = &signature[expected_prefix.len()..];
    let computed = hmac_sha256_hex(secret.as_bytes(), body);

    // Constant-time comparison
    constant_time_eq(provided_signature.as_bytes(), computed.as_bytes())
}

/// Verifies a GitLab webhook token by comparing its HMAC against the stored value.
///
/// For GitLab, we store HMAC_SHA256(token, server_pepper) as hex.
/// This function computes the same HMAC of the provided token and compares.
pub fn verify_gitlab_token_hmac(server_pepper: &str, stored_hmac: &str, token: &str) -> bool {
    let computed = hmac_sha256_hex(server_pepper.as_bytes(), token.as_bytes());
    constant_time_eq(computed.as_bytes(), stored_hmac.as_bytes())
}

/// Computes the HMAC of a GitLab webhook token for storage.
pub fn compute_gitlab_token_hmac(server_pepper: &str, token: &str) -> String {
    hmac_sha256_hex(server_pepper.as_bytes(), token.as_bytes())
}

/// Constant-time equality comparison.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.ct_eq(b).into()
}

/// Encrypts data using AES-256-GCM.
///
/// Returns (ciphertext_hex, nonce_hex).
pub fn encrypt_aes256gcm(key: &[u8; 32], plaintext: &[u8]) -> Result<(String, String)> {
    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| OoreError::Encryption(format!("Encryption failed: {}", e)))?;

    Ok((hex::encode(ciphertext), hex::encode(nonce_bytes)))
}

/// Decrypts data using AES-256-GCM.
pub fn decrypt_aes256gcm(key: &[u8; 32], ciphertext_hex: &str, nonce_hex: &str) -> Result<Vec<u8>> {
    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);

    let ciphertext = hex::decode(ciphertext_hex)
        .map_err(|e| OoreError::Encryption(format!("Invalid ciphertext hex: {}", e)))?;

    let nonce_bytes = hex::decode(nonce_hex)
        .map_err(|e| OoreError::Encryption(format!("Invalid nonce hex: {}", e)))?;

    if nonce_bytes.len() != 12 {
        return Err(OoreError::Encryption("Invalid nonce length".to_string()));
    }

    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| OoreError::Encryption(format!("Decryption failed: {}", e)))
}

/// Derives a 32-byte key from a password/secret using SHA-256.
///
/// This is a simple derivation suitable for environment-based secrets.
/// For production with user passwords, use a proper KDF like Argon2.
pub fn derive_key_from_secret(secret: &str) -> [u8; 32] {
    use sha2::Digest;
    let hash = sha2::Sha256::digest(secret.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_signature_verification() {
        let secret = "test-secret";
        let body = b"test body";
        let signature = format!("sha256={}", hmac_sha256_hex(secret.as_bytes(), body));

        assert!(verify_github_signature(secret, &signature, body));
        assert!(!verify_github_signature(secret, "sha256=invalid", body));
        assert!(!verify_github_signature("wrong-secret", &signature, body));
    }

    #[test]
    fn test_gitlab_token_verification() {
        let pepper = "server-pepper";
        let token = "webhook-token";
        let stored_hmac = compute_gitlab_token_hmac(pepper, token);

        assert!(verify_gitlab_token_hmac(pepper, &stored_hmac, token));
        assert!(!verify_gitlab_token_hmac(pepper, &stored_hmac, "wrong-token"));
        assert!(!verify_gitlab_token_hmac("wrong-pepper", &stored_hmac, token));
    }

    #[test]
    fn test_aes_encryption_roundtrip() {
        let key = derive_key_from_secret("test-encryption-key");
        let plaintext = b"sensitive access token";

        let (ciphertext, nonce) = encrypt_aes256gcm(&key, plaintext).unwrap();
        let decrypted = decrypt_aes256gcm(&key, &ciphertext, &nonce).unwrap();

        assert_eq!(decrypted, plaintext);
    }
}
