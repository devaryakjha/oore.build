//! iOS certificate and provisioning profile parsing.
//!
//! This module handles parsing p12 certificates and mobileprovision files
//! to extract metadata for storage and display.

use chrono::{DateTime, Utc};
use std::process::Stdio;
use std::time::SystemTime;
use tokio::process::Command;

use crate::error::{OoreError, Result};
use crate::models::ProfileType;

/// Metadata extracted from a p12 certificate.
#[derive(Debug, Clone)]
pub struct CertificateMetadata {
    /// Common name from the certificate subject.
    pub common_name: Option<String>,
    /// Team ID (organizational unit from subject).
    pub team_id: Option<String>,
    /// Certificate serial number.
    pub serial_number: Option<String>,
    /// Certificate expiration date.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Metadata extracted from a provisioning profile.
#[derive(Debug, Clone)]
pub struct ProfileMetadata {
    /// Profile name.
    pub name: String,
    /// Profile type (development, adhoc, appstore, enterprise).
    pub profile_type: ProfileType,
    /// Bundle identifier pattern.
    pub bundle_identifier: Option<String>,
    /// Team ID.
    pub team_id: Option<String>,
    /// Profile UUID.
    pub uuid: String,
    /// App ID name.
    pub app_id_name: Option<String>,
    /// Profile expiration date.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Parses a p12 certificate to extract metadata.
///
/// Uses the `openssl` CLI to parse the certificate since the OpenSSL/native-tls
/// crates have complex APIs for p12 handling.
pub async fn parse_p12_certificate(data: &[u8], password: &str) -> Result<CertificateMetadata> {
    // Write p12 to temp file
    let temp_dir = tempfile::tempdir()
        .map_err(|e| OoreError::Signing(format!("Failed to create temp directory: {}", e)))?;
    let p12_path = temp_dir.path().join("cert.p12");
    tokio::fs::write(&p12_path, data)
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to write temp p12 file: {}", e)))?;

    // Extract certificate info using openssl
    let output = Command::new("openssl")
        .args([
            "pkcs12",
            "-in",
            p12_path.to_str().unwrap(),
            "-passin",
            &format!("pass:{}", password),
            "-nokeys",
            "-nodes",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to run openssl: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(OoreError::Signing(format!(
            "Failed to parse p12 certificate: {}",
            stderr
        )));
    }

    let pem_output = String::from_utf8_lossy(&output.stdout);

    // Parse the PEM certificate to extract details
    let x509_output = Command::new("openssl")
        .args(["x509", "-noout", "-subject", "-serial", "-enddate"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| OoreError::Signing(format!("Failed to spawn openssl: {}", e)))?;

    // Write PEM to stdin
    let mut child = x509_output;
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(pem_output.as_bytes())
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to write to openssl stdin: {}", e)))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to wait for openssl: {}", e)))?;

    let info = String::from_utf8_lossy(&output.stdout);

    // Parse the output
    let mut common_name = None;
    let mut team_id = None;
    let mut serial_number = None;
    let mut expires_at = None;

    for line in info.lines() {
        if let Some(subject) = line.strip_prefix("subject=") {
            // Parse subject: CN=..., OU=..., O=...
            for part in subject.split(',') {
                let part = part.trim();
                if let Some(cn) = part.strip_prefix("CN=") {
                    common_name = Some(cn.trim().to_string());
                } else if let Some(ou) = part.strip_prefix("OU=") {
                    // Team ID is often in OU
                    let ou = ou.trim();
                    if ou.len() == 10 && ou.chars().all(|c| c.is_ascii_alphanumeric()) {
                        team_id = Some(ou.to_string());
                    }
                }
            }
        } else if let Some(serial) = line.strip_prefix("serial=") {
            serial_number = Some(serial.trim().to_string());
        } else if let Some(date_str) = line.strip_prefix("notAfter=") {
            // Parse date like "Dec 31 23:59:59 2024 GMT"
            if let Ok(date) = chrono::NaiveDateTime::parse_from_str(
                date_str.trim(),
                "%b %d %H:%M:%S %Y GMT",
            ) {
                expires_at = Some(DateTime::from_naive_utc_and_offset(date, Utc));
            }
        }
    }

    Ok(CertificateMetadata {
        common_name,
        team_id,
        serial_number,
        expires_at,
    })
}

/// Parses a mobileprovision file to extract metadata.
///
/// Mobileprovision files are CMS-signed plists. We use the `security` CLI
/// on macOS to extract the plist content.
pub async fn parse_provisioning_profile(data: &[u8]) -> Result<ProfileMetadata> {
    // Write profile to temp file
    let temp_dir = tempfile::tempdir()
        .map_err(|e| OoreError::Signing(format!("Failed to create temp directory: {}", e)))?;
    let profile_path = temp_dir.path().join("profile.mobileprovision");
    tokio::fs::write(&profile_path, data)
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to write temp profile file: {}", e)))?;

    // Extract plist using security cms
    let output = Command::new("security")
        .args(["cms", "-D", "-i", profile_path.to_str().unwrap()])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to run security cms: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(OoreError::Signing(format!(
            "Failed to parse provisioning profile: {}",
            stderr
        )));
    }

    let plist_content = String::from_utf8_lossy(&output.stdout);

    // Parse the plist content
    parse_profile_plist(&plist_content)
}

/// Parses profile plist content to extract metadata.
fn parse_profile_plist(plist_content: &str) -> Result<ProfileMetadata> {
    // Use plist crate for proper parsing
    let plist: plist::Value = plist::from_bytes(plist_content.as_bytes())
        .map_err(|e| OoreError::Signing(format!("Failed to parse profile plist: {}", e)))?;

    let dict = plist
        .as_dictionary()
        .ok_or_else(|| OoreError::Signing("Profile plist is not a dictionary".to_string()))?;

    // Extract required UUID
    let uuid = dict
        .get("UUID")
        .and_then(|v| v.as_string())
        .ok_or_else(|| OoreError::Signing("Profile missing UUID".to_string()))?
        .to_string();

    // Extract name
    let name = dict
        .get("Name")
        .and_then(|v| v.as_string())
        .unwrap_or("Unnamed Profile")
        .to_string();

    // Extract app ID name
    let app_id_name = dict
        .get("AppIDName")
        .and_then(|v| v.as_string())
        .map(|s| s.to_string());

    // Extract team ID from TeamIdentifier array
    let team_id = dict
        .get("TeamIdentifier")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_string())
        .map(|s| s.to_string());

    // Extract bundle identifier from Entitlements
    let bundle_identifier = dict
        .get("Entitlements")
        .and_then(|v| v.as_dictionary())
        .and_then(|ents| ents.get("application-identifier"))
        .and_then(|v| v.as_string())
        .map(|s| {
            // Remove team ID prefix if present
            if let Some(dot_pos) = s.find('.') {
                s[dot_pos + 1..].to_string()
            } else {
                s.to_string()
            }
        });

    // Extract expiration date
    let expires_at = dict
        .get("ExpirationDate")
        .and_then(|v| v.as_date())
        .and_then(|d| {
            let system_time: SystemTime = d.clone().into();
            system_time
                .duration_since(SystemTime::UNIX_EPOCH)
                .ok()
                .and_then(|dur| DateTime::from_timestamp(dur.as_secs() as i64, 0))
        });

    // Determine profile type
    let profile_type = determine_profile_type(dict);

    Ok(ProfileMetadata {
        name,
        profile_type,
        bundle_identifier,
        team_id,
        uuid,
        app_id_name,
        expires_at,
    })
}

/// Determines the profile type from the plist dictionary.
fn determine_profile_type(dict: &plist::Dictionary) -> ProfileType {
    // Check for enterprise (InHouse) profile
    let entitlements = dict.get("Entitlements").and_then(|v| v.as_dictionary());

    if let Some(ents) = entitlements {
        // Enterprise profiles have get-task-allow=false and no aps-environment
        if ents.get("get-task-allow").and_then(|v| v.as_boolean()) == Some(false) {
            // Check if it's an InHouse distribution
            if dict.get("ProvisionsAllDevices").and_then(|v| v.as_boolean()) == Some(true) {
                return ProfileType::Enterprise;
            }
        }
    }

    // Check for development profile (has devices and get-task-allow=true)
    let has_devices = dict
        .get("ProvisionedDevices")
        .and_then(|v| v.as_array())
        .map(|arr| !arr.is_empty())
        .unwrap_or(false);

    let get_task_allow = entitlements
        .and_then(|ents| ents.get("get-task-allow"))
        .and_then(|v| v.as_boolean())
        .unwrap_or(false);

    if get_task_allow {
        return ProfileType::Development;
    }

    if has_devices {
        return ProfileType::Adhoc;
    }

    // Default to App Store distribution
    ProfileType::Appstore
}

/// Validates an App Store Connect API key.
///
/// Validates:
/// - Key ID: exactly 10 alphanumeric characters
/// - Issuer ID: valid UUID format
/// - Private key: contains proper PEM header
pub fn validate_api_key(key_id: &str, issuer_id: &str, private_key_pem: &str) -> Result<()> {
    // Validate Key ID: exactly 10 alphanumeric characters
    if key_id.len() != 10 {
        return Err(OoreError::Signing(format!(
            "Key ID must be exactly 10 characters, got {}",
            key_id.len()
        )));
    }
    if !key_id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(OoreError::Signing(
            "Key ID must contain only alphanumeric characters".to_string(),
        ));
    }

    // Validate Issuer ID: valid UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    let uuid_pattern = regex_lite::Regex::new(
        r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    ).unwrap();
    if !uuid_pattern.is_match(issuer_id) {
        return Err(OoreError::Signing(
            "Issuer ID must be a valid UUID (e.g., 12345678-1234-1234-1234-123456789012)".to_string(),
        ));
    }

    // Validate private key: must contain PEM header
    let key_trimmed = private_key_pem.trim();
    if !key_trimmed.contains("-----BEGIN PRIVATE KEY-----") {
        return Err(OoreError::Signing(
            "Private key must be in PEM format (should contain '-----BEGIN PRIVATE KEY-----')".to_string(),
        ));
    }
    if !key_trimmed.contains("-----END PRIVATE KEY-----") {
        return Err(OoreError::Signing(
            "Private key must be in PEM format (should contain '-----END PRIVATE KEY-----')".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_profile_type_development() {
        let mut dict = plist::Dictionary::new();
        let mut ents = plist::Dictionary::new();
        ents.insert("get-task-allow".to_string(), plist::Value::Boolean(true));
        dict.insert("Entitlements".to_string(), plist::Value::Dictionary(ents));
        dict.insert(
            "ProvisionedDevices".to_string(),
            plist::Value::Array(vec![plist::Value::String("device1".to_string())]),
        );

        assert_eq!(determine_profile_type(&dict), ProfileType::Development);
    }

    #[test]
    fn test_determine_profile_type_adhoc() {
        let mut dict = plist::Dictionary::new();
        let mut ents = plist::Dictionary::new();
        ents.insert("get-task-allow".to_string(), plist::Value::Boolean(false));
        dict.insert("Entitlements".to_string(), plist::Value::Dictionary(ents));
        dict.insert(
            "ProvisionedDevices".to_string(),
            plist::Value::Array(vec![plist::Value::String("device1".to_string())]),
        );

        assert_eq!(determine_profile_type(&dict), ProfileType::Adhoc);
    }

    #[test]
    fn test_determine_profile_type_appstore() {
        let mut dict = plist::Dictionary::new();
        let mut ents = plist::Dictionary::new();
        ents.insert("get-task-allow".to_string(), plist::Value::Boolean(false));
        dict.insert("Entitlements".to_string(), plist::Value::Dictionary(ents));

        assert_eq!(determine_profile_type(&dict), ProfileType::Appstore);
    }

    #[test]
    fn test_validate_api_key_valid() {
        let key_id = "ABC123XYZ0";
        let issuer_id = "12345678-1234-1234-1234-123456789012";
        let private_key = "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----";

        let result = validate_api_key(key_id, issuer_id, private_key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_api_key_invalid_key_id_length() {
        let key_id = "ABC123"; // Too short
        let issuer_id = "12345678-1234-1234-1234-123456789012";
        let private_key = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";

        let result = validate_api_key(key_id, issuer_id, private_key);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("10 characters"));
    }

    #[test]
    fn test_validate_api_key_invalid_key_id_chars() {
        let key_id = "ABC-123XY!"; // Invalid characters
        let issuer_id = "12345678-1234-1234-1234-123456789012";
        let private_key = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";

        let result = validate_api_key(key_id, issuer_id, private_key);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("alphanumeric"));
    }

    #[test]
    fn test_validate_api_key_invalid_issuer_id() {
        let key_id = "ABC123XYZ0";
        let issuer_id = "not-a-uuid";
        let private_key = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";

        let result = validate_api_key(key_id, issuer_id, private_key);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("UUID"));
    }

    #[test]
    fn test_validate_api_key_missing_pem_header() {
        let key_id = "ABC123XYZ0";
        let issuer_id = "12345678-1234-1234-1234-123456789012";
        let private_key = "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg..."; // No PEM header

        let result = validate_api_key(key_id, issuer_id, private_key);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("PEM format"));
    }
}
