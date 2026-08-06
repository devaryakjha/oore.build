use std::collections::BTreeSet;
use std::sync::Arc;

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use oore_component_protocol::ComponentIdentity;
use oore_contract::{
    APPLE_COMPONENT_CAPABILITY, APPLE_COMPONENT_ID, APPLE_COMPONENT_SECRET_KIND,
    APPLE_COMPONENT_VERSION, ActivateComponentOperationRequest, ActivateComponentOperationResponse,
    AppleAccountOperationResponse, AppleAccountOperationStatus, AppleAccountResponse,
    AppleAppSummary, ClaimComponentOperationRequest, ClaimComponentOperationResponse,
    ClaimedAppleComponentOperation, CompleteComponentOperationRequest, ConnectAppleAccountRequest,
    RUNNER_PROTOCOL_VERSION, SelectAppleAppRequest, apple_component_release_for_target_arch,
};
use serde::Deserialize;
use sha2::{Digest as _, Sha256};
use sqlx::Row as _;
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::AppState;
use crate::credential_broker::{
    self, CredentialAuthorityBinding, CredentialGrantBinding, CredentialGrantError,
};
use crate::extractors::AuthUser;
use crate::runners::RunnerAuth;
use crate::store::write_audit_log;
use crate::util::{api_err, now_unix};

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<oore_contract::ApiError>)>;

const MAX_KEY_ID_BYTES: usize = 128;
const MAX_ISSUER_ID_BYTES: usize = 128;
const MAX_PRIVATE_KEY_BYTES: usize = 64 * 1024;
const MAX_APPS: usize = 10_000;
const MAX_APP_FIELD_BYTES: usize = 512;
const OPERATION_LEASE_SECONDS: i64 = 10 * 60;
const CREDENTIAL_LEASE_SECONDS: i64 = 8 * 60;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AppleAppsResult {
    apps: Vec<AppleAppSummary>,
    rate_limit: Option<serde_json::Value>,
}

pub async fn connect_account(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(request): Json<ConnectAppleAccountRequest>,
) -> ApiResult<AppleAccountOperationResponse> {
    auth.require_owner()?;
    let key_id = bounded_trimmed(&request.key_id, MAX_KEY_ID_BYTES, "key_id")?;
    let issuer_id = bounded_trimmed(&request.issuer_id, MAX_ISSUER_ID_BYTES, "issuer_id")?;
    let private_key = Zeroizing::new(request.private_key_pem);
    validate_private_key(private_key.as_str())?;
    let now = now_unix();
    let active = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM apple_account_operations WHERE status IN ('queued', 'claimed', 'running')",
    )
    .fetch_one(&state.db)
    .await
    .map_err(store_error)?;
    if active > 0 {
        return Err(api_err(
            StatusCode::CONFLICT,
            "apple_connection_in_progress",
            "An Apple connection check is already running",
        ));
    }
    let encrypted =
        crate::crypto::encrypt(private_key.as_str(), &state.encryption_key).map_err(|_| {
            internal_error(
                "apple_key_encrypt_failed",
                "The Apple key could not be protected",
            )
        })?;
    let operation_id = format!("apple-connect-{}", Uuid::new_v4());
    sqlx::query(
        "INSERT INTO apple_account_operations (
            id, requested_by, key_id, issuer_id, private_key_encrypted,
            status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, 'queued', ?6, ?6)",
    )
    .bind(&operation_id)
    .bind(&auth.0.user_id)
    .bind(&key_id)
    .bind(&issuer_id)
    .bind(encrypted)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(store_error)?;
    let details = serde_json::json!({
        "key_id": key_id,
    })
    .to_string();
    let _ = write_audit_log(
        &state.db,
        Some(&auth.0.user_id),
        "apple_account_connection_started",
        "apple_account_operation",
        Some(&operation_id),
        Some(&details),
    )
    .await;
    Ok(Json(AppleAccountOperationResponse {
        operation_id,
        status: AppleAccountOperationStatus::Queued,
        apps: Vec::new(),
        error_code: None,
        error_message: None,
    }))
}

pub async fn get_operation(
    State(state): State<Arc<AppState>>,
    Path(operation_id): Path<String>,
    auth: AuthUser,
) -> ApiResult<AppleAccountOperationResponse> {
    auth.require_owner()?;
    let row = sqlx::query(
        "SELECT status, result_json, error_code, error_message
         FROM apple_account_operations
         WHERE id = ?1 AND requested_by = ?2",
    )
    .bind(&operation_id)
    .bind(&auth.0.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(store_error)?
    .ok_or_else(|| {
        api_err(
            StatusCode::NOT_FOUND,
            "not_found",
            "Apple operation not found",
        )
    })?;
    Ok(Json(operation_response(&operation_id, &row)?))
}

pub async fn get_account(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> ApiResult<AppleAccountResponse> {
    auth.require_owner()?;
    let row =
        sqlx::query("SELECT key_id, apps_json, selected_app_id FROM apple_account WHERE id = 1")
            .fetch_optional(&state.db)
            .await
            .map_err(store_error)?;
    let Some(row) = row else {
        return Ok(Json(AppleAccountResponse {
            connected: false,
            key_id: None,
            apps: Vec::new(),
            selected_app_id: None,
        }));
    };
    let apps = parse_apps(&row.get::<String, _>("apps_json"))?;
    Ok(Json(AppleAccountResponse {
        connected: true,
        key_id: Some(row.get("key_id")),
        apps,
        selected_app_id: row.get("selected_app_id"),
    }))
}

pub async fn select_app(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(request): Json<SelectAppleAppRequest>,
) -> ApiResult<AppleAccountResponse> {
    auth.require_owner()?;
    let app_id = bounded_trimmed(&request.app_id, MAX_APP_FIELD_BYTES, "app_id")?;
    let row = sqlx::query("SELECT apps_json FROM apple_account WHERE id = 1")
        .fetch_optional(&state.db)
        .await
        .map_err(store_error)?
        .ok_or_else(|| {
            api_err(
                StatusCode::NOT_FOUND,
                "apple_account_missing",
                "No Apple account is connected",
            )
        })?;
    let apps = parse_apps(&row.get::<String, _>("apps_json"))?;
    if !apps.iter().any(|app| app.id == app_id) {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "apple_app_unknown",
            "Choose an app returned by the connected Apple account",
        ));
    }
    sqlx::query("UPDATE apple_account SET selected_app_id = ?1, updated_at = ?2 WHERE id = 1")
        .bind(&app_id)
        .bind(now_unix())
        .execute(&state.db)
        .await
        .map_err(store_error)?;
    let details = serde_json::json!({
        "app_id": app_id,
    })
    .to_string();
    let _ = write_audit_log(
        &state.db,
        Some(&auth.0.user_id),
        "apple_app_selected",
        "apple_account",
        Some("1"),
        Some(&details),
    )
    .await;
    get_account(State(state), auth).await
}

pub async fn remove_account(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> ApiResult<AppleAccountResponse> {
    auth.require_owner()?;
    let mut transaction = state.db.begin().await.map_err(store_error)?;
    sqlx::query("DELETE FROM apple_account WHERE id = 1")
        .execute(&mut *transaction)
        .await
        .map_err(store_error)?;
    sqlx::query(
        "UPDATE apple_account_operations
         SET private_key_encrypted = '', status = 'failed',
             error_code = 'account_removed', error_message = 'The Apple account was removed',
             updated_at = ?1
         WHERE status IN ('queued', 'claimed', 'running')",
    )
    .bind(now_unix())
    .execute(&mut *transaction)
    .await
    .map_err(store_error)?;
    transaction.commit().await.map_err(store_error)?;
    let _ = write_audit_log(
        &state.db,
        Some(&auth.0.user_id),
        "apple_account_removed",
        "apple_account",
        Some("1"),
        None,
    )
    .await;
    Ok(Json(AppleAccountResponse {
        connected: false,
        key_id: None,
        apps: Vec::new(),
        selected_app_id: None,
    }))
}

pub async fn claim_operation(
    State(state): State<Arc<AppState>>,
    Path(runner_id): Path<String>,
    auth: RunnerAuth,
    Json(request): Json<ClaimComponentOperationRequest>,
) -> ApiResult<ClaimComponentOperationResponse> {
    require_runner(&auth, &runner_id)?;
    if request.protocol_version != RUNNER_PROTOCOL_VERSION {
        return Err(api_err(
            StatusCode::CONFLICT,
            "runner_protocol_mismatch",
            "The runner protocol is not supported",
        ));
    }
    if request.target_os != "macos"
        || apple_component_release_for_target_arch(&request.target_arch).is_none()
    {
        return Ok(Json(ClaimComponentOperationResponse { operation: None }));
    }
    let now = now_unix();
    let mut transaction = state.db.begin().await.map_err(store_error)?;
    sqlx::query(
        "UPDATE apple_account_operations
         SET status = 'queued', runner_id = NULL, job_lock_digest = NULL,
             lease_id = NULL, receipt_id = NULL, lease_expires_at = NULL,
             updated_at = ?1
         WHERE status IN ('claimed', 'running') AND lease_expires_at <= ?1",
    )
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(store_error)?;
    let row = sqlx::query(
        "SELECT id, key_id, issuer_id, fencing_token
         FROM apple_account_operations
         WHERE status = 'queued'
         ORDER BY created_at, id LIMIT 1",
    )
    .fetch_optional(&mut *transaction)
    .await
    .map_err(store_error)?;
    let Some(row) = row else {
        transaction.commit().await.map_err(store_error)?;
        return Ok(Json(ClaimComponentOperationResponse { operation: None }));
    };
    let operation_id: String = row.get("id");
    let fencing_token = row.get::<i64, _>("fencing_token").saturating_add(1);
    let lease_id = format!("apple-lease-{}", Uuid::new_v4());
    let receipt_id = format!("apple-receipt-{}", Uuid::new_v4());
    let lease_expires_at = now.saturating_add(OPERATION_LEASE_SECONDS);
    let job_lock_digest = digest_fields(&[
        operation_id.as_bytes(),
        runner_id.as_bytes(),
        lease_id.as_bytes(),
        &fencing_token.to_be_bytes(),
    ]);
    let updated = sqlx::query(
        "UPDATE apple_account_operations
         SET status = 'claimed', runner_id = ?1, job_lock_digest = ?2,
             lease_id = ?3, receipt_id = ?4, fencing_token = ?5,
             lease_expires_at = ?6, updated_at = ?7
         WHERE id = ?8 AND status = 'queued'",
    )
    .bind(&runner_id)
    .bind(&job_lock_digest)
    .bind(&lease_id)
    .bind(&receipt_id)
    .bind(fencing_token)
    .bind(lease_expires_at)
    .bind(now)
    .bind(&operation_id)
    .execute(&mut *transaction)
    .await
    .map_err(store_error)?;
    if updated.rows_affected() != 1 {
        transaction.rollback().await.map_err(store_error)?;
        return Ok(Json(ClaimComponentOperationResponse { operation: None }));
    }
    transaction.commit().await.map_err(store_error)?;
    Ok(Json(ClaimComponentOperationResponse {
        operation: Some(ClaimedAppleComponentOperation {
            operation_id,
            key_id: row.get("key_id"),
            issuer_id: row.get("issuer_id"),
            job_lock_digest,
            lease_id,
            receipt_id,
            fencing_token,
            lease_expires_at,
        }),
    }))
}

pub async fn activate_operation(
    State(state): State<Arc<AppState>>,
    Path((runner_id, operation_id)): Path<(String, String)>,
    auth: RunnerAuth,
    Json(request): Json<ActivateComponentOperationRequest>,
) -> ApiResult<ActivateComponentOperationResponse> {
    require_runner(&auth, &runner_id)?;
    let component = validate_component_identity(&request.component)?;
    let now = now_unix();
    let row = sqlx::query(
        "SELECT private_key_encrypted, job_lock_digest, fencing_token, lease_expires_at
         FROM apple_account_operations
         WHERE id = ?1 AND runner_id = ?2 AND status = 'claimed' AND lease_expires_at > ?3",
    )
    .bind(&operation_id)
    .bind(&runner_id)
    .bind(now)
    .fetch_optional(&state.db)
    .await
    .map_err(store_error)?
    .ok_or_else(|| {
        api_err(
            StatusCode::NOT_FOUND,
            "component_operation_unavailable",
            "The Apple operation is unavailable",
        )
    })?;
    let job_lock_digest: String = row.get("job_lock_digest");
    let fencing_token: i64 = row.get("fencing_token");
    let operation_expires_at: i64 = row.get("lease_expires_at");
    let credential_expires_at =
        operation_expires_at.min(now.saturating_add(CREDENTIAL_LEASE_SECONDS));
    let authority = CredentialAuthorityBinding {
        operation_id: operation_id.clone(),
        runner_id: runner_id.clone(),
        component_identity_digest: component.identity_digest.clone(),
        capability_id: APPLE_COMPONENT_CAPABILITY.into(),
        job_lock_digest,
        fencing_token,
    };
    credential_broker::activate_authority(&state.db, &authority, now, operation_expires_at)
        .await
        .map_err(map_grant_error)?;
    let private_key = Zeroizing::new(
        crate::crypto::decrypt(
            &row.get::<String, _>("private_key_encrypted"),
            &state.encryption_key,
        )
        .map_err(|_| internal_error("apple_key_unavailable", "The Apple key is unavailable"))?,
    );
    let grant = credential_broker::issue(
        &state.db,
        &state.encryption_key,
        &CredentialGrantBinding {
            authority,
            secret_kind: APPLE_COMPONENT_SECRET_KIND.into(),
        },
        private_key.as_bytes(),
        now,
        credential_expires_at,
    )
    .await
    .map_err(map_grant_error)?;
    let updated = sqlx::query(
        "UPDATE apple_account_operations
         SET status = 'running', component_identity_digest = ?1,
             component_target_arch = ?2, updated_at = ?3
         WHERE id = ?4 AND runner_id = ?5 AND status = 'claimed'",
    )
    .bind(&component.identity_digest)
    .bind(&component.target_arch)
    .bind(now)
    .bind(&operation_id)
    .bind(&runner_id)
    .execute(&state.db)
    .await
    .map_err(store_error)?;
    if updated.rows_affected() != 1 {
        return Err(api_err(
            StatusCode::CONFLICT,
            "component_operation_changed",
            "The Apple operation changed",
        ));
    }
    Ok(Json(ActivateComponentOperationResponse {
        credential_grant: grant.handle.as_str().to_owned(),
        credential_expires_at: grant.expires_at,
    }))
}

pub async fn complete_operation(
    State(state): State<Arc<AppState>>,
    Path((runner_id, operation_id)): Path<(String, String)>,
    auth: RunnerAuth,
    Json(request): Json<CompleteComponentOperationRequest>,
) -> ApiResult<AppleAccountOperationResponse> {
    require_runner(&auth, &runner_id)?;
    let now = now_unix();
    let row = sqlx::query(
        "SELECT requested_by, key_id, issuer_id, private_key_encrypted,
                job_lock_digest, lease_id, receipt_id, fencing_token,
                component_identity_digest
         FROM apple_account_operations
         WHERE id = ?1 AND runner_id = ?2 AND status = 'running'
           AND lease_expires_at > ?3",
    )
    .bind(&operation_id)
    .bind(&runner_id)
    .bind(now)
    .fetch_optional(&state.db)
    .await
    .map_err(store_error)?
    .ok_or_else(|| {
        api_err(
            StatusCode::NOT_FOUND,
            "component_operation_unavailable",
            "The Apple operation is unavailable",
        )
    })?;
    let CompleteComponentOperationRequest {
        component_identity_digest,
        job_lock_digest,
        lease_id,
        receipt_id,
        fencing_token,
        result,
        error_code,
        error_message,
    } = request;
    if component_identity_digest != row.get::<String, _>("component_identity_digest")
        || job_lock_digest != row.get::<String, _>("job_lock_digest")
        || lease_id != row.get::<String, _>("lease_id")
        || receipt_id != row.get::<String, _>("receipt_id")
        || fencing_token != row.get::<i64, _>("fencing_token")
    {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "component_completion_binding_invalid",
            "The Apple component completion binding is invalid",
        ));
    }
    let success = result.is_some() && error_code.is_none();
    let apps = if success {
        let result: AppleAppsResult =
            serde_json::from_value(result.unwrap_or_default()).map_err(|_| {
                api_err(
                    StatusCode::BAD_REQUEST,
                    "component_result_invalid",
                    "The Apple component result is invalid",
                )
            })?;
        let _ = result.rate_limit;
        validate_apps(result.apps)?
    } else {
        Vec::new()
    };
    let mut transaction = state.db.begin().await.map_err(store_error)?;
    if success {
        let apps_json = serde_json::to_string(&apps).map_err(|_| {
            internal_error(
                "apple_apps_encode_failed",
                "The Apple apps could not be saved",
            )
        })?;
        let completed = sqlx::query(
            "UPDATE apple_account_operations
             SET status = 'succeeded', private_key_encrypted = '', result_json = ?1,
                 error_code = NULL, error_message = NULL, updated_at = ?2
             WHERE id = ?3 AND runner_id = ?4 AND status = 'running'",
        )
        .bind(&apps_json)
        .bind(now)
        .bind(&operation_id)
        .bind(&runner_id)
        .execute(&mut *transaction)
        .await
        .map_err(store_error)?;
        if completed.rows_affected() != 1 {
            transaction.rollback().await.map_err(store_error)?;
            return Err(api_err(
                StatusCode::CONFLICT,
                "component_operation_changed",
                "The Apple operation changed",
            ));
        }
        sqlx::query(
            "INSERT INTO apple_account (
                id, key_id, issuer_id, private_key_encrypted, apps_json,
                selected_app_id, connected_by, created_at, updated_at
             ) VALUES (1, ?1, ?2, ?3, ?4, NULL, ?5, ?6, ?6)
             ON CONFLICT(id) DO UPDATE SET
                key_id = excluded.key_id,
                issuer_id = excluded.issuer_id,
                private_key_encrypted = excluded.private_key_encrypted,
                apps_json = excluded.apps_json,
                selected_app_id = NULL,
                connected_by = excluded.connected_by,
                updated_at = excluded.updated_at",
        )
        .bind(row.get::<String, _>("key_id"))
        .bind(row.get::<String, _>("issuer_id"))
        .bind(row.get::<String, _>("private_key_encrypted"))
        .bind(&apps_json)
        .bind(row.get::<String, _>("requested_by"))
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(store_error)?;
    } else {
        let error_code = safe_error(error_code.as_deref(), "apple_check_failed");
        let error_message = safe_error(error_message.as_deref(), "Apple could not verify this key");
        let completed = sqlx::query(
            "UPDATE apple_account_operations
             SET status = 'failed', private_key_encrypted = '', result_json = NULL,
                 error_code = ?1, error_message = ?2, updated_at = ?3
             WHERE id = ?4 AND runner_id = ?5 AND status = 'running'",
        )
        .bind(&error_code)
        .bind(&error_message)
        .bind(now)
        .bind(&operation_id)
        .bind(&runner_id)
        .execute(&mut *transaction)
        .await
        .map_err(store_error)?;
        if completed.rows_affected() != 1 {
            transaction.rollback().await.map_err(store_error)?;
            return Err(api_err(
                StatusCode::CONFLICT,
                "component_operation_changed",
                "The Apple operation changed",
            ));
        }
    }
    transaction.commit().await.map_err(store_error)?;
    let authority = CredentialAuthorityBinding {
        operation_id: operation_id.clone(),
        runner_id,
        component_identity_digest,
        capability_id: APPLE_COMPONENT_CAPABILITY.into(),
        job_lock_digest,
        fencing_token,
    };
    let _ = credential_broker::revoke_authority(&state.db, &authority, now).await;
    Ok(Json(AppleAccountOperationResponse {
        operation_id,
        status: if success {
            AppleAccountOperationStatus::Succeeded
        } else {
            AppleAccountOperationStatus::Failed
        },
        apps,
        error_code: if success {
            None
        } else {
            Some(safe_error(error_code.as_deref(), "apple_check_failed"))
        },
        error_message: if success {
            None
        } else {
            Some(safe_error(
                error_message.as_deref(),
                "Apple could not verify this key",
            ))
        },
    }))
}

fn validate_component_identity(
    claim: &oore_contract::ComponentIdentityClaim,
) -> Result<ComponentIdentity, (StatusCode, Json<oore_contract::ApiError>)> {
    let expected = expected_identity(&claim.target_arch)?;
    if claim.component_id != expected.component_id
        || claim.component_version != expected.component_version
        || claim.target_os != expected.target_os
        || claim.target_arch != expected.target_arch
        || claim.protocol_major != expected.protocol_major
        || claim.bundle_digest != expected.bundle_digest
        || claim.bundle_length != expected.bundle_length
        || claim.catalog_revision != expected.catalog_revision
        || claim.release_counter != expected.release_counter
        || claim.identity_digest != expected.identity_digest
    {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "component_identity_invalid",
            "The Apple component identity is invalid",
        ));
    }
    Ok(expected)
}

fn expected_identity(
    target_arch: &str,
) -> Result<ComponentIdentity, (StatusCode, Json<oore_contract::ApiError>)> {
    let release = apple_component_release_for_target_arch(target_arch).ok_or_else(|| {
        api_err(
            StatusCode::BAD_REQUEST,
            "component_target_invalid",
            "The Apple component target is invalid",
        )
    })?;
    ComponentIdentity::new(
        APPLE_COMPONENT_ID,
        APPLE_COMPONENT_VERSION,
        "macos",
        release.target_arch,
        format!("sha256:{}", release.bundle_sha256),
        release.bundle_length,
        1,
        1,
    )
    .map_err(|_| {
        internal_error(
            "component_identity_invalid",
            "The Apple component identity is invalid",
        )
    })
}

fn operation_response(
    operation_id: &str,
    row: &sqlx::sqlite::SqliteRow,
) -> Result<AppleAccountOperationResponse, (StatusCode, Json<oore_contract::ApiError>)> {
    let status = match row.get::<String, _>("status").as_str() {
        "queued" => AppleAccountOperationStatus::Queued,
        "claimed" => AppleAccountOperationStatus::Claimed,
        "running" => AppleAccountOperationStatus::Running,
        "succeeded" => AppleAccountOperationStatus::Succeeded,
        "failed" => AppleAccountOperationStatus::Failed,
        _ => {
            return Err(internal_error(
                "apple_operation_invalid",
                "The Apple operation has an invalid state",
            ));
        }
    };
    let result_json: Option<String> = row.get("result_json");
    Ok(AppleAccountOperationResponse {
        operation_id: operation_id.into(),
        status,
        apps: result_json
            .as_deref()
            .map(parse_apps)
            .transpose()?
            .unwrap_or_default(),
        error_code: row.get("error_code"),
        error_message: row.get("error_message"),
    })
}

fn parse_apps(
    value: &str,
) -> Result<Vec<AppleAppSummary>, (StatusCode, Json<oore_contract::ApiError>)> {
    let apps = serde_json::from_str(value)
        .map_err(|_| internal_error("apple_apps_invalid", "The stored Apple apps are invalid"))?;
    validate_apps(apps)
}

fn validate_apps(
    apps: Vec<AppleAppSummary>,
) -> Result<Vec<AppleAppSummary>, (StatusCode, Json<oore_contract::ApiError>)> {
    if apps.len() > MAX_APPS {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "apple_apps_invalid",
            "The Apple app list is too large",
        ));
    }
    let mut ids = BTreeSet::new();
    for app in &apps {
        if !ids.insert(app.id.as_str())
            || [&app.id, &app.name, &app.bundle_id, &app.sku]
                .into_iter()
                .any(|value| value.is_empty() || value.len() > MAX_APP_FIELD_BYTES)
            || app
                .primary_locale
                .as_ref()
                .is_some_and(|value| value.len() > MAX_APP_FIELD_BYTES)
        {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "apple_apps_invalid",
                "The Apple app list is invalid",
            ));
        }
    }
    Ok(apps)
}

fn validate_private_key(value: &str) -> Result<(), (StatusCode, Json<oore_contract::ApiError>)> {
    if value.is_empty()
        || value.len() > MAX_PRIVATE_KEY_BYTES
        || !value.starts_with("-----BEGIN PRIVATE KEY-----")
        || !value.trim_end().ends_with("-----END PRIVATE KEY-----")
    {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "apple_key_invalid",
            "Choose the p8 key downloaded from App Store Connect",
        ));
    }
    Ok(())
}

fn bounded_trimmed(
    value: &str,
    maximum: usize,
    field: &str,
) -> Result<String, (StatusCode, Json<oore_contract::ApiError>)> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > maximum
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "apple_account_invalid",
            format!("The Apple {field} is invalid"),
        ));
    }
    Ok(value.into())
}

fn require_runner(
    auth: &RunnerAuth,
    runner_id: &str,
) -> Result<(), (StatusCode, Json<oore_contract::ApiError>)> {
    if auth.runner_id != runner_id {
        return Err(api_err(
            StatusCode::FORBIDDEN,
            "runner_mismatch",
            "The runner token does not match",
        ));
    }
    Ok(())
}

fn digest_fields(fields: &[&[u8]]) -> String {
    let mut hasher = Sha256::new();
    for field in fields {
        hasher.update((field.len() as u64).to_be_bytes());
        hasher.update(field);
    }
    format!("sha256:{:x}", hasher.finalize())
}

fn safe_error(value: Option<&str>, fallback: &str) -> String {
    value
        .filter(|value| {
            !value.is_empty() && value.len() <= 512 && !value.chars().any(char::is_control)
        })
        .unwrap_or(fallback)
        .to_owned()
}

fn map_grant_error(error: CredentialGrantError) -> (StatusCode, Json<oore_contract::ApiError>) {
    match error {
        CredentialGrantError::InvalidRequest => api_err(
            StatusCode::BAD_REQUEST,
            "credential_grant_invalid",
            "The Apple credential grant is invalid",
        ),
        CredentialGrantError::Unavailable => api_err(
            StatusCode::CONFLICT,
            "credential_grant_unavailable",
            "The Apple credential grant is unavailable",
        ),
        CredentialGrantError::Store | CredentialGrantError::Crypto => internal_error(
            "credential_grant_failed",
            "The Apple credential grant could not be created",
        ),
    }
}

fn store_error(error: sqlx::Error) -> (StatusCode, Json<oore_contract::ApiError>) {
    tracing::error!(error = %error, "Apple account store operation failed");
    internal_error("store_error", "The Apple account could not be updated")
}

fn internal_error(
    code: &'static str,
    message: impl Into<String>,
) -> (StatusCode, Json<oore_contract::ApiError>) {
    api_err(StatusCode::INTERNAL_SERVER_ERROR, code, message)
}
