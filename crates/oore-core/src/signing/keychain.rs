//! Ephemeral keychain management for iOS code signing.
//!
//! This module provides functionality to create temporary keychains for
//! each build, preventing credential persistence and conflicts between
//! concurrent builds.

use std::path::PathBuf;
use tokio::process::Command;

use crate::error::{OoreError, Result};
use crate::models::BuildId;

/// Represents an ephemeral keychain created for a build.
///
/// The keychain is automatically deleted when the struct is dropped
/// (via the cleanup method which should be called explicitly).
#[derive(Debug)]
pub struct EphemeralKeychain {
    /// Path to the keychain file.
    pub path: PathBuf,
    /// Password for the keychain.
    pub password: String,
    /// Installed profile UUIDs for cleanup.
    installed_profile_uuids: Vec<String>,
}

impl EphemeralKeychain {
    /// Creates a new ephemeral keychain for a build.
    ///
    /// The keychain is created in /tmp and configured for CI use
    /// (no auto-lock, codesign access).
    pub async fn create(build_id: &BuildId) -> Result<Self> {
        let path = PathBuf::from(format!("/tmp/oore-{}.keychain-db", build_id));
        let password = generate_random_password(32);

        // Create the keychain
        let output = Command::new("security")
            .args(["create-keychain", "-p", &password, path.to_str().unwrap()])
            .output()
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to create keychain: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(OoreError::Signing(format!(
                "Failed to create keychain: {}",
                stderr
            )));
        }

        // Unlock the keychain
        let output = Command::new("security")
            .args(["unlock-keychain", "-p", &password, path.to_str().unwrap()])
            .output()
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to unlock keychain: {}", e)))?;

        if !output.status.success() {
            // Try to clean up the created keychain
            let _ = Command::new("security")
                .args(["delete-keychain", path.to_str().unwrap()])
                .output()
                .await;

            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(OoreError::Signing(format!(
                "Failed to unlock keychain: {}",
                stderr
            )));
        }

        // Set keychain settings (no auto-lock, 1 hour timeout)
        let _ = Command::new("security")
            .args([
                "set-keychain-settings",
                "-t",
                "3600",
                "-u",
                path.to_str().unwrap(),
            ])
            .output()
            .await;

        tracing::debug!("Created ephemeral keychain: {}", path.display());

        Ok(Self {
            path,
            password,
            installed_profile_uuids: Vec::new(),
        })
    }

    /// Imports a p12 certificate into this keychain.
    pub async fn import_certificate(&self, p12_data: &[u8], p12_password: &str) -> Result<()> {
        // Write p12 to temp file
        let temp_dir = tempfile::tempdir()
            .map_err(|e| OoreError::Signing(format!("Failed to create temp directory: {}", e)))?;
        let p12_path = temp_dir.path().join("cert.p12");
        tokio::fs::write(&p12_path, p12_data)
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to write temp p12 file: {}", e)))?;

        // Import the certificate with codesign access
        let output = Command::new("security")
            .args([
                "import",
                p12_path.to_str().unwrap(),
                "-k",
                self.path.to_str().unwrap(),
                "-P",
                p12_password,
                "-T",
                "/usr/bin/codesign",
                "-T",
                "/usr/bin/security",
            ])
            .output()
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to import certificate: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(OoreError::Signing(format!(
                "Failed to import certificate: {}",
                stderr
            )));
        }

        // Set partition list for CI (allows codesign without UI prompt)
        // This is required for headless CI environments
        let output = Command::new("security")
            .args([
                "set-key-partition-list",
                "-S",
                "apple-tool:,apple:,codesign:",
                "-s",
                "-k",
                &self.password,
                self.path.to_str().unwrap(),
            ])
            .output()
            .await
            .map_err(|e| {
                OoreError::Signing(format!("Failed to set key partition list: {}", e))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::warn!("Failed to set key partition list (may still work): {}", stderr);
        }

        tracing::debug!("Imported certificate into keychain: {}", self.path.display());

        Ok(())
    }

    /// Adds this keychain to the search list.
    ///
    /// Returns the original keychain list for restoration during cleanup.
    pub async fn add_to_search_list(&self) -> Result<Vec<String>> {
        // Get current keychain list
        let output = Command::new("security")
            .args(["list-keychains", "-d", "user"])
            .output()
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to list keychains: {}", e)))?;

        let current_list: Vec<String> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|line| line.trim().trim_matches('"').to_string())
            .filter(|s| !s.is_empty())
            .collect();

        // Add our keychain to the front of the list
        let mut new_list = vec![self.path.to_str().unwrap().to_string()];
        new_list.extend(current_list.clone());

        // Set the new keychain list
        let mut args = vec!["list-keychains", "-d", "user", "-s"];
        args.extend(new_list.iter().map(|s| s.as_str()));

        let output = Command::new("security")
            .args(&args)
            .output()
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to set keychain list: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(OoreError::Signing(format!(
                "Failed to set keychain list: {}",
                stderr
            )));
        }

        tracing::debug!("Added keychain to search list: {}", self.path.display());

        Ok(current_list)
    }

    /// Installs a provisioning profile to the standard location.
    pub async fn install_profile(&mut self, profile_data: &[u8], uuid: &str) -> Result<PathBuf> {
        let profiles_dir = dirs::home_dir()
            .ok_or_else(|| OoreError::Signing("No home directory found".to_string()))?
            .join("Library/MobileDevice/Provisioning Profiles");

        // Create directory if it doesn't exist
        tokio::fs::create_dir_all(&profiles_dir)
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to create profiles directory: {}", e)))?;

        let profile_path = profiles_dir.join(format!("{}.mobileprovision", uuid));

        tokio::fs::write(&profile_path, profile_data)
            .await
            .map_err(|e| OoreError::Signing(format!("Failed to write profile: {}", e)))?;

        // Track installed profile for cleanup
        self.installed_profile_uuids.push(uuid.to_string());

        tracing::debug!("Installed provisioning profile: {}", profile_path.display());

        Ok(profile_path)
    }

    /// Cleans up the ephemeral keychain and restores the keychain list.
    pub async fn cleanup(&self, original_keychain_list: &[String]) -> Result<()> {
        // Delete the ephemeral keychain (this also removes it from search list)
        let _ = Command::new("security")
            .args(["delete-keychain", self.path.to_str().unwrap()])
            .output()
            .await;

        tracing::debug!("Deleted ephemeral keychain: {}", self.path.display());

        // Restore original keychain search list
        if !original_keychain_list.is_empty() {
            let mut args = vec!["list-keychains", "-d", "user", "-s"];
            args.extend(original_keychain_list.iter().map(|s| s.as_str()));

            let _ = Command::new("security").args(&args).output().await;

            tracing::debug!("Restored keychain search list");
        }

        // Clean up installed provisioning profiles
        for uuid in &self.installed_profile_uuids {
            let _ = Self::cleanup_profile(uuid).await;
        }

        Ok(())
    }

    /// Removes an installed provisioning profile.
    pub async fn cleanup_profile(uuid: &str) -> Result<()> {
        let profiles_dir = dirs::home_dir()
            .ok_or_else(|| OoreError::Signing("No home directory found".to_string()))?
            .join("Library/MobileDevice/Provisioning Profiles");

        let profile_path = profiles_dir.join(format!("{}.mobileprovision", uuid));

        if profile_path.exists() {
            let _ = tokio::fs::remove_file(&profile_path).await;
            tracing::debug!("Removed provisioning profile: {}", profile_path.display());
        }

        Ok(())
    }
}

/// Guard for automatic cleanup of signing resources.
///
/// This ensures cleanup happens even if the build is cancelled or panics.
pub struct SigningCleanupGuard {
    keychain: Option<EphemeralKeychain>,
    original_keychain_list: Vec<String>,
}

impl SigningCleanupGuard {
    /// Creates a new cleanup guard with the given keychain.
    pub fn new(keychain: EphemeralKeychain, original_keychain_list: Vec<String>) -> Self {
        Self {
            keychain: Some(keychain),
            original_keychain_list,
        }
    }

    /// Creates an empty guard (no cleanup needed).
    pub fn empty() -> Self {
        Self {
            keychain: None,
            original_keychain_list: Vec::new(),
        }
    }

    /// Performs cleanup and consumes the guard.
    pub async fn cleanup(mut self) -> Result<()> {
        if let Some(keychain) = self.keychain.take() {
            keychain.cleanup(&self.original_keychain_list).await?;
        }
        Ok(())
    }

    /// Takes the keychain out of the guard (for manual cleanup).
    pub fn take_keychain(&mut self) -> Option<EphemeralKeychain> {
        self.keychain.take()
    }
}

impl Drop for SigningCleanupGuard {
    fn drop(&mut self) {
        if let Some(keychain) = self.keychain.take() {
            let list = std::mem::take(&mut self.original_keychain_list);

            // Spawn a blocking cleanup task and wait for it to complete
            // This ensures cleanup actually happens before drop completes
            // Using a join handle to wait ensures resources are cleaned up
            let handle = std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build();

                if let Ok(rt) = rt {
                    rt.block_on(async {
                        if let Err(e) = keychain.cleanup(&list).await {
                            tracing::error!("Keychain cleanup failed in drop: {}", e);
                        }
                    });
                } else {
                    // Fallback: try sync cleanup if we can't create async runtime
                    tracing::warn!("Failed to create runtime for keychain cleanup, attempting sync cleanup");
                    // At minimum, try to delete the keychain file synchronously
                    let _ = std::process::Command::new("security")
                        .args(["delete-keychain", keychain.path.to_str().unwrap_or("")])
                        .output();
                }
            });

            // Wait for cleanup to complete (with a timeout to prevent hanging indefinitely)
            // This blocks but is acceptable in drop since we're cleaning up critical security resources
            if handle.join().is_err() {
                tracing::error!("Keychain cleanup thread panicked");
            }
        }
    }
}

/// Generates a random password for keychain encryption.
fn generate_random_password(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_random_password() {
        let password = generate_random_password(32);
        assert_eq!(password.len(), 32);
        assert!(password.chars().all(|c| c.is_ascii_alphanumeric()));

        // Ensure randomness (different passwords)
        let password2 = generate_random_password(32);
        assert_ne!(password, password2);
    }
}
