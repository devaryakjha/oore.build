//! Android keystore validation and key.properties generation.
//!
//! This module handles validating Android keystores and generating
//! the key.properties file needed by Flutter/Gradle for signing.

use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

use crate::error::{OoreError, Result};
use crate::models::KeystoreType;

/// Information extracted from a keystore.
#[derive(Debug, Clone)]
pub struct KeystoreInfo {
    /// Type of the keystore (JKS or PKCS12).
    pub keystore_type: KeystoreType,
    /// Whether the alias exists in the keystore.
    pub alias_exists: bool,
}

/// Validates a keystore and extracts info.
///
/// Uses the `keytool` CLI to validate the keystore and check the alias.
pub async fn validate_keystore(
    data: &[u8],
    password: &str,
    alias: &str,
    _key_password: &str,
) -> Result<KeystoreInfo> {
    // Write keystore to temp file
    let temp_dir = tempfile::tempdir()
        .map_err(|e| OoreError::Signing(format!("Failed to create temp directory: {}", e)))?;
    let keystore_path = temp_dir.path().join("keystore");
    tokio::fs::write(&keystore_path, data)
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to write temp keystore file: {}", e)))?;

    // Try to determine keystore type and validate
    let keystore_type = detect_keystore_type(data);

    // Validate keystore can be opened and alias exists
    let output = Command::new("keytool")
        .args([
            "-list",
            "-keystore",
            keystore_path.to_str().unwrap(),
            "-storepass",
            password,
            "-alias",
            alias,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to run keytool: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Check for specific error messages
        if stderr.contains("keystore password was incorrect") {
            return Err(OoreError::Signing(
                "Invalid keystore password".to_string(),
            ));
        }
        if stderr.contains("does not exist") {
            return Err(OoreError::Signing(format!(
                "Alias '{}' not found in keystore",
                alias
            )));
        }
        if stderr.contains("Invalid keystore format") {
            return Err(OoreError::Signing(
                "Invalid keystore format".to_string(),
            ));
        }

        return Err(OoreError::Signing(format!(
            "Failed to validate keystore: {}",
            stderr
        )));
    }

    Ok(KeystoreInfo {
        keystore_type,
        alias_exists: true,
    })
}

/// Detects the keystore type from its magic bytes.
fn detect_keystore_type(data: &[u8]) -> KeystoreType {
    // PKCS12 files start with 0x30 (ASN.1 SEQUENCE)
    // JKS files start with magic bytes 0xFEEDFEED
    if data.len() >= 4 {
        if data[0] == 0xFE
            && data[1] == 0xED
            && data[2] == 0xFE
            && data[3] == 0xED
        {
            return KeystoreType::Jks;
        }
    }

    // Default to PKCS12 for other formats
    KeystoreType::Pkcs12
}

/// Generates a key.properties file content for Flutter/Gradle.
///
/// The key.properties file is read by the Gradle build script to
/// configure signing for release builds.
pub fn generate_key_properties(
    keystore_path: &Path,
    keystore_password: &str,
    key_alias: &str,
    key_password: &str,
) -> String {
    format!(
        "storePassword={}\n\
         keyPassword={}\n\
         keyAlias={}\n\
         storeFile={}\n",
        keystore_password,
        key_password,
        key_alias,
        keystore_path.display()
    )
}

/// Writes the key.properties file to the Android project directory.
pub async fn write_key_properties(
    workspace: &Path,
    keystore_path: &Path,
    keystore_password: &str,
    key_alias: &str,
    key_password: &str,
) -> Result<()> {
    let android_dir = workspace.join("android");

    // Ensure android directory exists
    if !android_dir.exists() {
        return Err(OoreError::Signing(
            "Android directory not found in workspace".to_string(),
        ));
    }

    let key_properties_path = android_dir.join("key.properties");
    let content = generate_key_properties(keystore_path, keystore_password, key_alias, key_password);

    tokio::fs::write(&key_properties_path, content)
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to write key.properties: {}", e)))?;

    tracing::debug!("Wrote key.properties to {}", key_properties_path.display());

    Ok(())
}

/// Removes the key.properties file from the Android project directory.
pub async fn cleanup_key_properties(workspace: &Path) -> Result<()> {
    let key_properties_path = workspace.join("android/key.properties");

    if key_properties_path.exists() {
        tokio::fs::remove_file(&key_properties_path)
            .await
            .map_err(|e| {
                OoreError::Signing(format!("Failed to remove key.properties: {}", e))
            })?;
        tracing::debug!("Removed key.properties from {}", key_properties_path.display());
    }

    Ok(())
}

/// Writes the keystore file to a secure location in the workspace.
pub async fn write_keystore(
    workspace: &Path,
    keystore_data: &[u8],
    keystore_type: KeystoreType,
) -> Result<std::path::PathBuf> {
    let signing_dir = workspace.join(".oore/signing");

    // Create signing directory
    tokio::fs::create_dir_all(&signing_dir)
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to create signing directory: {}", e)))?;

    let extension = match keystore_type {
        KeystoreType::Jks => "jks",
        KeystoreType::Pkcs12 => "keystore",
    };

    let keystore_path = signing_dir.join(format!("keystore.{}", extension));

    tokio::fs::write(&keystore_path, keystore_data)
        .await
        .map_err(|e| OoreError::Signing(format!("Failed to write keystore: {}", e)))?;

    tracing::debug!("Wrote keystore to {}", keystore_path.display());

    Ok(keystore_path)
}

/// Cleans up Android signing artifacts from the workspace.
pub async fn cleanup_android_signing(workspace: &Path) -> Result<()> {
    // Remove key.properties
    let _ = cleanup_key_properties(workspace).await;

    // Remove .oore/signing directory
    let signing_dir = workspace.join(".oore/signing");
    if signing_dir.exists() {
        tokio::fs::remove_dir_all(&signing_dir).await.map_err(|e| {
            OoreError::Signing(format!("Failed to remove signing directory: {}", e))
        })?;
        tracing::debug!("Removed signing directory: {}", signing_dir.display());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_keystore_type_jks() {
        let jks_magic = [0xFE, 0xED, 0xFE, 0xED, 0x00, 0x00, 0x00, 0x02];
        assert_eq!(detect_keystore_type(&jks_magic), KeystoreType::Jks);
    }

    #[test]
    fn test_detect_keystore_type_pkcs12() {
        let pkcs12_start = [0x30, 0x82, 0x01, 0x00];
        assert_eq!(detect_keystore_type(&pkcs12_start), KeystoreType::Pkcs12);
    }

    #[test]
    fn test_generate_key_properties() {
        let content = generate_key_properties(
            Path::new("/path/to/keystore.jks"),
            "storepass",
            "myalias",
            "keypass",
        );

        assert!(content.contains("storePassword=storepass"));
        assert!(content.contains("keyPassword=keypass"));
        assert!(content.contains("keyAlias=myalias"));
        assert!(content.contains("storeFile=/path/to/keystore.jks"));
    }
}
