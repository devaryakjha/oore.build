use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;

use axum::Json;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::StatusCode;
use oore_contract::{
    ApiError, CreateProjectRequest, CreateProjectResponse, ListProjectsResponse, OkResponse,
    Project, ProjectDetailResponse, ProjectLatestBuild, ProjectListItem, ProjectRole, RuntimeMode,
    ScmProvider, UpdateProjectRequest,
};
use serde::Deserialize;
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use tracing::{error, info};
use uuid::Uuid;

use crate::AppState;
use crate::extractors::AuthUser;
use crate::project_rbac::{
    EffectiveProjectRole, ProjectPermission, require_project_permission,
    resolve_effective_project_role,
};
use crate::rbac::check_permission;
use crate::session::{AuthSource, SessionInfo};
use crate::store::write_audit_log;
use crate::util::{api_err, now_unix};

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

const PROJECT_SELECT: &str = "SELECT p.*, r.full_name AS repository_full_name, r.avatar_url AS repository_avatar_url, \
    i.provider AS repository_provider FROM projects p \
    LEFT JOIN integration_repositories r ON r.id = p.repository_id \
    LEFT JOIN integration_installations inst ON inst.id = r.installation_id \
    LEFT JOIN integrations i ON i.id = inst.integration_id";

const PROJECT_LIST_SELECT: &str = "SELECT p.*, r.full_name AS repository_full_name, r.avatar_url AS repository_avatar_url, \
    i.provider AS repository_provider, latest_build.id AS latest_build_id, \
    latest_build.build_number AS latest_build_number, latest_build.status AS latest_build_status, \
    latest_build.pipeline_id AS latest_build_pipeline_id, latest_pipeline.name AS latest_build_pipeline_name, \
    latest_build.created_at AS latest_build_created_at, latest_build.updated_at AS latest_build_updated_at, \
    latest_build.finished_at AS latest_build_finished_at FROM projects p \
    LEFT JOIN integration_repositories r ON r.id = p.repository_id \
    LEFT JOIN integration_installations inst ON inst.id = r.installation_id \
    LEFT JOIN integrations i ON i.id = inst.integration_id \
    LEFT JOIN ( \
        SELECT candidate.* FROM builds candidate \
        INNER JOIN (SELECT project_id, MAX(build_number) AS build_number FROM builds GROUP BY project_id) newest \
            ON newest.project_id = candidate.project_id AND newest.build_number = candidate.build_number \
    ) latest_build ON latest_build.project_id = p.id \
    LEFT JOIN pipelines latest_pipeline ON latest_pipeline.id = latest_build.pipeline_id";

const PROJECT_LIST_SELECT_WITH_MEMBER_ROLE: &str = "SELECT p.*, r.full_name AS repository_full_name, r.avatar_url AS repository_avatar_url, \
    i.provider AS repository_provider, pm.role AS project_member_role, \
    latest_build.id AS latest_build_id, latest_build.build_number AS latest_build_number, \
    latest_build.status AS latest_build_status, latest_build.pipeline_id AS latest_build_pipeline_id, \
    latest_pipeline.name AS latest_build_pipeline_name, latest_build.created_at AS latest_build_created_at, \
    latest_build.updated_at AS latest_build_updated_at, latest_build.finished_at AS latest_build_finished_at FROM projects p \
    LEFT JOIN integration_repositories r ON r.id = p.repository_id \
    LEFT JOIN integration_installations inst ON inst.id = r.installation_id \
    LEFT JOIN integrations i ON i.id = inst.integration_id \
    INNER JOIN project_members pm ON pm.project_id = p.id \
    LEFT JOIN ( \
        SELECT candidate.* FROM builds candidate \
        INNER JOIN (SELECT project_id, MAX(build_number) AS build_number FROM builds GROUP BY project_id) newest \
            ON newest.project_id = candidate.project_id AND newest.build_number = candidate.build_number \
    ) latest_build ON latest_build.project_id = p.id \
    LEFT JOIN pipelines latest_pipeline ON latest_pipeline.id = latest_build.pipeline_id";

// ── Row conversion ──────────────────────────────────────────────

fn row_to_project(
    row: &sqlx::sqlite::SqliteRow,
    current_user_role: ProjectRole,
) -> Result<Project, (StatusCode, Json<ApiError>)> {
    let settings_str: String = row.get("settings");
    let settings: serde_json::Value =
        serde_json::from_str(&settings_str).unwrap_or(serde_json::json!({}));
    let repository_provider = row
        .get::<Option<String>, _>("repository_provider")
        .map(|provider| provider.parse::<ScmProvider>())
        .transpose()
        .map_err(|_| {
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "data_error",
                "Invalid repository provider in database",
            )
        })?;

    Ok(Project {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        repository_id: row.get("repository_id"),
        repository_full_name: row.get("repository_full_name"),
        repository_avatar_url: row.get("repository_avatar_url"),
        repository_provider,
        settings,
        default_branch: row.get("default_branch"),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        current_user_role,
    })
}

fn row_to_project_list_item(
    row: &sqlx::sqlite::SqliteRow,
    current_user_role: ProjectRole,
) -> Result<ProjectListItem, (StatusCode, Json<ApiError>)> {
    let project = row_to_project(row, current_user_role)?;
    let latest_build_id: Option<String> = row.get("latest_build_id");
    let latest_build = latest_build_id.map(|id| ProjectLatestBuild {
        id,
        build_number: row.get("latest_build_number"),
        status: row.get("latest_build_status"),
        pipeline_id: row.get("latest_build_pipeline_id"),
        pipeline_name: row.get("latest_build_pipeline_name"),
        created_at: row.get("latest_build_created_at"),
        updated_at: row.get("latest_build_updated_at"),
        finished_at: row.get("latest_build_finished_at"),
    });

    Ok(ProjectListItem {
        project,
        latest_build,
    })
}

fn project_role_level(role: ProjectRole) -> u8 {
    match role {
        ProjectRole::Maintainer => 3,
        ProjectRole::Developer => 2,
        ProjectRole::Viewer => 1,
    }
}

fn lesser_project_role(left: ProjectRole, right: ProjectRole) -> ProjectRole {
    if project_role_level(left) <= project_role_level(right) {
        left
    } else {
        right
    }
}

fn effective_member_role_for_response(
    stored_role: ProjectRole,
    instance_role: &str,
    auth_source: &AuthSource,
) -> ProjectRole {
    if instance_role == "qa_viewer" {
        return ProjectRole::Viewer;
    }

    if *auth_source == AuthSource::ApiToken {
        let cap = if instance_role == "developer" {
            ProjectRole::Developer
        } else {
            ProjectRole::Viewer
        };
        return lesser_project_role(stored_role, cap);
    }

    stored_role
}

fn project_role_for_response(
    effective_role: &EffectiveProjectRole,
) -> Result<ProjectRole, (StatusCode, Json<ApiError>)> {
    match effective_role {
        EffectiveProjectRole::InstanceAdmin => Ok(ProjectRole::Maintainer),
        EffectiveProjectRole::Member(role) => Ok(*role),
        EffectiveProjectRole::None => Err(api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "authorization_error",
            "Project response is missing an effective role",
        )),
    }
}

fn normalize_local_repo_path(raw: &str) -> Result<PathBuf, (StatusCode, Json<ApiError>)> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "local_repository_path is required",
        ));
    }

    let candidate = PathBuf::from(trimmed);
    if !candidate.is_absolute() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "local_repository_path must be an absolute path",
        ));
    }

    std::fs::canonicalize(&candidate).map_err(|_| {
        api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "local_repository_path does not exist or is not accessible",
        )
    })
}

fn assert_git_repo(path: &std::path::Path) -> Result<(), (StatusCode, Json<ApiError>)> {
    let path_str = path.to_string_lossy().into_owned();

    let inside = Command::new("git")
        .args([
            "-C",
            path_str.as_str(),
            "rev-parse",
            "--is-inside-work-tree",
        ])
        .output();
    if let Ok(output) = inside
        && output.status.success()
        && String::from_utf8_lossy(&output.stdout).trim() == "true"
    {
        return Ok(());
    }

    let bare = Command::new("git")
        .args(["-C", path_str.as_str(), "rev-parse", "--is-bare-repository"])
        .output();
    if let Ok(output) = bare
        && output.status.success()
        && String::from_utf8_lossy(&output.stdout).trim() == "true"
    {
        return Ok(());
    }

    Err(api_err(
        StatusCode::BAD_REQUEST,
        "invalid_repository",
        "local_repository_path is not a valid git repository",
    ))
}

fn resolve_default_branch(path: &std::path::Path) -> Option<String> {
    let path_str = path.to_string_lossy().into_owned();
    Command::new("git")
        .args(["-C", path_str.as_str(), "symbolic-ref", "--short", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

struct LocalRepoInspection {
    canonical_str: String,
    default_branch: Option<String>,
    repo_name: String,
}

async fn inspect_local_repo_for_project(
    raw_path: &str,
) -> Result<LocalRepoInspection, (StatusCode, Json<ApiError>)> {
    let raw_path = raw_path.to_string();
    tokio::task::spawn_blocking(move || {
        let canonical_path = normalize_local_repo_path(&raw_path)?;
        assert_git_repo(&canonical_path)?;

        let default_branch = resolve_default_branch(&canonical_path);
        let canonical_str = canonical_path.to_string_lossy().into_owned();
        let repo_name = canonical_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| "local-repo".to_string());

        Ok(LocalRepoInspection {
            canonical_str,
            default_branch,
            repo_name,
        })
    })
    .await
    .map_err(|e| {
        error!(error = %e, "local repository inspection task panicked or was cancelled");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to inspect local repository",
        )
    })?
}

async fn ensure_local_repository_for_project(
    pool: &sqlx::SqlitePool,
    actor_user_id: &str,
    raw_path: &str,
) -> Result<(String, Option<String>), (StatusCode, Json<ApiError>)> {
    let inspection = inspect_local_repo_for_project(raw_path).await?;
    let canonical_str = inspection.canonical_str.clone();

    let existing = sqlx::query(
        "SELECT r.id as repository_id, r.default_branch as default_branch \
         FROM integration_repositories r \
         JOIN integration_installations inst ON inst.id = r.installation_id \
         JOIN integrations i ON i.id = inst.integration_id \
         WHERE i.provider = 'local_git' AND r.external_id = ?1 \
         LIMIT 1",
    )
    .bind(&canonical_str)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to query existing local repository mapping");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to check existing repository mappings",
        )
    })?;

    if let Some(row) = existing {
        let repository_id: String = row.get("repository_id");
        let default_branch: Option<String> = row.get("default_branch");
        return Ok((repository_id, default_branch));
    }

    let default_branch = inspection.default_branch;
    let repo_name = inspection.repo_name;
    let now = now_unix();
    let integration_id = Uuid::new_v4().to_string();
    let installation_id = Uuid::new_v4().to_string();
    let repository_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO integrations (id, provider, host_url, auth_mode, status, display_name, created_by, created_at, updated_at) \
         VALUES (?1, 'local_git', 'local://filesystem', 'local_path', 'active', ?2, ?3, ?4, ?4)",
    )
    .bind(&integration_id)
    .bind(&repo_name)
    .bind(actor_user_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to create local integration during project create");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to register local repository",
        )
    })?;

    sqlx::query(
        "INSERT INTO integration_installations (id, integration_id, external_id, account_name, account_type, permissions, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 'local', 'filesystem', '{}', ?4, ?4)",
    )
    .bind(&installation_id)
    .bind(&integration_id)
    .bind(&canonical_str)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to create local installation during project create");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to register local repository",
        )
    })?;

    sqlx::query(
        "INSERT INTO integration_repositories (id, installation_id, external_id, full_name, default_branch, is_private, html_url, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?7)",
    )
    .bind(&repository_id)
    .bind(&installation_id)
    .bind(&canonical_str)
    .bind(&repo_name)
    .bind(&default_branch)
    .bind(&canonical_str)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to create local repository during project create");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to register local repository",
        )
    })?;

    Ok((repository_id, default_branch))
}

async fn require_repository_attachable(
    pool: &sqlx::SqlitePool,
    repository_id: &str,
) -> Result<String, (StatusCode, Json<ApiError>)> {
    let repository = sqlx::query(
        "SELECT r.full_name, i.provider FROM integration_repositories r \
         JOIN integration_installations inst ON inst.id = r.installation_id \
         JOIN integrations i ON i.id = inst.integration_id WHERE r.id = ?1",
    )
    .bind(repository_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to authorize repository attachment");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to validate repository",
        )
    })?
    .ok_or_else(|| {
        api_err(
            StatusCode::BAD_REQUEST,
            "invalid_repository",
            "Repository not found",
        )
    })?;

    let provider: String = repository.get("provider");
    if provider == "local_git"
        && crate::instance_settings::load_runtime_mode(pool)
            .await
            .map_err(|e| {
                error!(error = %e, "failed to load runtime mode");
                api_err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "store_error",
                    "Failed to determine runtime mode",
                )
            })?
            != RuntimeMode::Local
    {
        return Err(api_err(
            StatusCode::FORBIDDEN,
            "mode_restricted",
            "Local repositories are only available in local mode",
        ));
    }

    Ok(repository.get("full_name"))
}

// ── Query parameters ────────────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
pub struct ListProjectsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
    pub integration_id: Option<String>,
    pub sort: Option<String>,
    pub direction: Option<String>,
}

async fn fetch_projects_page(
    pool: &SqlitePool,
    auth: &SessionInfo,
    params: &ListProjectsQuery,
) -> Result<ListProjectsResponse, (StatusCode, Json<ApiError>)> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);
    let order_by = project_order_clause(params.sort.as_deref(), params.direction.as_deref())?;

    let is_admin = auth.role == "owner" || auth.role == "admin";

    let count_from = if is_admin {
        "SELECT COUNT(*) FROM projects p \
         LEFT JOIN integration_repositories r ON r.id = p.repository_id \
         LEFT JOIN integration_installations inst ON inst.id = r.installation_id \
         LEFT JOIN integrations i ON i.id = inst.integration_id"
    } else {
        "SELECT COUNT(*) FROM projects p \
         LEFT JOIN integration_repositories r ON r.id = p.repository_id \
         LEFT JOIN integration_installations inst ON inst.id = r.installation_id \
         LEFT JOIN integrations i ON i.id = inst.integration_id \
         INNER JOIN project_members pm ON pm.project_id = p.id"
    };
    let user_id = (!is_admin).then_some(auth.user_id.as_str());

    let mut count_query = QueryBuilder::<Sqlite>::new(count_from);
    push_project_filters(
        &mut count_query,
        user_id,
        params.integration_id.as_deref(),
        params.search.as_deref(),
    );
    let total: i64 = count_query
        .build_query_scalar()
        .fetch_one(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to count projects");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "store_error",
                "Failed to list projects",
            )
        })?;

    let mut projects_query = QueryBuilder::<Sqlite>::new(if is_admin {
        PROJECT_LIST_SELECT
    } else {
        PROJECT_LIST_SELECT_WITH_MEMBER_ROLE
    });
    push_project_filters(
        &mut projects_query,
        user_id,
        params.integration_id.as_deref(),
        params.search.as_deref(),
    );
    projects_query
        .push(" ORDER BY ")
        .push(order_by)
        .push(" LIMIT ")
        .push_bind(limit)
        .push(" OFFSET ")
        .push_bind(offset);
    let rows = projects_query.build().fetch_all(pool).await.map_err(|e| {
        error!(error = %e, "failed to list projects");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to list projects",
        )
    })?;

    let projects = if is_admin {
        rows.iter()
            .map(|row| row_to_project_list_item(row, ProjectRole::Maintainer))
            .collect::<Result<Vec<_>, (StatusCode, Json<ApiError>)>>()?
    } else {
        rows.iter()
            .map(|row| {
                let stored_role: String = row.get("project_member_role");
                let stored_role: ProjectRole = stored_role.parse().map_err(|_| {
                    api_err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "data_error",
                        "Invalid project role in database",
                    )
                })?;
                let current_user_role =
                    effective_member_role_for_response(stored_role, &auth.role, &auth.auth_source);
                row_to_project_list_item(row, current_user_role)
            })
            .collect::<Result<Vec<_>, (StatusCode, Json<ApiError>)>>()?
    };

    Ok(ListProjectsResponse { projects, total })
}

fn push_project_filters(
    query: &mut QueryBuilder<Sqlite>,
    user_id: Option<&str>,
    integration_id: Option<&str>,
    search: Option<&str>,
) {
    let mut has_condition = false;

    if let Some(user_id) = user_id {
        query.push(" WHERE pm.user_id = ").push_bind(user_id);
        has_condition = true;
    }

    if let Some(integration_id) = integration_id {
        query
            .push(if has_condition { " AND " } else { " WHERE " })
            .push("i.id = ")
            .push_bind(integration_id);
        has_condition = true;
    }

    if let Some(search) = search {
        query
            .push(if has_condition { " AND " } else { " WHERE " })
            .push("(p.name LIKE ")
            .push_bind(format!("%{search}%"))
            .push(" OR p.description LIKE ")
            .push_bind(format!("%{search}%"))
            .push(")");
    }
}

fn project_order_clause(
    sort: Option<&str>,
    direction: Option<&str>,
) -> Result<String, (StatusCode, Json<ApiError>)> {
    let column = match sort.unwrap_or("created_at") {
        "created_at" => "p.created_at",
        "updated_at" => "p.updated_at",
        "name" => "p.name COLLATE NOCASE",
        _ => {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "sort must be created_at, updated_at, or name",
            ));
        }
    };
    let direction = match direction.unwrap_or("desc") {
        "asc" => "ASC",
        "desc" => "DESC",
        _ => {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "direction must be asc or desc",
            ));
        }
    };

    Ok(format!("{column} {direction}, p.id {direction}"))
}

// ── Handlers ────────────────────────────────────────────────────

/// `POST /v1/projects` — create a new project.
pub async fn create_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<CreateProjectResponse>), (StatusCode, Json<ApiError>)> {
    // Linking a repository to a project authorizes its build commands to run on
    // the Direct runner account. Keep that trust decision with instance admins.
    auth.require_admin_or_above()?;
    check_permission(&state.enforcer, &auth.0.role, "projects", "write").await?;

    let name = req.name.trim();
    if name.is_empty() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Project name must not be empty",
        ));
    }

    let pool = state.db.clone();

    if req.repository_id.is_some() && req.local_repository_path.is_some() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Provide either repository_id or local_repository_path, not both",
        ));
    }

    if req.local_repository_path.is_some() {
        check_permission(&state.enforcer, &auth.0.role, "integrations", "write").await?;
        if crate::instance_settings::load_runtime_mode(&pool)
            .await
            .map_err(|e| {
                error!(error = %e, "failed to load runtime mode");
                api_err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "store_error",
                    "Failed to determine runtime mode",
                )
            })?
            != RuntimeMode::Local
        {
            return Err(api_err(
                StatusCode::FORBIDDEN,
                "mode_restricted",
                "Local repositories are only available in local mode",
            ));
        }
    }

    let (repository_id, inferred_default_branch) = match (
        req.repository_id.clone(),
        req.local_repository_path.as_deref(),
    ) {
        (Some(repo_id), None) => {
            require_repository_attachable(&pool, &repo_id).await?;
            (Some(repo_id), None)
        }
        (None, Some(local_repo_path)) => {
            let (repo_id, branch) =
                ensure_local_repository_for_project(&pool, &auth.0.user_id, local_repo_path)
                    .await?;
            (Some(repo_id), branch)
        }
        (None, None) => {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "repository_id or local_repository_path is required",
            ));
        }
        (Some(_), Some(_)) => {
            // Already validated above.
            unreachable!("validated mutually exclusive repository inputs")
        }
    };

    let default_branch = req.default_branch.clone().or(inferred_default_branch);

    let now = now_unix();
    let project_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO projects (id, name, description, repository_id, settings, default_branch, created_by, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, '{}', ?5, ?6, ?7, ?7)",
    )
    .bind(&project_id)
    .bind(name)
    .bind(&req.description)
    .bind(&repository_id)
    .bind(&default_branch)
    .bind(&auth.0.user_id)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to create project");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to create project")
    })?;

    let details = serde_json::json!({
        "project_name": name,
        "created_by": auth.0.email,
        "repository_id": repository_id,
    })
    .to_string();
    let _ = write_audit_log(
        &pool,
        Some(&auth.0.user_id),
        "project_created",
        "project",
        Some(&project_id),
        Some(&details),
    )
    .await;

    // Auto-add creator as project maintainer (only for non-admin/non-owner users
    // who will need explicit membership; admins/owners bypass membership checks).
    if auth.0.role != "owner" && auth.0.role != "admin" {
        let member_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO project_members (id, project_id, user_id, role, created_by, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 'maintainer', ?3, ?4, ?4)",
        )
        .bind(&member_id)
        .bind(&project_id)
        .bind(&auth.0.user_id)
        .bind(now)
        .execute(&pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to auto-add creator as project maintainer");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to add creator as project member")
        })?;
    }

    let effective = resolve_effective_project_role(
        &pool,
        &auth.0.user_id,
        &auth.0.role,
        &project_id,
        &auth.0.auth_source,
    )
    .await?;
    let current_user_role = project_role_for_response(&effective)?;

    info!(project_id = %project_id, name = %name, "project created");

    let project = Project {
        id: project_id,
        name: name.to_string(),
        description: req.description,
        repository_id,
        repository_full_name: None,
        repository_avatar_url: None,
        repository_provider: None,
        settings: serde_json::json!({}),
        default_branch,
        created_by: auth.0.user_id,
        created_at: now,
        updated_at: now,
        current_user_role,
    };

    Ok((StatusCode::CREATED, Json(CreateProjectResponse { project })))
}

/// `GET /v1/projects` — list projects with optional search.
///
/// For owner/admin: returns all projects.
/// For developer/qa_viewer: returns only projects where the user has explicit membership.
pub async fn list_projects(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(params): Query<ListProjectsQuery>,
) -> ApiResult<ListProjectsResponse> {
    // All authenticated users can call this endpoint; filtering is role-based.
    let response = fetch_projects_page(&state.db, &auth.0, &params).await?;
    Ok(Json(response))
}

/// `GET /v1/projects/{project_id}` — project detail with counts.
pub async fn get_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    AxumPath(project_id): AxumPath<String>,
) -> ApiResult<ProjectDetailResponse> {
    let pool = state.db.clone();

    let effective = resolve_effective_project_role(
        &pool,
        &auth.0.user_id,
        &auth.0.role,
        &project_id,
        &auth.0.auth_source,
    )
    .await?;
    require_project_permission(&effective, ProjectPermission::Read)?;

    let project_row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "{PROJECT_SELECT} WHERE p.id = ?1"
    )))
    .bind(&project_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to fetch project");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to fetch project",
        )
    })?
    .ok_or_else(|| api_err(StatusCode::NOT_FOUND, "not_found", "Project not found"))?;

    let current_user_role = project_role_for_response(&effective)?;
    let project = row_to_project(&project_row, current_user_role)?;

    let pipeline_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM pipelines WHERE project_id = ?1")
            .bind(&project_id)
            .fetch_one(&pool)
            .await
            .unwrap_or(0);

    let build_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM builds WHERE project_id = ?1")
        .bind(&project_id)
        .fetch_one(&pool)
        .await
        .unwrap_or(0);

    Ok(Json(ProjectDetailResponse {
        project,
        pipeline_count,
        build_count,
        current_user_role,
    }))
}

/// `PATCH /v1/projects/{project_id}` — partial update.
pub async fn update_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    AxumPath(project_id): AxumPath<String>,
    Json(req): Json<UpdateProjectRequest>,
) -> ApiResult<CreateProjectResponse> {
    let pool = state.db.clone();

    let effective = resolve_effective_project_role(
        &pool,
        &auth.0.user_id,
        &auth.0.role,
        &project_id,
        &auth.0.auth_source,
    )
    .await?;
    require_project_permission(&effective, ProjectPermission::Write)?;
    let current_user_role = project_role_for_response(&effective)?;

    // Verify project exists
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM projects WHERE id = ?1")
        .bind(&project_id)
        .fetch_one(&pool)
        .await
        .unwrap_or(false);

    if !exists {
        return Err(api_err(
            StatusCode::NOT_FOUND,
            "not_found",
            "Project not found",
        ));
    }

    // Validate name if provided
    if let Some(ref name) = req.name
        && name.trim().is_empty()
    {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Project name must not be empty",
        ));
    }

    let requested_source_full_name = if let Some(ref repo_id) = req.repository_id {
        auth.require_admin_or_above()?;
        Some(require_repository_attachable(&pool, repo_id).await?)
    } else {
        None
    };

    let now = now_unix();

    // Build dynamic SET clause for partial update
    let mut set_parts = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref name) = req.name {
        bind_values.push(name.trim().to_string());
        set_parts.push(format!("name = ?{}", bind_values.len()));
    }
    if let Some(ref description) = req.description {
        bind_values.push(description.clone());
        set_parts.push(format!("description = ?{}", bind_values.len()));
    }
    if let Some(ref repository_id) = req.repository_id {
        bind_values.push(repository_id.clone());
        set_parts.push(format!("repository_id = ?{}", bind_values.len()));
    }
    if let Some(ref default_branch) = req.default_branch {
        bind_values.push(default_branch.clone());
        set_parts.push(format!("default_branch = ?{}", bind_values.len()));
    }
    if let Some(ref settings) = req.settings {
        bind_values.push(settings.to_string());
        set_parts.push(format!("settings = ?{}", bind_values.len()));
    }

    if set_parts.is_empty() {
        // Nothing to update — just return the current project
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "{PROJECT_SELECT} WHERE p.id = ?1"
        )))
        .bind(&project_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to fetch project");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "store_error",
                "Failed to fetch project",
            )
        })?;
        return Ok(Json(CreateProjectResponse {
            project: row_to_project(&row, current_user_role)?,
        }));
    }

    // Always update updated_at
    bind_values.push(now.to_string());
    set_parts.push(format!("updated_at = ?{}", bind_values.len()));

    let query = format!(
        "UPDATE projects SET {} WHERE id = ?{}",
        set_parts.join(", "),
        bind_values.len() + 1
    );

    let mut q = sqlx::query(sqlx::AssertSqlSafe(query));
    for val in &bind_values {
        q = q.bind(val);
    }
    q = q.bind(&project_id);

    let mut tx = pool.begin().await.map_err(|e| {
        error!(error = %e, project_id = %project_id, "failed to start project update transaction");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to update project",
        )
    })?;

    let source_changed = if let (Some(repository_id), Some(repository_full_name)) = (
        req.repository_id.as_deref(),
        requested_source_full_name.as_deref(),
    ) {
        let result = sqlx::query(
            "INSERT INTO audit_logs \
             (actor_id, action, resource_type, resource_id, details, created_at) \
             SELECT ?1, 'project_source_link_updated', 'project', p.id, \
                    json_object( \
                      'previous_repository_id', p.repository_id, \
                      'previous_repository_full_name', old_r.full_name, \
                      'repository_id', ?3, \
                      'repository_full_name', ?4, \
                      'updated_by', ?5 \
                    ), ?6 \
             FROM projects p \
             LEFT JOIN integration_repositories old_r ON old_r.id = p.repository_id \
             WHERE p.id = ?2 AND p.repository_id IS NOT ?3",
        )
        .bind(&auth.0.user_id)
        .bind(&project_id)
        .bind(repository_id)
        .bind(repository_full_name)
        .bind(&auth.0.email)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!(error = %e, project_id = %project_id, "failed to audit project source change");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "store_error",
                "Failed to update project source",
            )
        })?;
        result.rows_affected() == 1
    } else {
        false
    };

    if source_changed {
        sqlx::query(
            "INSERT INTO build_events \
             (id, build_id, from_status, to_status, actor, reason, created_at) \
             SELECT lower(hex(randomblob(16))), id, status, 'canceled', ?1, \
                    'Canceled because the project source changed; trigger a new build from the new source', ?2 \
             FROM builds \
             WHERE project_id = ?3 AND status IN ('queued', 'scheduled')",
        )
        .bind(&auth.0.email)
        .bind(now)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!(error = %e, project_id = %project_id, "failed to record source-change build cancellations");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "store_error",
                "Failed to update project source",
            )
        })?;

        sqlx::query(
            "UPDATE builds \
             SET status = 'canceled', runner_id = NULL, signing_token_hash = NULL, \
                 finished_at = ?1, updated_at = ?1 \
             WHERE project_id = ?2 AND status IN ('queued', 'scheduled')",
        )
        .bind(now)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!(error = %e, project_id = %project_id, "failed to cancel pending builds during source change");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "store_error",
                "Failed to update project source",
            )
        })?;
    }

    let update_result = q.execute(&mut *tx).await.map_err(|e| {
        error!(error = %e, "failed to update project");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to update project",
        )
    })?;
    if update_result.rows_affected() != 1 {
        return Err(api_err(
            StatusCode::NOT_FOUND,
            "not_found",
            "Project not found",
        ));
    }

    tx.commit().await.map_err(|e| {
        error!(error = %e, project_id = %project_id, "failed to commit project update");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to update project",
        )
    })?;

    let details = serde_json::json!({
        "updated_by": auth.0.email,
    })
    .to_string();
    let _ = write_audit_log(
        &pool,
        Some(&auth.0.user_id),
        "project_updated",
        "project",
        Some(&project_id),
        Some(&details),
    )
    .await;

    info!(project_id = %project_id, "project updated");

    let row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "{PROJECT_SELECT} WHERE p.id = ?1"
    )))
    .bind(&project_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to reload project");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to reload project",
        )
    })?;

    Ok(Json(CreateProjectResponse {
        project: row_to_project(&row, current_user_role)?,
    }))
}

/// `DELETE /v1/projects/{project_id}` — delete a project.
pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    AxumPath(project_id): AxumPath<String>,
) -> ApiResult<OkResponse> {
    let pool = state.db.clone();

    let effective = resolve_effective_project_role(
        &pool,
        &auth.0.user_id,
        &auth.0.role,
        &project_id,
        &auth.0.auth_source,
    )
    .await?;
    require_project_permission(&effective, ProjectPermission::Delete)?;

    // Use a transaction so the active-build check, terminal-build cleanup,
    // and project delete are atomic (prevents race with concurrent build creation).
    let mut tx = pool.begin().await.map_err(|e| {
        error!(error = %e, "failed to begin transaction");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to delete project",
        )
    })?;

    // Verify project exists
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM projects WHERE id = ?1")
        .bind(&project_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(false);

    if !exists {
        return Err(api_err(
            StatusCode::NOT_FOUND,
            "not_found",
            "Project not found",
        ));
    }

    // Check for non-terminal builds
    let active_builds: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM builds WHERE project_id = ?1 \
         AND status NOT IN ('succeeded', 'failed', 'canceled', 'timed_out', 'expired')",
    )
    .bind(&project_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    if active_builds > 0 {
        return Err(api_err(
            StatusCode::CONFLICT,
            "active_builds",
            "Cannot delete project with active builds",
        ));
    }

    let artifact_rows = sqlx::query(
        "SELECT DISTINCT a.file_path FROM artifacts a \
         JOIN builds b ON b.id = a.build_id WHERE b.project_id = ?1",
    )
    .bind(&project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to load project artifacts");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to delete project",
        )
    })?;

    {
        let storage = state.storage.read().await.clone();
        if !artifact_rows.is_empty() && matches!(&storage, crate::storage::StorageBackend::Disabled)
        {
            return Err(api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Artifact storage must be available to delete this project",
            ));
        }
        for artifact in artifact_rows {
            let file_path: String = artifact.get("file_path");
            storage.delete_object(&file_path).await.map_err(|e| {
                error!(error = %e, file_path = %file_path, "failed to delete project artifact");
                api_err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "storage_error",
                    "Failed to delete project artifacts",
                )
            })?;
        }
    }

    // Delete terminal builds first (non-cascading FK on builds.project_id)
    sqlx::query(
        "DELETE FROM builds WHERE project_id = ?1 \
         AND status IN ('succeeded', 'failed', 'canceled', 'timed_out', 'expired')",
    )
    .bind(&project_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to clean up builds for project");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to delete project",
        )
    })?;

    sqlx::query("DELETE FROM projects WHERE id = ?1")
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to delete project");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "store_error",
                "Failed to delete project",
            )
        })?;

    tx.commit().await.map_err(|e| {
        error!(error = %e, "failed to commit delete transaction");
        api_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "store_error",
            "Failed to delete project",
        )
    })?;

    let details = serde_json::json!({
        "deleted_by": auth.0.email,
    })
    .to_string();
    let _ = write_audit_log(
        &pool,
        Some(&auth.0.user_id),
        "project_deleted",
        "project",
        Some(&project_id),
        Some(&details),
    )
    .await;

    info!(project_id = %project_id, "project deleted");

    Ok(Json(OkResponse { ok: true }))
}

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    use super::*;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect test database");

        for statement in [
            "CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, repository_id TEXT, settings TEXT NOT NULL DEFAULT '{}', default_branch TEXT, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
            "CREATE TABLE integrations (id TEXT PRIMARY KEY, provider TEXT NOT NULL)",
            "CREATE TABLE integration_installations (id TEXT PRIMARY KEY, integration_id TEXT NOT NULL)",
            "CREATE TABLE integration_repositories (id TEXT PRIMARY KEY, installation_id TEXT NOT NULL, full_name TEXT NOT NULL, avatar_url TEXT)",
            "CREATE TABLE project_members (project_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL)",
            "CREATE TABLE pipelines (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL)",
            "CREATE TABLE builds (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, pipeline_id TEXT NOT NULL, build_number INTEGER NOT NULL, status TEXT NOT NULL, finished_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(project_id, build_number))",
        ] {
            sqlx::query(statement)
                .execute(&pool)
                .await
                .expect("create test schema");
        }

        pool
    }

    fn auth(user_id: &str, role: &str) -> SessionInfo {
        SessionInfo {
            user_id: user_id.to_string(),
            email: format!("{user_id}@example.com"),
            oidc_subject: user_id.to_string(),
            role: role.to_string(),
            expires_at: i64::MAX,
            auth_source: AuthSource::Session,
        }
    }

    async fn insert_project(
        pool: &SqlitePool,
        id: &str,
        name: &str,
        repository_id: Option<&str>,
        updated_at: i64,
    ) {
        sqlx::query(
            "INSERT INTO projects (id, name, description, repository_id, settings, default_branch, created_by, created_at, updated_at) \
             VALUES (?1, ?2, NULL, ?3, '{}', 'main', 'owner', ?4, ?4)",
        )
        .bind(id)
        .bind(name)
        .bind(repository_id)
        .bind(updated_at)
        .execute(pool)
        .await
        .expect("insert project");
    }

    async fn insert_build(
        pool: &SqlitePool,
        id: &str,
        project_id: &str,
        pipeline_id: &str,
        build_number: i64,
        status: &str,
        created_at: i64,
        finished_at: Option<i64>,
    ) {
        sqlx::query(
            "INSERT INTO builds (id, project_id, pipeline_id, build_number, status, finished_at, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        )
        .bind(id)
        .bind(project_id)
        .bind(pipeline_id)
        .bind(build_number)
        .bind(status)
        .bind(finished_at)
        .bind(created_at)
        .execute(pool)
        .await
        .expect("insert build");
    }

    #[tokio::test]
    async fn owner_and_admin_receive_deterministic_latest_builds() {
        let pool = test_pool().await;
        insert_project(&pool, "empty", "Empty", None, 10).await;
        insert_project(&pool, "built", "Built", None, 20).await;
        insert_project(&pool, "missing-pipeline", "Missing pipeline", None, 30).await;

        sqlx::query(
            "INSERT INTO pipelines (id, project_id, name) VALUES ('pipeline', 'built', 'Release')",
        )
        .execute(&pool)
        .await
        .expect("insert pipeline");
        insert_build(
            &pool,
            "older",
            "built",
            "pipeline",
            2,
            "succeeded",
            20,
            Some(21),
        )
        .await;
        insert_build(
            &pool,
            "latest",
            "built",
            "pipeline",
            7,
            "failed",
            70,
            Some(71),
        )
        .await;
        insert_build(
            &pool,
            "orphaned",
            "missing-pipeline",
            "deleted-pipeline",
            4,
            "running",
            40,
            None,
        )
        .await;

        for role in ["owner", "admin"] {
            let response = fetch_projects_page(
                &pool,
                &auth(role, role),
                &ListProjectsQuery {
                    sort: Some("name".to_string()),
                    direction: Some("asc".to_string()),
                    ..Default::default()
                },
            )
            .await
            .expect("list projects");

            assert_eq!(response.total, 3);
            assert!(response.projects[1].latest_build.is_none());

            let built = response
                .projects
                .iter()
                .find(|item| item.project.id == "built")
                .expect("built project");
            let latest = built.latest_build.as_ref().expect("latest build");
            assert_eq!(latest.id, "latest");
            assert_eq!(latest.build_number, 7);
            assert_eq!(latest.status, "failed");
            assert_eq!(latest.pipeline_id, "pipeline");
            assert_eq!(latest.pipeline_name.as_deref(), Some("Release"));
            assert_eq!(latest.created_at, 70);
            assert_eq!(latest.updated_at, 70);
            assert_eq!(latest.finished_at, Some(71));

            let missing_pipeline = response
                .projects
                .iter()
                .find(|item| item.project.id == "missing-pipeline")
                .expect("project with missing pipeline");
            let latest = missing_pipeline
                .latest_build
                .as_ref()
                .expect("latest build with missing pipeline");
            assert_eq!(latest.pipeline_id, "deleted-pipeline");
            assert_eq!(latest.pipeline_name, None);
        }
    }

    #[tokio::test]
    async fn developer_receives_only_member_projects_with_latest_builds() {
        let pool = test_pool().await;
        insert_project(&pool, "visible", "Visible", None, 10).await;
        insert_project(&pool, "hidden", "Hidden", None, 20).await;
        sqlx::query(
            "INSERT INTO project_members (project_id, user_id, role) VALUES ('visible', 'developer', 'developer')",
        )
        .execute(&pool)
        .await
        .expect("insert project membership");
        insert_build(
            &pool,
            "visible-build",
            "visible",
            "missing-pipeline",
            1,
            "queued",
            30,
            None,
        )
        .await;

        let response = fetch_projects_page(
            &pool,
            &auth("developer", "developer"),
            &ListProjectsQuery::default(),
        )
        .await
        .expect("list member projects");

        assert_eq!(response.total, 1);
        assert_eq!(response.projects.len(), 1);
        assert_eq!(response.projects[0].project.id, "visible");
        assert_eq!(
            response.projects[0].project.current_user_role,
            ProjectRole::Developer
        );
        assert_eq!(
            response.projects[0]
                .latest_build
                .as_ref()
                .map(|build| build.id.as_str()),
            Some("visible-build")
        );
    }

    #[tokio::test]
    async fn project_filters_sort_and_pagination_keep_their_existing_scope() {
        let pool = test_pool().await;
        sqlx::query("INSERT INTO integrations (id, provider) VALUES ('github', 'github'), ('gitlab', 'gitlab')")
            .execute(&pool)
            .await
            .expect("insert integrations");
        sqlx::query("INSERT INTO integration_installations (id, integration_id) VALUES ('github-install', 'github'), ('gitlab-install', 'gitlab')")
            .execute(&pool)
            .await
            .expect("insert installations");
        sqlx::query("INSERT INTO integration_repositories (id, installation_id, full_name, avatar_url) VALUES ('repo-a', 'github-install', 'oore/alpha', NULL), ('repo-b', 'github-install', 'oore/beta', NULL), ('repo-c', 'gitlab-install', 'oore/gamma', NULL)")
            .execute(&pool)
            .await
            .expect("insert repositories");
        insert_project(&pool, "alpha", "Alpha", Some("repo-a"), 10).await;
        insert_project(&pool, "beta", "Beta", Some("repo-b"), 20).await;
        insert_project(&pool, "gamma", "Gamma", Some("repo-c"), 30).await;

        let response = fetch_projects_page(
            &pool,
            &auth("owner", "owner"),
            &ListProjectsQuery {
                limit: Some(1),
                offset: Some(1),
                search: Some("a".to_string()),
                integration_id: Some("github".to_string()),
                sort: Some("name".to_string()),
                direction: Some("asc".to_string()),
            },
        )
        .await
        .expect("list filtered projects");

        assert_eq!(response.total, 2);
        assert_eq!(response.projects.len(), 1);
        assert_eq!(response.projects[0].project.id, "beta");
    }
}
