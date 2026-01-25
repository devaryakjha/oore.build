//! OAuth utilities and URL validation for provider integrations.

pub mod github;
pub mod gitlab;

use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::Arc;

use ipnet::IpNet;
use url::Url;

use crate::error::{OoreError, Result};

/// Configuration for SSRF protection.
#[derive(Debug, Clone, Default)]
pub struct SsrfConfig {
    /// Allowed hosts (exact match).
    pub allowed_hosts: HashSet<String>,
    /// Allowed CIDRs for private IP ranges (for self-hosted GitLab).
    pub allowed_cidrs: Vec<IpNet>,
    /// Whether to allow private/internal IP addresses.
    pub allow_private_ips: bool,
    /// Custom CA bundle path for TLS.
    pub ca_bundle_path: Option<String>,
}

impl SsrfConfig {
    /// Creates a config from environment variables.
    pub fn from_env() -> Self {
        let mut config = Self::default();

        // Parse allowed hosts
        if let Ok(hosts) = std::env::var("OORE_GITLAB_ALLOWED_HOSTS") {
            for host in hosts.split(',') {
                let host = host.trim().to_lowercase();
                if !host.is_empty() {
                    config.allowed_hosts.insert(host);
                }
            }
        }

        // Parse allowed CIDRs
        if let Ok(cidrs) = std::env::var("OORE_GITLAB_ALLOWED_CIDRS") {
            for cidr in cidrs.split(',') {
                let cidr = cidr.trim();
                if !cidr.is_empty() {
                    match cidr.parse::<IpNet>() {
                        Ok(net) => {
                            // Validate CIDR isn't too broad
                            if Self::is_cidr_too_broad(&net) {
                                let allow_broad =
                                    std::env::var("OORE_ALLOW_BROAD_CIDRS").ok()
                                        == Some("I_UNDERSTAND_THE_RISK".to_string());
                                if !allow_broad {
                                    tracing::warn!(
                                        "Rejecting overly broad CIDR {}. Set OORE_ALLOW_BROAD_CIDRS=I_UNDERSTAND_THE_RISK to allow.",
                                        cidr
                                    );
                                    continue;
                                }
                            }
                            config.allowed_cidrs.push(net);
                            config.allow_private_ips = true;
                        }
                        Err(e) => {
                            tracing::warn!("Invalid CIDR in OORE_GITLAB_ALLOWED_CIDRS: {} - {}", cidr, e);
                        }
                    }
                }
            }
        }

        // CA bundle path
        if let Ok(path) = std::env::var("OORE_GITLAB_CA_BUNDLE")
            && !path.is_empty()
        {
            config.ca_bundle_path = Some(path);
        }

        config
    }

    /// Checks if a CIDR is too broad (potential misconfiguration).
    fn is_cidr_too_broad(net: &IpNet) -> bool {
        match net {
            IpNet::V4(v4) => v4.prefix_len() < 8, // More than 16M addresses
            IpNet::V6(v6) => v6.prefix_len() < 32, // Common allocation size
        }
    }

    /// Checks if an IP is in the allowed CIDRs.
    pub fn is_ip_allowed(&self, ip: IpAddr) -> bool {
        for cidr in &self.allowed_cidrs {
            if cidr.contains(&ip) {
                return true;
            }
        }
        false
    }
}

/// Validated URL for external API calls.
#[derive(Debug, Clone)]
pub struct ValidatedUrl {
    pub url: Url,
    pub resolved_ips: Vec<IpAddr>,
}

/// Validates and normalizes a GitLab instance URL.
pub fn validate_gitlab_instance_url(url_str: &str, config: &SsrfConfig) -> Result<ValidatedUrl> {
    // Parse URL
    let url = Url::parse(url_str)
        .map_err(|e| OoreError::Configuration(format!("Invalid URL: {}", e)))?;

    // HTTPS required
    if url.scheme() != "https" {
        return Err(OoreError::Configuration(
            "HTTPS is required for GitLab instances".to_string(),
        ));
    }

    // No userinfo
    if !url.username().is_empty() || url.password().is_some() {
        return Err(OoreError::Configuration(
            "URL must not contain username or password".to_string(),
        ));
    }

    // Must have a host
    let host = url
        .host_str()
        .ok_or_else(|| OoreError::Configuration("URL must have a host".to_string()))?;

    // No fragments
    if url.fragment().is_some() {
        return Err(OoreError::Configuration(
            "URL must not contain fragment".to_string(),
        ));
    }

    // Normalize to origin only
    let origin = format!(
        "{}://{}{}",
        url.scheme(),
        host,
        url.port().map(|p| format!(":{}", p)).unwrap_or_default()
    );

    let normalized_url = Url::parse(&origin)
        .map_err(|e| OoreError::Configuration(format!("Failed to normalize URL: {}", e)))?;

    // Check allowed hosts
    let host_with_port = format!(
        "{}{}",
        host.to_lowercase(),
        url.port().map(|p| format!(":{}", p)).unwrap_or_default()
    );

    let is_allowed_host = config.allowed_hosts.is_empty()
        || config.allowed_hosts.contains(&host.to_lowercase())
        || config.allowed_hosts.contains(&host_with_port);

    // DNS resolution and IP validation
    let resolved_ips = resolve_host(host)?;

    if resolved_ips.is_empty() {
        return Err(OoreError::Configuration(format!(
            "DNS resolution failed for host: {}",
            host
        )));
    }

    // Validate IPs
    for ip in &resolved_ips {
        if is_private_or_loopback(ip) {
            if !config.allow_private_ips {
                return Err(OoreError::Configuration(format!(
                    "Host {} resolves to private/loopback IP {}. Set OORE_GITLAB_ALLOWED_CIDRS to allow.",
                    host, ip
                )));
            }

            // Check if IP is in allowed CIDRs
            if !config.is_ip_allowed(*ip) && !is_allowed_host {
                return Err(OoreError::Configuration(format!(
                    "Host {} resolves to IP {} which is not in allowed CIDRs",
                    host, ip
                )));
            }
        }
    }

    Ok(ValidatedUrl {
        url: normalized_url,
        resolved_ips,
    })
}

/// Resolves a hostname to IP addresses.
fn resolve_host(host: &str) -> Result<Vec<IpAddr>> {
    use std::net::ToSocketAddrs;

    // Try to parse as IP address first
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok(vec![ip]);
    }

    // DNS resolution
    let addrs: Vec<IpAddr> = format!("{}:443", host)
        .to_socket_addrs()
        .map_err(|e| OoreError::Configuration(format!("DNS resolution failed: {}", e)))?
        .map(|addr| addr.ip())
        .collect();

    Ok(addrs)
}

/// Checks if an IP address is private, loopback, or link-local.
fn is_private_or_loopback(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback() // 127.0.0.0/8
                || v4.is_private() // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                || v4.is_link_local() // 169.254.0.0/16
                || is_shared_cgnat(v4) // 100.64.0.0/10
                || v4.is_broadcast()
                || v4.is_documentation()
        }
        IpAddr::V6(v6) => {
            v6.is_loopback() // ::1
                || is_ula_v6(v6) // fc00::/7
                || is_link_local_v6(v6) // fe80::/10
        }
    }
}

/// Checks if IPv4 is in shared CGN range (100.64.0.0/10).
fn is_shared_cgnat(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    octets[0] == 100 && (octets[1] & 0xC0) == 64
}

/// Checks if IPv6 is ULA (fc00::/7).
fn is_ula_v6(ip: &Ipv6Addr) -> bool {
    let segments = ip.segments();
    (segments[0] & 0xFE00) == 0xFC00
}

/// Checks if IPv6 is link-local (fe80::/10).
fn is_link_local_v6(ip: &Ipv6Addr) -> bool {
    let segments = ip.segments();
    (segments[0] & 0xFFC0) == 0xFE80
}

/// Creates an HTTP client configured for external API calls.
pub fn create_http_client(config: &SsrfConfig) -> Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none()) // Disable redirects
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .no_proxy(); // Ignore proxy env vars

    // Add custom CA if configured
    if let Some(ref ca_path) = config.ca_bundle_path {
        let ca_content = std::fs::read(ca_path).map_err(|e| {
            OoreError::Configuration(format!("Failed to read CA bundle {}: {}", ca_path, e))
        })?;

        let cert = reqwest::Certificate::from_pem(&ca_content).map_err(|e| {
            OoreError::Configuration(format!("Invalid CA certificate: {}", e))
        })?;

        builder = builder.add_root_certificate(cert);
    }

    builder
        .build()
        .map_err(|e| OoreError::Configuration(format!("Failed to create HTTP client: {}", e)))
}

/// Encryption key for storing credentials.
#[derive(Clone)]
pub struct EncryptionKey(Arc<[u8; 32]>);

impl EncryptionKey {
    /// Creates an encryption key from a base64 or hex encoded string.
    pub fn from_env() -> Result<Self> {
        let key_str = std::env::var("ENCRYPTION_KEY").map_err(|_| {
            OoreError::Configuration("ENCRYPTION_KEY environment variable is required".to_string())
        })?;

        Self::from_string(&key_str)
    }

    /// Creates an encryption key from a base64 or hex encoded string.
    pub fn from_string(key_str: &str) -> Result<Self> {
        let key_bytes = if key_str.len() == 64 {
            // Try hex decoding
            hex::decode(key_str)
                .map_err(|e| OoreError::Configuration(format!("Invalid hex key: {}", e)))?
        } else {
            // Try base64 decoding
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, key_str)
                .map_err(|e| OoreError::Configuration(format!("Invalid base64 key: {}", e)))?
        };

        if key_bytes.len() != 32 {
            return Err(OoreError::Configuration(format!(
                "Encryption key must be exactly 32 bytes, got {}",
                key_bytes.len()
            )));
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(Self(Arc::new(key)))
    }

    /// Returns the key bytes.
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl std::fmt::Debug for EncryptionKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "EncryptionKey([REDACTED])")
    }
}

/// Encrypts sensitive data with AAD (Additional Authenticated Data).
pub fn encrypt_with_aad(
    key: &EncryptionKey,
    plaintext: &[u8],
    table_name: &str,
    row_id: &str,
) -> Result<(Vec<u8>, Vec<u8>)> {
    use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
    use rand::RngCore;

    let cipher = Aes256Gcm::new_from_slice(key.as_bytes())
        .map_err(|e| OoreError::Encryption(format!("Invalid key: {}", e)))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Create AAD from table name and row ID
    let aad = format!("{}:{}", table_name, row_id);

    let ciphertext = cipher
        .encrypt(nonce, aes_gcm::aead::Payload { msg: plaintext, aad: aad.as_bytes() })
        .map_err(|e| OoreError::Encryption(format!("Encryption failed: {}", e)))?;

    Ok((ciphertext, nonce_bytes.to_vec()))
}

/// Decrypts sensitive data with AAD verification.
pub fn decrypt_with_aad(
    key: &EncryptionKey,
    ciphertext: &[u8],
    nonce: &[u8],
    table_name: &str,
    row_id: &str,
) -> Result<Vec<u8>> {
    use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};

    if nonce.len() != 12 {
        return Err(OoreError::Encryption("Invalid nonce length".to_string()));
    }

    let cipher = Aes256Gcm::new_from_slice(key.as_bytes())
        .map_err(|e| OoreError::Encryption(format!("Invalid key: {}", e)))?;

    let nonce = Nonce::from_slice(nonce);
    let aad = format!("{}:{}", table_name, row_id);

    cipher
        .decrypt(nonce, aes_gcm::aead::Payload { msg: ciphertext, aad: aad.as_bytes() })
        .map_err(|e| OoreError::Encryption(format!("Decryption failed: {}", e)))
}

/// Parses base URL from environment.
pub fn get_base_url() -> Result<Url> {
    let base_url_str =
        std::env::var("OORE_BASE_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());

    let url = Url::parse(&base_url_str)
        .map_err(|e| OoreError::Configuration(format!("Invalid OORE_BASE_URL: {}", e)))?;

    // Validate HTTPS in production
    let dev_mode = std::env::var("OORE_DEV_MODE").ok() == Some("true".to_string());

    if !dev_mode && url.scheme() != "https" {
        // Allow localhost/loopback in dev mode
        let host = url.host_str().unwrap_or("");
        let is_loopback = host == "localhost" || host == "127.0.0.1" || host == "::1";

        if !is_loopback {
            return Err(OoreError::Configuration(
                "OORE_BASE_URL must use HTTPS in production. Set OORE_DEV_MODE=true for development.".to_string(),
            ));
        }
    }

    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_private_or_loopback() {
        // Loopback
        assert!(is_private_or_loopback(&"127.0.0.1".parse().unwrap()));
        assert!(is_private_or_loopback(&"::1".parse().unwrap()));

        // Private ranges
        assert!(is_private_or_loopback(&"10.0.0.1".parse().unwrap()));
        assert!(is_private_or_loopback(&"172.16.0.1".parse().unwrap()));
        assert!(is_private_or_loopback(&"192.168.1.1".parse().unwrap()));

        // Link-local
        assert!(is_private_or_loopback(&"169.254.1.1".parse().unwrap()));

        // CGN
        assert!(is_private_or_loopback(&"100.64.0.1".parse().unwrap()));

        // Public IPs should be allowed
        assert!(!is_private_or_loopback(&"8.8.8.8".parse().unwrap()));
        assert!(!is_private_or_loopback(&"1.1.1.1".parse().unwrap()));
    }

    #[test]
    fn test_validate_gitlab_url() {
        let config = SsrfConfig::default();

        // Valid public URL
        let result = validate_gitlab_instance_url("https://gitlab.com", &config);
        assert!(result.is_ok());

        // HTTP rejected
        let result = validate_gitlab_instance_url("http://gitlab.com", &config);
        assert!(result.is_err());

        // Userinfo rejected
        let result = validate_gitlab_instance_url("https://user:pass@gitlab.com", &config);
        assert!(result.is_err());
    }

    #[test]
    fn test_encryption_key() {
        // Valid base64 key
        let key_b64 = "K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=";
        let key = EncryptionKey::from_string(key_b64).unwrap();
        assert_eq!(key.as_bytes().len(), 32);

        // Valid hex key
        let key_hex = "2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b";
        let key = EncryptionKey::from_string(key_hex).unwrap();
        assert_eq!(key.as_bytes().len(), 32);

        // Invalid key length
        let result = EncryptionKey::from_string("tooshort");
        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = EncryptionKey::from_string("K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=").unwrap();
        let plaintext = b"sensitive data";
        let table = "test_table";
        let row_id = "test_id";

        let (ciphertext, nonce) = encrypt_with_aad(&key, plaintext, table, row_id).unwrap();
        let decrypted = decrypt_with_aad(&key, &ciphertext, &nonce, table, row_id).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aad_verification() {
        let key = EncryptionKey::from_string("K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=").unwrap();
        let plaintext = b"sensitive data";

        let (ciphertext, nonce) = encrypt_with_aad(&key, plaintext, "table1", "id1").unwrap();

        // Wrong table name should fail
        let result = decrypt_with_aad(&key, &ciphertext, &nonce, "table2", "id1");
        assert!(result.is_err());

        // Wrong row ID should fail
        let result = decrypt_with_aad(&key, &ciphertext, &nonce, "table1", "id2");
        assert!(result.is_err());
    }
}
