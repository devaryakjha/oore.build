use std::sync::Arc;

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use oore_contract::{ApiError, ListOperatorIncidentsResponse, OperatorIncident};
use serde::Deserialize;
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use tracing::error;
use uuid::Uuid;

use crate::AppState;
use crate::extractors::AuthUser;
use crate::rbac::check_permission;
use crate::util::{api_err, now_unix};

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

pub(crate) struct IncidentInput<'a> {
    pub deduplication_key: &'a str,
    pub severity: &'a str,
    pub reason: &'a str,
    pub resource_kind: &'a str,
    pub resource_id: &'a str,
    pub resource_name: &'a str,
    pub repair_action: &'a str,
    pub repair_url: &'a str,
    pub audience_resource: &'a str,
    pub audience_action: &'a str,
}

pub(crate) async fn open_incident(
    pool: &SqlitePool,
    input: IncidentInput<'_>,
) -> anyhow::Result<String> {
    let now = now_unix();
    let existing =
        sqlx::query("SELECT id, status FROM operator_incidents WHERE deduplication_key = ?1")
            .bind(input.deduplication_key)
            .fetch_optional(pool)
            .await?;
    let (incident_id, notify) = existing.as_ref().map_or_else(
        || (Uuid::new_v4().to_string(), true),
        |row| {
            (
                row.get::<String, _>("id"),
                row.get::<String, _>("status") == "resolved",
            )
        },
    );

    sqlx::query(
        "INSERT INTO operator_incidents (id, deduplication_key, status, severity, reason, \
         resource_kind, resource_id, resource_name, repair_action, repair_url, audience_resource, \
         audience_action, first_occurrence_at, latest_occurrence_at, occurrence_count, created_at, updated_at) \
         VALUES (?1, ?2, 'open', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12, 1, ?12, ?12) \
         ON CONFLICT(deduplication_key) DO UPDATE SET status = 'open', severity = excluded.severity, \
         reason = excluded.reason, resource_name = excluded.resource_name, repair_action = excluded.repair_action, \
         repair_url = excluded.repair_url, audience_resource = excluded.audience_resource, \
         audience_action = excluded.audience_action, latest_occurrence_at = excluded.latest_occurrence_at, \
         occurrence_count = operator_incidents.occurrence_count + 1, resolved_at = NULL, updated_at = excluded.updated_at",
    )
    .bind(&incident_id)
    .bind(input.deduplication_key)
    .bind(input.severity)
    .bind(input.reason)
    .bind(input.resource_kind)
    .bind(input.resource_id)
    .bind(input.resource_name)
    .bind(input.repair_action)
    .bind(input.repair_url)
    .bind(input.audience_resource)
    .bind(input.audience_action)
    .bind(now)
    .execute(pool)
    .await?;

    if existing.is_none() || notify {
        let users = sqlx::query(
            "SELECT id FROM users WHERE status = 'active' AND role IN ('owner', 'admin')",
        )
        .fetch_all(pool)
        .await?;
        for users in users.chunks(100) {
            let mut query = QueryBuilder::<Sqlite>::new(
                "INSERT INTO operator_incident_notifications \
                 (id, incident_id, user_id, created_at, read_at) ",
            );
            query.push_values(users, |mut row, user| {
                row.push_bind(Uuid::new_v4().to_string())
                    .push_bind(&incident_id)
                    .push_bind(user.get::<String, _>("id"))
                    .push_bind(now)
                    .push_bind(None::<i64>);
            });
            query.push(
                " ON CONFLICT(incident_id, user_id) DO UPDATE SET \
                 created_at = excluded.created_at, read_at = NULL",
            );
            query.build().execute(pool).await?;
        }
    }
    Ok(incident_id)
}

pub(crate) async fn resolve_incident(
    pool: &SqlitePool,
    deduplication_key: &str,
) -> anyhow::Result<()> {
    let now = now_unix();
    sqlx::query(
        "UPDATE operator_incidents SET status = 'resolved', resolved_at = ?1, updated_at = ?1 \
         WHERE deduplication_key = ?2 AND status = 'open'",
    )
    .bind(now)
    .bind(deduplication_key)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Deserialize)]
pub struct IncidentQuery {
    status: Option<String>,
    resource_id: Option<String>,
}

fn row_to_incident(row: &sqlx::sqlite::SqliteRow) -> OperatorIncident {
    OperatorIncident {
        id: row.get("id"),
        status: row.get("status"),
        severity: row.get("severity"),
        reason: row.get("reason"),
        first_occurrence_at: row.get("first_occurrence_at"),
        latest_occurrence_at: row.get("latest_occurrence_at"),
        occurrence_count: row.get("occurrence_count"),
        resource_kind: row.get("resource_kind"),
        resource_id: row.get("resource_id"),
        resource_name: row.get("resource_name"),
        repair_action: row.get("repair_action"),
        repair_url: row.get("repair_url"),
        resolved_at: row.get("resolved_at"),
        read_at: row.get("read_at"),
    }
}

pub async fn list_incidents(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(query): Query<IncidentQuery>,
) -> ApiResult<ListOperatorIncidentsResponse> {
    check_permission(&state.enforcer, &auth.0.role, "integrations", "write").await?;
    let status = query.status.as_deref().unwrap_or("open");
    if !matches!(status, "open" | "resolved" | "all") {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_status",
            "status must be open, resolved, or all",
        ));
    }
    let rows = sqlx::query(
        "SELECT i.*, n.read_at FROM operator_incidents i \
         JOIN operator_incident_notifications n ON n.incident_id = i.id AND n.user_id = ?1 \
         WHERE (?2 = 'all' OR i.status = ?2) AND (?3 IS NULL OR i.resource_id = ?3) \
         ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, \
         i.latest_occurrence_at DESC",
    )
    .bind(&auth.0.user_id)
    .bind(status)
    .bind(query.resource_id)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        error!(%error, "failed to list operator incidents");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to load operator incidents",
        )
    })?;
    Ok(Json(ListOperatorIncidentsResponse {
        incidents: rows.iter().map(row_to_incident).collect(),
    }))
}

pub async fn mark_incident_read(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(incident_id): Path<String>,
) -> ApiResult<OperatorIncident> {
    check_permission(&state.enforcer, &auth.0.role, "integrations", "write").await?;
    sqlx::query(
        "UPDATE operator_incident_notifications SET read_at = COALESCE(read_at, ?1) \
         WHERE incident_id = ?2 AND user_id = ?3",
    )
    .bind(now_unix())
    .bind(&incident_id)
    .bind(&auth.0.user_id)
    .execute(&state.db)
    .await
    .map_err(|error| {
        error!(%error, "failed to mark operator incident read");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to update notification",
        )
    })?;
    let row = sqlx::query(
        "SELECT i.*, n.read_at FROM operator_incidents i \
         JOIN operator_incident_notifications n ON n.incident_id = i.id \
         WHERE i.id = ?1 AND n.user_id = ?2",
    )
    .bind(&incident_id)
    .bind(&auth.0.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|error| {
        error!(%error, "failed to load operator incident");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to load notification",
        )
    })?
    .ok_or_else(|| api_err(StatusCode::NOT_FOUND, "not_found", "Notification not found"))?;
    Ok(Json(row_to_incident(&row)))
}
