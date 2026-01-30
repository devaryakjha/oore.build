//! Code signing models for iOS and Android.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use super::RepositoryId;

// ============================================================================
// iOS Signing Certificate
// ============================================================================

/// Unique identifier for an iOS signing certificate.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct IosCertificateId(pub Ulid);

impl IosCertificateId {
    /// Creates a new random certificate ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a certificate ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for IosCertificateId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for IosCertificateId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// iOS certificate type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CertificateType {
    Development,
    Distribution,
}

impl CertificateType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CertificateType::Development => "development",
            CertificateType::Distribution => "distribution",
        }
    }
}

impl std::str::FromStr for CertificateType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "development" => Ok(CertificateType::Development),
            "distribution" => Ok(CertificateType::Distribution),
            _ => Err(format!("Unknown certificate type: {}", s)),
        }
    }
}

impl std::fmt::Display for CertificateType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// iOS signing certificate (internal model with encrypted data).
#[derive(Debug, Clone)]
pub struct IosCertificate {
    pub id: IosCertificateId,
    pub repository_id: RepositoryId,
    pub name: String,
    pub certificate_type: CertificateType,
    /// Encrypted p12 data (AES-256-GCM with AAD).
    pub certificate_data_encrypted: Vec<u8>,
    pub certificate_data_nonce: Vec<u8>,
    /// Encrypted password.
    pub password_encrypted: Vec<u8>,
    pub password_nonce: Vec<u8>,
    /// Metadata extracted from certificate.
    pub common_name: Option<String>,
    pub team_id: Option<String>,
    pub serial_number: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to upload an iOS certificate.
#[derive(Debug, Clone, Deserialize)]
pub struct UploadCertificateRequest {
    pub name: String,
    pub certificate_type: CertificateType,
    /// Base64-encoded p12 data.
    pub certificate_data_base64: String,
    /// Password for the p12 file.
    pub password: String,
}

/// Response for iOS certificate (no secrets).
#[derive(Debug, Clone, Serialize)]
pub struct IosCertificateResponse {
    pub id: String,
    pub repository_id: String,
    pub name: String,
    pub certificate_type: String,
    pub common_name: Option<String>,
    pub team_id: Option<String>,
    pub expires_at: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

impl From<IosCertificate> for IosCertificateResponse {
    fn from(cert: IosCertificate) -> Self {
        Self {
            id: cert.id.to_string(),
            repository_id: cert.repository_id.to_string(),
            name: cert.name,
            certificate_type: cert.certificate_type.as_str().to_string(),
            common_name: cert.common_name,
            team_id: cert.team_id,
            expires_at: cert.expires_at.map(|t| t.to_rfc3339()),
            is_active: cert.is_active,
            created_at: cert.created_at.to_rfc3339(),
        }
    }
}

// ============================================================================
// iOS Provisioning Profile
// ============================================================================

/// Unique identifier for an iOS provisioning profile.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct IosProfileId(pub Ulid);

impl IosProfileId {
    /// Creates a new random profile ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a profile ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for IosProfileId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for IosProfileId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// iOS provisioning profile type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProfileType {
    Development,
    Adhoc,
    Appstore,
    Enterprise,
}

impl ProfileType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProfileType::Development => "development",
            ProfileType::Adhoc => "adhoc",
            ProfileType::Appstore => "appstore",
            ProfileType::Enterprise => "enterprise",
        }
    }
}

impl std::str::FromStr for ProfileType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "development" => Ok(ProfileType::Development),
            "adhoc" => Ok(ProfileType::Adhoc),
            "appstore" => Ok(ProfileType::Appstore),
            "enterprise" => Ok(ProfileType::Enterprise),
            _ => Err(format!("Unknown profile type: {}", s)),
        }
    }
}

impl std::fmt::Display for ProfileType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// iOS provisioning profile (internal model with encrypted data).
#[derive(Debug, Clone)]
pub struct IosProfile {
    pub id: IosProfileId,
    pub repository_id: RepositoryId,
    pub name: String,
    pub profile_type: ProfileType,
    /// Encrypted mobileprovision data.
    pub profile_data_encrypted: Vec<u8>,
    pub profile_data_nonce: Vec<u8>,
    /// Metadata extracted from profile.
    pub bundle_identifier: Option<String>,
    pub team_id: Option<String>,
    pub uuid: String,
    pub app_id_name: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to upload an iOS provisioning profile.
#[derive(Debug, Clone, Deserialize)]
pub struct UploadProfileRequest {
    /// Base64-encoded mobileprovision data.
    pub profile_data_base64: String,
    /// Optional name (defaults to profile's app_id_name).
    pub name: Option<String>,
}

/// Response for iOS provisioning profile (no secrets).
#[derive(Debug, Clone, Serialize)]
pub struct IosProfileResponse {
    pub id: String,
    pub repository_id: String,
    pub name: String,
    pub profile_type: String,
    pub bundle_identifier: Option<String>,
    pub team_id: Option<String>,
    pub uuid: String,
    pub app_id_name: Option<String>,
    pub expires_at: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

impl From<IosProfile> for IosProfileResponse {
    fn from(profile: IosProfile) -> Self {
        Self {
            id: profile.id.to_string(),
            repository_id: profile.repository_id.to_string(),
            name: profile.name,
            profile_type: profile.profile_type.as_str().to_string(),
            bundle_identifier: profile.bundle_identifier,
            team_id: profile.team_id,
            uuid: profile.uuid,
            app_id_name: profile.app_id_name,
            expires_at: profile.expires_at.map(|t| t.to_rfc3339()),
            is_active: profile.is_active,
            created_at: profile.created_at.to_rfc3339(),
        }
    }
}

// ============================================================================
// App Store Connect API Key
// ============================================================================

/// Unique identifier for an App Store Connect API key.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AppStoreConnectApiKeyId(pub Ulid);

impl AppStoreConnectApiKeyId {
    /// Creates a new random API key ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates an API key ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for AppStoreConnectApiKeyId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for AppStoreConnectApiKeyId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// App Store Connect API key (internal model with encrypted private key).
#[derive(Debug, Clone)]
pub struct AppStoreConnectApiKey {
    pub id: AppStoreConnectApiKeyId,
    pub repository_id: RepositoryId,
    pub name: String,
    /// Apple's Key ID (10 alphanumeric characters).
    pub key_id: String,
    /// Apple's Issuer ID (UUID).
    pub issuer_id: String,
    /// Encrypted .p8 private key data.
    pub private_key_encrypted: Vec<u8>,
    pub private_key_nonce: Vec<u8>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to upload an App Store Connect API key.
#[derive(Debug, Clone, Deserialize)]
pub struct UploadApiKeyRequest {
    pub name: String,
    /// Apple's Key ID (10 alphanumeric characters).
    pub key_id: String,
    /// Apple's Issuer ID (UUID).
    pub issuer_id: String,
    /// Base64-encoded .p8 private key content.
    pub private_key_base64: String,
}

/// Response for App Store Connect API key (no secrets).
#[derive(Debug, Clone, Serialize)]
pub struct AppStoreConnectApiKeyResponse {
    pub id: String,
    pub repository_id: String,
    pub name: String,
    pub key_id: String,
    /// Masked issuer ID for display (shows first 8 and last 4 characters).
    pub issuer_id_masked: String,
    pub is_active: bool,
    pub created_at: String,
}

impl From<AppStoreConnectApiKey> for AppStoreConnectApiKeyResponse {
    fn from(key: AppStoreConnectApiKey) -> Self {
        // Mask the issuer ID for security (show first 8 and last 4 chars)
        let issuer_id_masked = if key.issuer_id.len() > 12 {
            format!(
                "{}...{}",
                &key.issuer_id[..8],
                &key.issuer_id[key.issuer_id.len() - 4..]
            )
        } else {
            key.issuer_id.clone()
        };

        Self {
            id: key.id.to_string(),
            repository_id: key.repository_id.to_string(),
            name: key.name,
            key_id: key.key_id,
            issuer_id_masked,
            is_active: key.is_active,
            created_at: key.created_at.to_rfc3339(),
        }
    }
}

// ============================================================================
// Android Keystore
// ============================================================================

/// Unique identifier for an Android keystore.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AndroidKeystoreId(pub Ulid);

impl AndroidKeystoreId {
    /// Creates a new random keystore ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates a keystore ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for AndroidKeystoreId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for AndroidKeystoreId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Android keystore type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeystoreType {
    Jks,
    Pkcs12,
}

impl KeystoreType {
    pub fn as_str(&self) -> &'static str {
        match self {
            KeystoreType::Jks => "jks",
            KeystoreType::Pkcs12 => "pkcs12",
        }
    }
}

impl std::str::FromStr for KeystoreType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "jks" => Ok(KeystoreType::Jks),
            "pkcs12" => Ok(KeystoreType::Pkcs12),
            _ => Err(format!("Unknown keystore type: {}", s)),
        }
    }
}

impl std::fmt::Display for KeystoreType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Android keystore (internal model with encrypted data).
#[derive(Debug, Clone)]
pub struct AndroidKeystore {
    pub id: AndroidKeystoreId,
    pub repository_id: RepositoryId,
    pub name: String,
    /// Encrypted keystore data (JKS or PKCS12).
    pub keystore_data_encrypted: Vec<u8>,
    pub keystore_data_nonce: Vec<u8>,
    /// Encrypted keystore password.
    pub keystore_password_encrypted: Vec<u8>,
    pub keystore_password_nonce: Vec<u8>,
    pub key_alias: String,
    /// Encrypted key password.
    pub key_password_encrypted: Vec<u8>,
    pub key_password_nonce: Vec<u8>,
    pub keystore_type: KeystoreType,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to upload an Android keystore.
#[derive(Debug, Clone, Deserialize)]
pub struct UploadKeystoreRequest {
    pub name: String,
    /// Base64-encoded keystore data.
    pub keystore_data_base64: String,
    pub keystore_password: String,
    pub key_alias: String,
    pub key_password: String,
    #[serde(default)]
    pub keystore_type: Option<KeystoreType>,
}

/// Response for Android keystore (no secrets).
#[derive(Debug, Clone, Serialize)]
pub struct AndroidKeystoreResponse {
    pub id: String,
    pub repository_id: String,
    pub name: String,
    pub key_alias: String,
    pub keystore_type: String,
    pub is_active: bool,
    pub created_at: String,
}

impl From<AndroidKeystore> for AndroidKeystoreResponse {
    fn from(ks: AndroidKeystore) -> Self {
        Self {
            id: ks.id.to_string(),
            repository_id: ks.repository_id.to_string(),
            name: ks.name,
            key_alias: ks.key_alias,
            keystore_type: ks.keystore_type.as_str().to_string(),
            is_active: ks.is_active,
            created_at: ks.created_at.to_rfc3339(),
        }
    }
}

// ============================================================================
// Signing Status Response
// ============================================================================

/// Combined signing status for a repository.
#[derive(Debug, Clone, Serialize)]
pub struct SigningStatusResponse {
    pub signing_enabled: bool,
    pub ios: IosSigningStatus,
    pub android: AndroidSigningStatus,
}

/// iOS signing status for a repository.
#[derive(Debug, Clone, Serialize)]
pub struct IosSigningStatus {
    pub certificates_count: usize,
    pub profiles_count: usize,
    pub api_keys_count: usize,
    pub has_active_certificate: bool,
    pub has_active_profile: bool,
    pub has_api_key: bool,
}

/// Android signing status for a repository.
#[derive(Debug, Clone, Serialize)]
pub struct AndroidSigningStatus {
    pub keystores_count: usize,
    pub has_active_keystore: bool,
}
