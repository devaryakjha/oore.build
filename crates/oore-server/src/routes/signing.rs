//! Code signing endpoints for iOS and Android.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use oore_core::{
    db::{
        repository::RepositoryRepo,
        signing::{
            AndroidKeystoreRepo, AppStoreConnectApiKeyRepo, IosCertificateRepo, IosProfileRepo,
        },
    },
    models::{
        AndroidKeystore, AndroidKeystoreId, AndroidKeystoreResponse, AndroidSigningStatus,
        AppStoreConnectApiKey, AppStoreConnectApiKeyId, AppStoreConnectApiKeyResponse,
        IosCertificate, IosCertificateId, IosCertificateResponse, IosProfile, IosProfileId,
        IosProfileResponse, IosSigningStatus, RepositoryId, SigningStatusResponse,
        UploadApiKeyRequest, UploadCertificateRequest, UploadKeystoreRequest, UploadProfileRequest,
    },
    oauth::encrypt_with_aad,
    signing::{
        android::validate_keystore,
        ios::{parse_p12_certificate, parse_provisioning_profile, validate_api_key},
    },
};
use serde_json::json;

use crate::state::AppState;

// ============================================================================
// Signing Status
// ============================================================================

/// Get signing status for a repository.
///
/// GET /api/repositories/:repo_id/signing
pub async fn get_signing_status(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Verify repository exists
    match RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        Ok(Some(_)) => {}
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Repository not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get repository: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    // Get signing info
    let certificates = match IosCertificateRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(certs) => certs,
        Err(e) => {
            tracing::error!("Failed to list certificates: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let profiles = match IosProfileRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(profiles) => profiles,
        Err(e) => {
            tracing::error!("Failed to list profiles: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let keystores = match AndroidKeystoreRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(keystores) => keystores,
        Err(e) => {
            tracing::error!("Failed to list keystores: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let api_keys = match AppStoreConnectApiKeyRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(keys) => keys,
        Err(e) => {
            tracing::error!("Failed to list API keys: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let response = SigningStatusResponse {
        signing_enabled: certificates.iter().any(|c| c.is_active)
            || profiles.iter().any(|p| p.is_active)
            || keystores.iter().any(|k| k.is_active)
            || api_keys.iter().any(|k| k.is_active),
        ios: IosSigningStatus {
            certificates_count: certificates.len(),
            profiles_count: profiles.len(),
            api_keys_count: api_keys.len(),
            has_active_certificate: certificates.iter().any(|c| c.is_active),
            has_active_profile: profiles.iter().any(|p| p.is_active),
            has_api_key: api_keys.iter().any(|k| k.is_active),
        },
        android: AndroidSigningStatus {
            keystores_count: keystores.len(),
            has_active_keystore: keystores.iter().any(|k| k.is_active),
        },
    };

    (StatusCode::OK, Json(json!(response)))
}

// ============================================================================
// iOS Certificates
// ============================================================================

/// List iOS certificates for a repository.
///
/// GET /api/repositories/:repo_id/signing/ios/certificates
pub async fn list_certificates(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    match IosCertificateRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(certs) => {
            let responses: Vec<IosCertificateResponse> =
                certs.into_iter().map(IosCertificateResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list certificates: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Upload an iOS certificate (p12).
///
/// POST /api/repositories/:repo_id/signing/ios/certificates
pub async fn upload_certificate(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
    Json(req): Json<UploadCertificateRequest>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Verify repository exists
    if let Ok(None) = RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Repository not found"})),
        );
    }

    // Check encryption key
    let Some(encryption_key) = &state.encryption_key else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "Encryption not configured"})),
        );
    };

    // Decode base64 certificate data
    let cert_data = match BASE64.decode(&req.certificate_data_base64) {
        Ok(data) => data,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid base64 certificate data"})),
            );
        }
    };

    // Parse and validate certificate
    let metadata = match parse_p12_certificate(&cert_data, &req.password).await {
        Ok(meta) => meta,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("Invalid certificate: {}", e)})),
            );
        }
    };

    // Create certificate record
    let cert_id = IosCertificateId::new();
    let id_str = cert_id.to_string();

    // Encrypt certificate data and password
    let (cert_encrypted, cert_nonce) =
        match encrypt_with_aad(encryption_key, &cert_data, "ios_certificate", &id_str) {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("Failed to encrypt certificate: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Encryption error"})),
                );
            }
        };

    let (password_encrypted, password_nonce) = match encrypt_with_aad(
        encryption_key,
        req.password.as_bytes(),
        "ios_certificate",
        &id_str,
    ) {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("Failed to encrypt password: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Encryption error"})),
            );
        }
    };

    let cert = IosCertificate {
        id: cert_id,
        repository_id: repo_id,
        name: req.name,
        certificate_type: req.certificate_type,
        certificate_data_encrypted: cert_encrypted,
        certificate_data_nonce: cert_nonce,
        password_encrypted,
        password_nonce,
        common_name: metadata.common_name,
        team_id: metadata.team_id,
        serial_number: metadata.serial_number,
        expires_at: metadata.expires_at,
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Save to database
    if let Err(e) = IosCertificateRepo::create(&state.db, &cert).await {
        tracing::error!("Failed to create certificate: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to save certificate"})),
        );
    }

    let response = IosCertificateResponse::from(cert);
    (StatusCode::CREATED, Json(json!(response)))
}

/// Delete an iOS certificate.
///
/// DELETE /api/repositories/:repo_id/signing/ios/certificates/:cert_id
pub async fn delete_certificate(
    State(state): State<AppState>,
    Path((repo_id, cert_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    let cert_id = match IosCertificateId::from_string(&cert_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid certificate ID"})),
            );
        }
    };

    // Verify certificate belongs to repository
    match IosCertificateRepo::get_by_id(&state.db, &cert_id).await {
        Ok(Some(cert)) if cert.repository_id == repo_id => {}
        Ok(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Certificate not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get certificate: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    if let Err(e) = IosCertificateRepo::delete(&state.db, &cert_id).await {
        tracing::error!("Failed to delete certificate: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to delete certificate"})),
        );
    }

    (StatusCode::NO_CONTENT, Json(json!({})))
}

// ============================================================================
// iOS Provisioning Profiles
// ============================================================================

/// List iOS provisioning profiles for a repository.
///
/// GET /api/repositories/:repo_id/signing/ios/profiles
pub async fn list_profiles(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    match IosProfileRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(profiles) => {
            let responses: Vec<IosProfileResponse> =
                profiles.into_iter().map(IosProfileResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list profiles: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Upload an iOS provisioning profile.
///
/// POST /api/repositories/:repo_id/signing/ios/profiles
pub async fn upload_profile(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
    Json(req): Json<UploadProfileRequest>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Verify repository exists
    if let Ok(None) = RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Repository not found"})),
        );
    }

    // Check encryption key
    let Some(encryption_key) = &state.encryption_key else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "Encryption not configured"})),
        );
    };

    // Decode base64 profile data
    let profile_data = match BASE64.decode(&req.profile_data_base64) {
        Ok(data) => data,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid base64 profile data"})),
            );
        }
    };

    // Parse and validate profile
    let metadata = match parse_provisioning_profile(&profile_data).await {
        Ok(meta) => meta,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("Invalid provisioning profile: {}", e)})),
            );
        }
    };

    // Create profile record
    let profile_id = IosProfileId::new();
    let id_str = profile_id.to_string();

    // Encrypt profile data
    let (profile_encrypted, profile_nonce) =
        match encrypt_with_aad(encryption_key, &profile_data, "ios_profile", &id_str) {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("Failed to encrypt profile: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Encryption error"})),
                );
            }
        };

    // Use provided name or fall back to app_id_name or profile name
    let name = req.name.or(metadata.app_id_name.clone()).unwrap_or(metadata.name.clone());

    let profile = IosProfile {
        id: profile_id,
        repository_id: repo_id,
        name,
        profile_type: metadata.profile_type,
        profile_data_encrypted: profile_encrypted,
        profile_data_nonce: profile_nonce,
        bundle_identifier: metadata.bundle_identifier,
        team_id: metadata.team_id,
        uuid: metadata.uuid,
        app_id_name: metadata.app_id_name,
        expires_at: metadata.expires_at,
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Save to database
    if let Err(e) = IosProfileRepo::create(&state.db, &profile).await {
        tracing::error!("Failed to create profile: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to save profile"})),
        );
    }

    let response = IosProfileResponse::from(profile);
    (StatusCode::CREATED, Json(json!(response)))
}

/// Delete an iOS provisioning profile.
///
/// DELETE /api/repositories/:repo_id/signing/ios/profiles/:profile_id
pub async fn delete_profile(
    State(state): State<AppState>,
    Path((repo_id, profile_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    let profile_id = match IosProfileId::from_string(&profile_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid profile ID"})),
            );
        }
    };

    // Verify profile belongs to repository
    match IosProfileRepo::get_by_id(&state.db, &profile_id).await {
        Ok(Some(profile)) if profile.repository_id == repo_id => {}
        Ok(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Profile not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get profile: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    if let Err(e) = IosProfileRepo::delete(&state.db, &profile_id).await {
        tracing::error!("Failed to delete profile: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to delete profile"})),
        );
    }

    (StatusCode::NO_CONTENT, Json(json!({})))
}

// ============================================================================
// Android Keystores
// ============================================================================

/// List Android keystores for a repository.
///
/// GET /api/repositories/:repo_id/signing/android/keystores
pub async fn list_keystores(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    match AndroidKeystoreRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(keystores) => {
            let responses: Vec<AndroidKeystoreResponse> = keystores
                .into_iter()
                .map(AndroidKeystoreResponse::from)
                .collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list keystores: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Upload an Android keystore.
///
/// POST /api/repositories/:repo_id/signing/android/keystores
pub async fn upload_keystore(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
    Json(req): Json<UploadKeystoreRequest>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Verify repository exists
    if let Ok(None) = RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Repository not found"})),
        );
    }

    // Check encryption key
    let Some(encryption_key) = &state.encryption_key else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "Encryption not configured"})),
        );
    };

    // Decode base64 keystore data
    let keystore_data = match BASE64.decode(&req.keystore_data_base64) {
        Ok(data) => data,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid base64 keystore data"})),
            );
        }
    };

    // Validate keystore
    let keystore_info = match validate_keystore(
        &keystore_data,
        &req.keystore_password,
        &req.key_alias,
        &req.key_password,
    )
    .await
    {
        Ok(info) => info,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("Invalid keystore: {}", e)})),
            );
        }
    };

    // Create keystore record
    let keystore_id = AndroidKeystoreId::new();
    let id_str = keystore_id.to_string();

    // Encrypt keystore data and passwords
    let (ks_encrypted, ks_nonce) =
        match encrypt_with_aad(encryption_key, &keystore_data, "android_keystore", &id_str) {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("Failed to encrypt keystore: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Encryption error"})),
                );
            }
        };

    let (ks_pass_encrypted, ks_pass_nonce) = match encrypt_with_aad(
        encryption_key,
        req.keystore_password.as_bytes(),
        "android_keystore",
        &id_str,
    ) {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("Failed to encrypt keystore password: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Encryption error"})),
            );
        }
    };

    let (key_pass_encrypted, key_pass_nonce) = match encrypt_with_aad(
        encryption_key,
        req.key_password.as_bytes(),
        "android_keystore",
        &id_str,
    ) {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("Failed to encrypt key password: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Encryption error"})),
            );
        }
    };

    let keystore = AndroidKeystore {
        id: keystore_id,
        repository_id: repo_id,
        name: req.name,
        keystore_data_encrypted: ks_encrypted,
        keystore_data_nonce: ks_nonce,
        keystore_password_encrypted: ks_pass_encrypted,
        keystore_password_nonce: ks_pass_nonce,
        key_alias: req.key_alias,
        key_password_encrypted: key_pass_encrypted,
        key_password_nonce: key_pass_nonce,
        keystore_type: req.keystore_type.unwrap_or(keystore_info.keystore_type),
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Save to database
    if let Err(e) = AndroidKeystoreRepo::create(&state.db, &keystore).await {
        tracing::error!("Failed to create keystore: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to save keystore"})),
        );
    }

    let response = AndroidKeystoreResponse::from(keystore);
    (StatusCode::CREATED, Json(json!(response)))
}

/// Delete an Android keystore.
///
/// DELETE /api/repositories/:repo_id/signing/android/keystores/:keystore_id
pub async fn delete_keystore(
    State(state): State<AppState>,
    Path((repo_id, keystore_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    let keystore_id = match AndroidKeystoreId::from_string(&keystore_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid keystore ID"})),
            );
        }
    };

    // Verify keystore belongs to repository
    match AndroidKeystoreRepo::get_by_id(&state.db, &keystore_id).await {
        Ok(Some(ks)) if ks.repository_id == repo_id => {}
        Ok(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Keystore not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get keystore: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    if let Err(e) = AndroidKeystoreRepo::delete(&state.db, &keystore_id).await {
        tracing::error!("Failed to delete keystore: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to delete keystore"})),
        );
    }

    (StatusCode::NO_CONTENT, Json(json!({})))
}

// ============================================================================
// App Store Connect API Keys
// ============================================================================

/// List App Store Connect API keys for a repository.
///
/// GET /api/repositories/:repo_id/signing/ios/api-keys
pub async fn list_api_keys(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    match AppStoreConnectApiKeyRepo::list_all_for_repo(&state.db, &repo_id).await {
        Ok(keys) => {
            let responses: Vec<AppStoreConnectApiKeyResponse> =
                keys.into_iter().map(AppStoreConnectApiKeyResponse::from).collect();
            (StatusCode::OK, Json(json!(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to list API keys: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
}

/// Upload an App Store Connect API key.
///
/// POST /api/repositories/:repo_id/signing/ios/api-keys
pub async fn upload_api_key(
    State(state): State<AppState>,
    Path(repo_id): Path<String>,
    Json(req): Json<UploadApiKeyRequest>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    // Verify repository exists
    if let Ok(None) = RepositoryRepo::get_by_id(&state.db, &repo_id).await {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Repository not found"})),
        );
    }

    // Check encryption key
    let Some(encryption_key) = &state.encryption_key else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "Encryption not configured"})),
        );
    };

    // Decode base64 private key
    let private_key_bytes = match BASE64.decode(&req.private_key_base64) {
        Ok(data) => data,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid base64 private key data"})),
            );
        }
    };

    // Convert to string for validation
    let private_key_pem = match String::from_utf8(private_key_bytes.clone()) {
        Ok(s) => s,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Private key must be valid UTF-8 text"})),
            );
        }
    };

    // Validate the API key
    if let Err(e) = validate_api_key(&req.key_id, &req.issuer_id, &private_key_pem) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Invalid API key: {}", e)})),
        );
    }

    // Create API key record
    let api_key_id = AppStoreConnectApiKeyId::new();
    let id_str = api_key_id.to_string();

    // Encrypt private key
    let (key_encrypted, key_nonce) =
        match encrypt_with_aad(encryption_key, private_key_bytes.as_slice(), "asc_api_key", &id_str)
        {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("Failed to encrypt private key: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Encryption error"})),
                );
            }
        };

    let api_key = AppStoreConnectApiKey {
        id: api_key_id,
        repository_id: repo_id,
        name: req.name,
        key_id: req.key_id,
        issuer_id: req.issuer_id,
        private_key_encrypted: key_encrypted,
        private_key_nonce: key_nonce,
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Save to database
    if let Err(e) = AppStoreConnectApiKeyRepo::create(&state.db, &api_key).await {
        tracing::error!("Failed to create API key: {}", e);
        // Check for unique constraint violation
        let error_str = e.to_string();
        if error_str.contains("UNIQUE constraint failed") {
            return (
                StatusCode::CONFLICT,
                Json(json!({"error": "An API key with this Key ID already exists for this repository"})),
            );
        }
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to save API key"})),
        );
    }

    let response = AppStoreConnectApiKeyResponse::from(api_key);
    (StatusCode::CREATED, Json(json!(response)))
}

/// Delete an App Store Connect API key.
///
/// DELETE /api/repositories/:repo_id/signing/ios/api-keys/:key_id
pub async fn delete_api_key(
    State(state): State<AppState>,
    Path((repo_id, key_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let repo_id = match RepositoryId::from_string(&repo_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid repository ID"})),
            );
        }
    };

    let api_key_id = match AppStoreConnectApiKeyId::from_string(&key_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid API key ID"})),
            );
        }
    };

    // Verify API key belongs to repository
    match AppStoreConnectApiKeyRepo::get_by_id(&state.db, &api_key_id).await {
        Ok(Some(key)) if key.repository_id == repo_id => {}
        Ok(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "API key not found"})),
            );
        }
        Err(e) => {
            tracing::error!("Failed to get API key: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    }

    if let Err(e) = AppStoreConnectApiKeyRepo::delete(&state.db, &api_key_id).await {
        tracing::error!("Failed to delete API key: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to delete API key"})),
        );
    }

    (StatusCode::NO_CONTENT, Json(json!({})))
}
