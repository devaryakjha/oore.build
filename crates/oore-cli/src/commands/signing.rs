//! Code signing management commands.

use std::path::PathBuf;

use anyhow::{bail, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use clap::Subcommand;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Subcommand)]
pub enum SigningCommands {
    /// Show signing configuration status
    Status {
        /// Repository ID
        repo_id: String,
    },

    /// iOS certificate management
    #[command(subcommand)]
    Ios(IosCommands),

    /// Android keystore management
    #[command(subcommand)]
    Android(AndroidCommands),
}

#[derive(Subcommand)]
pub enum IosCommands {
    /// List certificates
    ListCerts {
        /// Repository ID
        repo_id: String,
    },

    /// Upload certificate (.p12)
    UploadCert {
        /// Repository ID
        repo_id: String,

        /// Path to .p12 certificate file
        #[arg(long)]
        file: PathBuf,

        /// Certificate password
        #[arg(long)]
        password: String,

        /// Display name for the certificate
        #[arg(long)]
        name: Option<String>,

        /// Certificate type (distribution or development)
        #[arg(long, default_value = "distribution")]
        cert_type: String,
    },

    /// Delete certificate
    DeleteCert {
        /// Repository ID
        repo_id: String,

        /// Certificate ID
        cert_id: String,
    },

    /// List provisioning profiles
    ListProfiles {
        /// Repository ID
        repo_id: String,
    },

    /// Upload provisioning profile (.mobileprovision)
    UploadProfile {
        /// Repository ID
        repo_id: String,

        /// Path to .mobileprovision file
        #[arg(long)]
        file: PathBuf,

        /// Display name for the profile
        #[arg(long)]
        name: Option<String>,
    },

    /// Delete provisioning profile
    DeleteProfile {
        /// Repository ID
        repo_id: String,

        /// Profile ID
        profile_id: String,
    },

    /// List App Store Connect API keys
    ListApiKeys {
        /// Repository ID
        repo_id: String,
    },

    /// Upload App Store Connect API key (.p8)
    UploadApiKey {
        /// Repository ID
        repo_id: String,

        /// Apple Key ID (10 alphanumeric characters)
        #[arg(long)]
        key_id: String,

        /// Apple Issuer ID (UUID)
        #[arg(long)]
        issuer_id: String,

        /// Path to .p8 private key file
        #[arg(long)]
        file: PathBuf,

        /// Display name for the API key
        #[arg(long)]
        name: Option<String>,
    },

    /// Delete App Store Connect API key
    DeleteApiKey {
        /// Repository ID
        repo_id: String,

        /// API key ID (Oore internal ID, not Apple Key ID)
        id: String,
    },
}

#[derive(Subcommand)]
pub enum AndroidCommands {
    /// List keystores
    List {
        /// Repository ID
        repo_id: String,
    },

    /// Upload keystore (.jks/.keystore)
    Upload {
        /// Repository ID
        repo_id: String,

        /// Path to keystore file
        #[arg(long)]
        file: PathBuf,

        /// Keystore password
        #[arg(long)]
        password: String,

        /// Key alias
        #[arg(long)]
        alias: String,

        /// Key password
        #[arg(long)]
        key_password: String,

        /// Display name for the keystore
        #[arg(long)]
        name: Option<String>,

        /// Keystore type (jks or pkcs12)
        #[arg(long)]
        keystore_type: Option<String>,
    },

    /// Delete keystore
    Delete {
        /// Repository ID
        repo_id: String,

        /// Keystore ID
        keystore_id: String,
    },
}

// Response types
#[derive(Deserialize)]
struct SigningStatusResponse {
    signing_enabled: bool,
    ios: IosSigningStatus,
    android: AndroidSigningStatus,
}

#[derive(Deserialize)]
struct IosSigningStatus {
    certificates_count: usize,
    profiles_count: usize,
    api_keys_count: usize,
    has_active_certificate: bool,
    has_active_profile: bool,
    has_api_key: bool,
}

#[derive(Deserialize)]
struct AndroidSigningStatus {
    keystores_count: usize,
    has_active_keystore: bool,
}

#[derive(Deserialize)]
struct IosCertificateResponse {
    id: String,
    name: String,
    certificate_type: String,
    common_name: Option<String>,
    team_id: Option<String>,
    expires_at: Option<String>,
    is_active: bool,
}

#[derive(Deserialize)]
struct IosProfileResponse {
    id: String,
    name: String,
    profile_type: String,
    bundle_identifier: Option<String>,
    team_id: Option<String>,
    uuid: Option<String>,
    expires_at: Option<String>,
    is_active: bool,
}

#[derive(Deserialize)]
struct AndroidKeystoreResponse {
    id: String,
    name: String,
    key_alias: String,
    keystore_type: String,
    is_active: bool,
}

#[derive(Serialize)]
struct UploadCertificateRequest {
    certificate_data_base64: String,
    password: String,
    name: String,
    certificate_type: String,
}

#[derive(Serialize)]
struct UploadProfileRequest {
    profile_data_base64: String,
    name: Option<String>,
}

#[derive(Serialize)]
struct UploadKeystoreRequest {
    keystore_data_base64: String,
    keystore_password: String,
    key_alias: String,
    key_password: String,
    name: String,
    keystore_type: Option<String>,
}

#[derive(Deserialize)]
struct AppStoreConnectApiKeyResponse {
    id: String,
    name: String,
    key_id: String,
    issuer_id_masked: String,
    is_active: bool,
}

#[derive(Serialize)]
struct UploadApiKeyRequest {
    name: String,
    key_id: String,
    issuer_id: String,
    private_key_base64: String,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
}

fn create_client(server: &str, admin_token: &str) -> Result<reqwest::Client> {
    let server_url = Url::parse(server).context("Invalid server URL")?;

    if !admin_token.is_empty() {
        let is_loopback = matches!(
            server_url.host_str(),
            Some("localhost") | Some("127.0.0.1") | Some("::1")
        );

        if server_url.scheme() != "https" && !is_loopback {
            bail!("Admin token requires HTTPS connection (except for localhost)");
        }
    }

    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .context("Failed to create HTTP client")
}

pub async fn handle_signing_command(
    server: &str,
    admin_token: &str,
    cmd: SigningCommands,
) -> Result<()> {
    match cmd {
        SigningCommands::Status { repo_id } => get_status(server, admin_token, &repo_id).await,
        SigningCommands::Ios(ios_cmd) => handle_ios_command(server, admin_token, ios_cmd).await,
        SigningCommands::Android(android_cmd) => {
            handle_android_command(server, admin_token, android_cmd).await
        }
    }
}

async fn handle_ios_command(server: &str, admin_token: &str, cmd: IosCommands) -> Result<()> {
    match cmd {
        IosCommands::ListCerts { repo_id } => list_certificates(server, admin_token, &repo_id).await,
        IosCommands::UploadCert {
            repo_id,
            file,
            password,
            name,
            cert_type,
        } => upload_certificate(server, admin_token, &repo_id, &file, &password, name, &cert_type).await,
        IosCommands::DeleteCert { repo_id, cert_id } => {
            delete_certificate(server, admin_token, &repo_id, &cert_id).await
        }
        IosCommands::ListProfiles { repo_id } => list_profiles(server, admin_token, &repo_id).await,
        IosCommands::UploadProfile { repo_id, file, name } => {
            upload_profile(server, admin_token, &repo_id, &file, name).await
        }
        IosCommands::DeleteProfile { repo_id, profile_id } => {
            delete_profile(server, admin_token, &repo_id, &profile_id).await
        }
        IosCommands::ListApiKeys { repo_id } => list_api_keys(server, admin_token, &repo_id).await,
        IosCommands::UploadApiKey {
            repo_id,
            key_id,
            issuer_id,
            file,
            name,
        } => upload_api_key(server, admin_token, &repo_id, &key_id, &issuer_id, &file, name).await,
        IosCommands::DeleteApiKey { repo_id, id } => {
            delete_api_key(server, admin_token, &repo_id, &id).await
        }
    }
}

async fn handle_android_command(
    server: &str,
    admin_token: &str,
    cmd: AndroidCommands,
) -> Result<()> {
    match cmd {
        AndroidCommands::List { repo_id } => list_keystores(server, admin_token, &repo_id).await,
        AndroidCommands::Upload {
            repo_id,
            file,
            password,
            alias,
            key_password,
            name,
            keystore_type,
        } => {
            upload_keystore(
                server,
                admin_token,
                &repo_id,
                &file,
                &password,
                &alias,
                &key_password,
                name,
                keystore_type,
            )
            .await
        }
        AndroidCommands::Delete {
            repo_id,
            keystore_id,
        } => delete_keystore(server, admin_token, &repo_id, &keystore_id).await,
    }
}

// ============================================================================
// Signing Status
// ============================================================================

async fn get_status(server: &str, admin_token: &str, repo_id: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!("{}/api/repositories/{}/signing/status", server, repo_id);
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let status: SigningStatusResponse = response.json().await.context("Failed to parse response")?;

    println!("Signing Status for Repository {}", repo_id);
    println!("{}", "=".repeat(50));
    println!();
    println!(
        "Signing Enabled: {}",
        if status.signing_enabled { "Yes" } else { "No" }
    );
    println!();

    println!("iOS:");
    println!("  Certificates: {}", status.ios.certificates_count);
    println!("  Profiles:     {}", status.ios.profiles_count);
    println!("  API Keys:     {}", status.ios.api_keys_count);
    println!(
        "  Active cert:  {}",
        if status.ios.has_active_certificate {
            "Yes"
        } else {
            "No"
        }
    );
    println!(
        "  Active profile: {}",
        if status.ios.has_active_profile {
            "Yes"
        } else {
            "No"
        }
    );
    println!(
        "  Has API key:  {}",
        if status.ios.has_api_key { "Yes" } else { "No" }
    );
    println!();

    println!("Android:");
    println!("  Keystores: {}", status.android.keystores_count);
    println!(
        "  Active:    {}",
        if status.android.has_active_keystore {
            "Yes"
        } else {
            "No"
        }
    );

    Ok(())
}

// ============================================================================
// iOS Certificates
// ============================================================================

async fn list_certificates(server: &str, admin_token: &str, repo_id: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/ios/certificates",
        server, repo_id
    );
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let certs: Vec<IosCertificateResponse> =
        response.json().await.context("Failed to parse response")?;

    if certs.is_empty() {
        println!("No iOS certificates found.");
        println!();
        println!(
            "Use 'oore signing ios upload-cert {} --file cert.p12 --password <pwd>' to upload one.",
            repo_id
        );
        return Ok(());
    }

    println!("iOS Certificates");
    println!("{}", "=".repeat(80));
    println!();
    println!(
        "{:<28} {:<20} {:<15} {:<8}",
        "ID", "NAME", "TYPE", "ACTIVE"
    );
    println!("{}", "-".repeat(80));

    for cert in &certs {
        let name_short = if cert.name.len() > 18 {
            format!("{}...", &cert.name[..15])
        } else {
            cert.name.clone()
        };

        println!(
            "{:<28} {:<20} {:<15} {:<8}",
            cert.id,
            name_short,
            cert.certificate_type,
            if cert.is_active { "Yes" } else { "No" }
        );
    }

    Ok(())
}

async fn upload_certificate(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    file: &PathBuf,
    password: &str,
    name: Option<String>,
    cert_type: &str,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    // Read and encode file
    let cert_data = std::fs::read(file).context("Failed to read certificate file")?;
    let cert_data_base64 = BASE64.encode(&cert_data);

    // Derive name from filename if not provided
    let cert_name = name.unwrap_or_else(|| {
        file.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Certificate".to_string())
    });

    let request = UploadCertificateRequest {
        certificate_data_base64: cert_data_base64,
        password: password.to_string(),
        name: cert_name,
        certificate_type: cert_type.to_string(),
    };

    let url = format!(
        "{}/api/repositories/{}/signing/ios/certificates",
        server, repo_id
    );
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let cert: IosCertificateResponse = response.json().await.context("Failed to parse response")?;

    println!("Certificate uploaded successfully!");
    println!();
    println!("  ID:        {}", cert.id);
    println!("  Name:      {}", cert.name);
    println!("  Type:      {}", cert.certificate_type);
    if let Some(cn) = &cert.common_name {
        println!("  Subject:   {}", cn);
    }
    if let Some(team) = &cert.team_id {
        println!("  Team ID:   {}", team);
    }
    if let Some(exp) = &cert.expires_at {
        println!("  Expires:   {}", exp);
    }

    Ok(())
}

async fn delete_certificate(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    cert_id: &str,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/ios/certificates/{}",
        server, repo_id, cert_id
    );
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("Certificate {} deleted.", cert_id);
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    println!("Certificate {} deleted.", cert_id);
    Ok(())
}

// ============================================================================
// iOS Provisioning Profiles
// ============================================================================

async fn list_profiles(server: &str, admin_token: &str, repo_id: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/ios/profiles",
        server, repo_id
    );
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let profiles: Vec<IosProfileResponse> =
        response.json().await.context("Failed to parse response")?;

    if profiles.is_empty() {
        println!("No iOS provisioning profiles found.");
        println!();
        println!(
            "Use 'oore signing ios upload-profile {} --file profile.mobileprovision' to upload one.",
            repo_id
        );
        return Ok(());
    }

    println!("iOS Provisioning Profiles");
    println!("{}", "=".repeat(90));
    println!();
    println!(
        "{:<28} {:<25} {:<20} {:<8}",
        "ID", "NAME", "TYPE", "ACTIVE"
    );
    println!("{}", "-".repeat(90));

    for profile in &profiles {
        let name_short = if profile.name.len() > 23 {
            format!("{}...", &profile.name[..20])
        } else {
            profile.name.clone()
        };

        println!(
            "{:<28} {:<25} {:<20} {:<8}",
            profile.id,
            name_short,
            profile.profile_type,
            if profile.is_active { "Yes" } else { "No" }
        );
    }

    Ok(())
}

async fn upload_profile(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    file: &PathBuf,
    name: Option<String>,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    // Read and encode file
    let profile_data = std::fs::read(file).context("Failed to read profile file")?;
    let profile_data_base64 = BASE64.encode(&profile_data);

    let request = UploadProfileRequest {
        profile_data_base64,
        name,
    };

    let url = format!(
        "{}/api/repositories/{}/signing/ios/profiles",
        server, repo_id
    );
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let profile: IosProfileResponse = response.json().await.context("Failed to parse response")?;

    println!("Profile uploaded successfully!");
    println!();
    println!("  ID:         {}", profile.id);
    println!("  Name:       {}", profile.name);
    println!("  Type:       {}", profile.profile_type);
    if let Some(bundle_id) = &profile.bundle_identifier {
        println!("  Bundle ID:  {}", bundle_id);
    }
    if let Some(uuid) = &profile.uuid {
        println!("  UUID:       {}", uuid);
    }
    if let Some(team) = &profile.team_id {
        println!("  Team ID:    {}", team);
    }
    if let Some(exp) = &profile.expires_at {
        println!("  Expires:    {}", exp);
    }

    Ok(())
}

async fn delete_profile(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    profile_id: &str,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/ios/profiles/{}",
        server, repo_id, profile_id
    );
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("Profile {} deleted.", profile_id);
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    println!("Profile {} deleted.", profile_id);
    Ok(())
}

// ============================================================================
// Android Keystores
// ============================================================================

async fn list_keystores(server: &str, admin_token: &str, repo_id: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/android/keystores",
        server, repo_id
    );
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let keystores: Vec<AndroidKeystoreResponse> =
        response.json().await.context("Failed to parse response")?;

    if keystores.is_empty() {
        println!("No Android keystores found.");
        println!();
        println!(
            "Use 'oore signing android upload {} --file keystore.jks --password <pwd> --alias <alias> --key-password <pwd>' to upload one.",
            repo_id
        );
        return Ok(());
    }

    println!("Android Keystores");
    println!("{}", "=".repeat(80));
    println!();
    println!(
        "{:<28} {:<20} {:<15} {:<10} {:<8}",
        "ID", "NAME", "ALIAS", "TYPE", "ACTIVE"
    );
    println!("{}", "-".repeat(80));

    for ks in &keystores {
        let name_short = if ks.name.len() > 18 {
            format!("{}...", &ks.name[..15])
        } else {
            ks.name.clone()
        };

        let alias_short = if ks.key_alias.len() > 13 {
            format!("{}...", &ks.key_alias[..10])
        } else {
            ks.key_alias.clone()
        };

        println!(
            "{:<28} {:<20} {:<15} {:<10} {:<8}",
            ks.id,
            name_short,
            alias_short,
            ks.keystore_type,
            if ks.is_active { "Yes" } else { "No" }
        );
    }

    Ok(())
}

async fn upload_keystore(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    file: &PathBuf,
    password: &str,
    alias: &str,
    key_password: &str,
    name: Option<String>,
    keystore_type: Option<String>,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    // Read and encode file
    let keystore_data = std::fs::read(file).context("Failed to read keystore file")?;
    let keystore_data_base64 = BASE64.encode(&keystore_data);

    // Derive name from filename if not provided
    let ks_name = name.unwrap_or_else(|| {
        file.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Keystore".to_string())
    });

    let request = UploadKeystoreRequest {
        keystore_data_base64,
        keystore_password: password.to_string(),
        key_alias: alias.to_string(),
        key_password: key_password.to_string(),
        name: ks_name,
        keystore_type,
    };

    let url = format!(
        "{}/api/repositories/{}/signing/android/keystores",
        server, repo_id
    );
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let keystore: AndroidKeystoreResponse =
        response.json().await.context("Failed to parse response")?;

    println!("Keystore uploaded successfully!");
    println!();
    println!("  ID:    {}", keystore.id);
    println!("  Name:  {}", keystore.name);
    println!("  Alias: {}", keystore.key_alias);
    println!("  Type:  {}", keystore.keystore_type);

    Ok(())
}

async fn delete_keystore(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    keystore_id: &str,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/android/keystores/{}",
        server, repo_id, keystore_id
    );
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("Keystore {} deleted.", keystore_id);
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    println!("Keystore {} deleted.", keystore_id);
    Ok(())
}

// ============================================================================
// App Store Connect API Keys
// ============================================================================

async fn list_api_keys(server: &str, admin_token: &str, repo_id: &str) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/ios/api-keys",
        server, repo_id
    );
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let keys: Vec<AppStoreConnectApiKeyResponse> =
        response.json().await.context("Failed to parse response")?;

    if keys.is_empty() {
        println!("No App Store Connect API keys found.");
        println!();
        println!(
            "Use 'oore signing ios upload-api-key {} --key-id <KEY_ID> --issuer-id <ISSUER_ID> --file AuthKey.p8' to upload one.",
            repo_id
        );
        return Ok(());
    }

    println!("App Store Connect API Keys");
    println!("{}", "=".repeat(90));
    println!();
    println!(
        "{:<28} {:<20} {:<12} {:<20} {:<8}",
        "ID", "NAME", "KEY ID", "ISSUER ID", "ACTIVE"
    );
    println!("{}", "-".repeat(90));

    for key in &keys {
        let name_short = if key.name.len() > 18 {
            format!("{}...", &key.name[..15])
        } else {
            key.name.clone()
        };

        println!(
            "{:<28} {:<20} {:<12} {:<20} {:<8}",
            key.id,
            name_short,
            key.key_id,
            key.issuer_id_masked,
            if key.is_active { "Yes" } else { "No" }
        );
    }

    Ok(())
}

async fn upload_api_key(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    key_id: &str,
    issuer_id: &str,
    file: &PathBuf,
    name: Option<String>,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    // Read and encode file
    let private_key_data = std::fs::read(file).context("Failed to read private key file")?;
    let private_key_base64 = BASE64.encode(&private_key_data);

    // Derive name from key_id if not provided
    let api_key_name = name.unwrap_or_else(|| format!("API Key {}", key_id));

    let request = UploadApiKeyRequest {
        name: api_key_name,
        key_id: key_id.to_string(),
        issuer_id: issuer_id.to_string(),
        private_key_base64,
    };

    let url = format!(
        "{}/api/repositories/{}/signing/ios/api-keys",
        server, repo_id
    );
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    let key: AppStoreConnectApiKeyResponse = response.json().await.context("Failed to parse response")?;

    println!("API key uploaded successfully!");
    println!();
    println!("  ID:        {}", key.id);
    println!("  Name:      {}", key.name);
    println!("  Key ID:    {}", key.key_id);
    println!("  Issuer ID: {}", key.issuer_id_masked);

    Ok(())
}

async fn delete_api_key(
    server: &str,
    admin_token: &str,
    repo_id: &str,
    api_key_id: &str,
) -> Result<()> {
    let client = create_client(server, admin_token)?;

    let url = format!(
        "{}/api/repositories/{}/signing/ios/api-keys/{}",
        server, repo_id, api_key_id
    );
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", admin_token))
        .send()
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        println!("API key {} deleted.", api_key_id);
        return Ok(());
    }

    if !response.status().is_success() {
        let error: ErrorResponse = response.json().await.context("Failed to parse error")?;
        bail!("{}", error.error);
    }

    println!("API key {} deleted.", api_key_id);
    Ok(())
}
