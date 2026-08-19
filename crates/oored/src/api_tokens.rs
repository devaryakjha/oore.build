use std::sync::Arc;

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use oore_contract::{
    ApiTokenSummary, CreateApiTokenRequest, CreateApiTokenResponse, ListApiTokensResponse,
    RevokeApiTokenResponse,
};
use serde::Deserialize;
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;
use crate::extractors::AuthUser;
use crate::rbac;
use crate::session::{AuthSource, SessionInfo};
use crate::store::write_audit_log;
use crate::token::{generate_token, hash_token};
use crate::util::{api_err, now_unix};

// ── Role hierarchy ───────────────────────────────────────────────

fn role_level(role: &str) -> u8 {
    match role {
        "owner" => 4,
        "admin" => 3,
        "developer" => 2,
        "qa_viewer" => 1,
        _ => 0,
    }
}

const VALID_ROLES: &[&str] = &["owner", "admin", "developer", "qa_viewer"];

fn effective_token_role(token_role: &str, current_role: &str) -> Option<String> {
    if !VALID_ROLES.contains(&token_role) || !VALID_ROLES.contains(&current_role) {
        return None;
    }

    Some(
        if role_level(token_role) <= role_level(current_role) {
            token_role
        } else {
            current_role
        }
        .to_string(),
    )
}

// ── DB helpers ───────────────────────────────────────────────────

pub async fn create_api_token(
    pool: &SqlitePool,
    created_by: &str,
    name: &str,
    role: &str,
    expires_at: Option<i64>,
) -> Result<(String, String, String, i64), sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let token = generate_token();
    let hashed = hash_token(&token);
    let prefix = token[..8].to_string();
    let now = now_unix();

    sqlx::query(
        "INSERT INTO api_tokens (id, name, token_hash, prefix, created_by, role, expires_at, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(name)
    .bind(&hashed)
    .bind(&prefix)
    .bind(created_by)
    .bind(role)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await?;

    Ok((id, token, prefix, now))
}

pub async fn validate_api_token(
    pool: &SqlitePool,
    token: &str,
) -> Result<Option<SessionInfo>, sqlx::Error> {
    let hashed = hash_token(token);
    validate_api_token_hash(pool, &hashed).await
}

pub(crate) async fn validate_api_token_hash(
    pool: &SqlitePool,
    token_hash: &str,
) -> Result<Option<SessionInfo>, sqlx::Error> {
    let now = now_unix();

    let row = sqlx::query(
        "SELECT t.id, t.role AS token_role, t.expires_at AS token_expires_at, \
                u.id AS user_id, u.email, u.oidc_subject, u.role AS current_role \
         FROM api_tokens t \
         JOIN users u ON u.id = t.created_by \
         WHERE t.token_hash = ?1 \
           AND t.revoked_at IS NULL \
           AND (t.expires_at IS NULL OR t.expires_at > ?2) \
           AND u.status = 'active'",
    )
    .bind(token_hash)
    .bind(now)
    .fetch_optional(pool)
    .await?;

    Ok(row.and_then(|r| {
        let token_expires_at: Option<i64> = r.get("token_expires_at");
        let token_role: String = r.get("token_role");
        let current_role: String = r.get("current_role");
        Some(SessionInfo {
            user_id: r.get("user_id"),
            email: r.get("email"),
            oidc_subject: r.get("oidc_subject"),
            role: effective_token_role(&token_role, &current_role)?,
            expires_at: token_expires_at.unwrap_or(i64::MAX),
            auth_source: AuthSource::ApiToken,
        })
    }))
}

pub async fn update_last_used(pool: &SqlitePool, token_hash: &str) {
    let now = now_unix();
    if let Err(e) = sqlx::query("UPDATE api_tokens SET last_used_at = ?1 WHERE token_hash = ?2")
        .bind(now)
        .bind(token_hash)
        .execute(pool)
        .await
    {
        error!(error = %e, "failed to update api_token last_used_at");
    }
}

// ── Handlers ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListApiTokensQuery {
    pub q: Option<String>,
    pub sort: Option<String>,
    pub direction: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list_api_tokens_handler(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(params): Query<ListApiTokensQuery>,
) -> Result<Json<ListApiTokensResponse>, (StatusCode, Json<oore_contract::ApiError>)> {
    rbac::check_permission(&state.enforcer, &auth.0.role, "api_tokens", "read").await?;

    let pool = state.db.clone();
    let now = now_unix();

    let is_admin = auth.0.role == "owner" || auth.0.role == "admin";

    let limit = params.limit.unwrap_or(20).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);
    let search = params.q.as_deref().map(str::trim).filter(|q| !q.is_empty());
    let status_sql = format!(
        "CASE WHEN t.revoked_at IS NOT NULL THEN 'revoked' WHEN t.expires_at IS NOT NULL AND t.expires_at <= {now} THEN 'expired' ELSE 'active' END"
    );
    let order = match params.sort.as_deref() {
        Some("name") => "t.name",
        Some("role") => "t.role",
        Some("status") => status_sql.as_str(),
        Some("last_used_at") => "COALESCE(t.last_used_at, 0)",
        _ => "t.created_at",
    };
    let direction = if params.direction.as_deref() == Some("asc") {
        "ASC"
    } else {
        "DESC"
    };

    let mut count = QueryBuilder::<Sqlite>::new(
        "SELECT COUNT(*) FROM api_tokens t JOIN users u ON u.id = t.created_by WHERE 1 = 1",
    );
    if !is_admin {
        count
            .push(" AND t.created_by = ")
            .push_bind(&auth.0.user_id);
    }
    if let Some(search) = search {
        count
            .push(" AND lower(t.name || ' ' || t.prefix || ' ' || t.role || ' ' || u.email || ' ' || ")
            .push(&status_sql)
            .push(") LIKE ")
            .push_bind(format!("%{}%", search.to_lowercase()));
    }
    let total: i64 = count
        .build_query_scalar()
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to count api tokens");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "db_error",
                "Failed to list API tokens",
            )
        })?;

    let mut query = QueryBuilder::<Sqlite>::new(
        "SELECT t.id, t.name, t.prefix, t.role, t.created_by, t.created_at, t.expires_at, t.last_used_at, t.revoked_at, u.email AS created_by_email FROM api_tokens t JOIN users u ON u.id = t.created_by WHERE 1 = 1",
    );
    if !is_admin {
        query
            .push(" AND t.created_by = ")
            .push_bind(&auth.0.user_id);
    }
    if let Some(search) = search {
        query
            .push(" AND lower(t.name || ' ' || t.prefix || ' ' || t.role || ' ' || u.email || ' ' || ")
            .push(&status_sql)
            .push(") LIKE ")
            .push_bind(format!("%{}%", search.to_lowercase()));
    }
    query
        .push(" ORDER BY ")
        .push(order)
        .push(" ")
        .push(direction)
        .push(", t.id ASC LIMIT ")
        .push_bind(limit)
        .push(" OFFSET ")
        .push_bind(offset);

    let rows = query.build().fetch_all(&pool).await;

    let rows = rows.map_err(|e| {
        error!(error = %e, "failed to list api tokens");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "db_error",
            "Failed to list API tokens",
        )
    })?;

    let tokens: Vec<ApiTokenSummary> = rows
        .iter()
        .map(|r| {
            let expires_at: Option<i64> = r.get("expires_at");
            let revoked_at: Option<i64> = r.get("revoked_at");
            ApiTokenSummary {
                id: r.get("id"),
                name: r.get("name"),
                prefix: r.get("prefix"),
                role: r.get("role"),
                created_by: r.get("created_by"),
                created_by_email: r.get("created_by_email"),
                created_at: r.get("created_at"),
                expires_at,
                last_used_at: r.get("last_used_at"),
                is_expired: expires_at.is_some_and(|ea| ea <= now),
                is_revoked: revoked_at.is_some(),
            }
        })
        .collect();

    Ok(Json(ListApiTokensResponse { tokens, total }))
}

pub async fn create_api_token_handler(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<CreateApiTokenRequest>,
) -> Result<Json<CreateApiTokenResponse>, (StatusCode, Json<oore_contract::ApiError>)> {
    rbac::check_permission(&state.enforcer, &auth.0.role, "api_tokens", "write").await?;

    // Validate name
    let name = req.name.trim();
    if name.is_empty() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Token name must not be empty",
        ));
    }

    // Validate role
    if !VALID_ROLES.contains(&req.role.as_str()) {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_role",
            format!(
                "Invalid role '{}'. Must be one of: owner, admin, developer, qa_viewer",
                req.role
            ),
        ));
    }

    // Cannot create a token with a higher role than your own
    if role_level(&req.role) > role_level(&auth.0.role) {
        return Err(api_err(
            StatusCode::FORBIDDEN,
            "role_escalation",
            "Cannot create a token with a higher role than your own",
        ));
    }

    let pool = state.db.clone();

    let (id, token, prefix, created_at) =
        create_api_token(&pool, &auth.0.user_id, name, &req.role, req.expires_at)
            .await
            .map_err(|e| {
                error!(error = %e, "failed to create api token");
                api_err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "db_error",
                    "Failed to create API token",
                )
            })?;

    // Audit log
    let details = format!("name={}, role={}, prefix={}", name, req.role, prefix);
    if let Err(e) = write_audit_log(
        &pool,
        Some(&auth.0.user_id),
        "api_token_created",
        "api_token",
        Some(&id),
        Some(&details),
    )
    .await
    {
        error!(error = %e, "failed to write audit log for api token creation");
    }

    info!(
        user_id = %auth.0.user_id,
        token_id = %id,
        role = %req.role,
        "API token created"
    );

    Ok(Json(CreateApiTokenResponse {
        id,
        name: name.to_string(),
        prefix,
        role: req.role,
        created_at,
        expires_at: req.expires_at,
        token,
    }))
}

pub async fn revoke_api_token_handler(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(token_id): Path<String>,
) -> Result<Json<RevokeApiTokenResponse>, (StatusCode, Json<oore_contract::ApiError>)> {
    rbac::check_permission(&state.enforcer, &auth.0.role, "api_tokens", "delete").await?;

    let pool = state.db.clone();

    // Fetch the token to check ownership
    let row = sqlx::query("SELECT created_by, revoked_at FROM api_tokens WHERE id = ?1")
        .bind(&token_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to query api token");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "db_error",
                "Failed to query API token",
            )
        })?;

    let row =
        row.ok_or_else(|| api_err(StatusCode::NOT_FOUND, "not_found", "API token not found"))?;

    let created_by: String = row.get("created_by");
    let revoked_at: Option<i64> = row.get("revoked_at");

    if revoked_at.is_some() {
        return Ok(Json(RevokeApiTokenResponse { revoked: true }));
    }

    // Non-admin users can only revoke their own tokens
    let is_admin = auth.0.role == "owner" || auth.0.role == "admin";
    if !is_admin && created_by != auth.0.user_id {
        return Err(api_err(
            StatusCode::FORBIDDEN,
            "permission_denied",
            "You can only revoke your own API tokens",
        ));
    }

    let now = now_unix();
    sqlx::query("UPDATE api_tokens SET revoked_at = ?1 WHERE id = ?2")
        .bind(now)
        .bind(&token_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to revoke api token");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "db_error",
                "Failed to revoke API token",
            )
        })?;

    // Audit log
    if let Err(e) = write_audit_log(
        &pool,
        Some(&auth.0.user_id),
        "api_token_revoked",
        "api_token",
        Some(&token_id),
        None,
    )
    .await
    {
        error!(error = %e, "failed to write audit log for api token revocation");
    }

    info!(
        user_id = %auth.0.user_id,
        token_id = %token_id,
        "API token revoked"
    );

    Ok(Json(RevokeApiTokenResponse { revoked: true }))
}
