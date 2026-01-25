//! Webhook payload parsing for GitHub and GitLab.

use serde::Deserialize;

use crate::error::{OoreError, Result};
use crate::models::{ParsedWebhookEvent, WebhookEventType};

/// Parses a GitHub webhook payload.
pub fn parse_github_webhook(event_type: &str, payload: &[u8]) -> Result<ParsedWebhookEvent> {
    match event_type {
        "push" => parse_github_push(payload),
        "pull_request" => parse_github_pull_request(payload),
        _ => Err(OoreError::InvalidWebhookPayload(format!(
            "Unsupported GitHub event type: {}",
            event_type
        ))),
    }
}

/// Parses a GitLab webhook payload.
pub fn parse_gitlab_webhook(event_type: &str, payload: &[u8]) -> Result<ParsedWebhookEvent> {
    match event_type {
        "Push Hook" => parse_gitlab_push(payload),
        "Merge Request Hook" => parse_gitlab_merge_request(payload),
        _ => Err(OoreError::InvalidWebhookPayload(format!(
            "Unsupported GitLab event type: {}",
            event_type
        ))),
    }
}

// GitHub payload structures

#[derive(Deserialize)]
struct GitHubPushPayload {
    #[serde(rename = "ref")]
    ref_name: String,
    after: String,
    repository: GitHubRepository,
    installation: Option<GitHubInstallation>,
}

#[derive(Deserialize)]
struct GitHubPullRequestPayload {
    action: String,
    number: i64,
    pull_request: GitHubPullRequest,
    repository: GitHubRepository,
    installation: Option<GitHubInstallation>,
}

#[derive(Deserialize)]
struct GitHubPullRequest {
    head: GitHubHead,
}

#[derive(Deserialize)]
struct GitHubHead {
    sha: String,
    #[serde(rename = "ref")]
    ref_name: String,
}

#[derive(Deserialize)]
struct GitHubRepository {
    id: i64,
    full_name: String,
}

#[derive(Deserialize)]
struct GitHubInstallation {
    id: i64,
}

fn parse_github_push(payload: &[u8]) -> Result<ParsedWebhookEvent> {
    let data: GitHubPushPayload = serde_json::from_slice(payload)?;

    // Extract owner and repo from full_name (e.g., "owner/repo")
    let (owner, repo_name) = parse_full_name(&data.repository.full_name)?;

    // Extract branch from ref (e.g., "refs/heads/main" -> "main")
    let branch = data
        .ref_name
        .strip_prefix("refs/heads/")
        .unwrap_or(&data.ref_name)
        .to_string();

    Ok(ParsedWebhookEvent {
        event_type: WebhookEventType::Push,
        repository_owner: owner,
        repository_name: repo_name,
        commit_sha: data.after,
        branch,
        github_repository_id: Some(data.repository.id),
        github_installation_id: data.installation.map(|i| i.id),
        gitlab_project_id: None,
        pull_request_number: None,
        action: None,
    })
}

fn parse_github_pull_request(payload: &[u8]) -> Result<ParsedWebhookEvent> {
    let data: GitHubPullRequestPayload = serde_json::from_slice(payload)?;

    let (owner, repo_name) = parse_full_name(&data.repository.full_name)?;

    Ok(ParsedWebhookEvent {
        event_type: WebhookEventType::PullRequest,
        repository_owner: owner,
        repository_name: repo_name,
        commit_sha: data.pull_request.head.sha,
        branch: data.pull_request.head.ref_name,
        github_repository_id: Some(data.repository.id),
        github_installation_id: data.installation.map(|i| i.id),
        gitlab_project_id: None,
        pull_request_number: Some(data.number),
        action: Some(data.action),
    })
}

// GitLab payload structures

#[derive(Deserialize)]
struct GitLabPushPayload {
    #[serde(rename = "ref")]
    ref_name: String,
    after: String,
    project: GitLabProject,
}

#[derive(Deserialize)]
struct GitLabMergeRequestPayload {
    #[allow(dead_code)]
    object_kind: String,
    object_attributes: GitLabMergeRequestAttributes,
    project: GitLabProject,
}

#[derive(Deserialize)]
struct GitLabMergeRequestAttributes {
    iid: i64,
    action: Option<String>,
    last_commit: GitLabCommit,
    source_branch: String,
}

#[derive(Deserialize)]
struct GitLabCommit {
    id: String,
}

#[derive(Deserialize)]
struct GitLabProject {
    id: i64,
    path_with_namespace: String,
}

fn parse_gitlab_push(payload: &[u8]) -> Result<ParsedWebhookEvent> {
    let data: GitLabPushPayload = serde_json::from_slice(payload)?;

    let (owner, repo_name) = parse_full_name(&data.project.path_with_namespace)?;

    // Extract branch from ref (e.g., "refs/heads/main" -> "main")
    let branch = data
        .ref_name
        .strip_prefix("refs/heads/")
        .unwrap_or(&data.ref_name)
        .to_string();

    Ok(ParsedWebhookEvent {
        event_type: WebhookEventType::Push,
        repository_owner: owner,
        repository_name: repo_name,
        commit_sha: data.after,
        branch,
        github_repository_id: None,
        github_installation_id: None,
        gitlab_project_id: Some(data.project.id),
        pull_request_number: None,
        action: None,
    })
}

fn parse_gitlab_merge_request(payload: &[u8]) -> Result<ParsedWebhookEvent> {
    let data: GitLabMergeRequestPayload = serde_json::from_slice(payload)?;

    let (owner, repo_name) = parse_full_name(&data.project.path_with_namespace)?;

    Ok(ParsedWebhookEvent {
        event_type: WebhookEventType::MergeRequest,
        repository_owner: owner,
        repository_name: repo_name,
        commit_sha: data.object_attributes.last_commit.id,
        branch: data.object_attributes.source_branch,
        github_repository_id: None,
        github_installation_id: None,
        gitlab_project_id: Some(data.project.id),
        pull_request_number: Some(data.object_attributes.iid),
        action: data.object_attributes.action,
    })
}

/// Parses "owner/repo" format into (owner, repo).
fn parse_full_name(full_name: &str) -> Result<(String, String)> {
    let parts: Vec<&str> = full_name.splitn(2, '/').collect();
    if parts.len() != 2 {
        return Err(OoreError::InvalidWebhookPayload(format!(
            "Invalid repository full name: {}",
            full_name
        )));
    }
    Ok((parts[0].to_string(), parts[1].to_string()))
}

/// Extracts minimal repository identification from a GitHub payload.
///
/// Returns (github_repository_id, owner, repo_name, installation_id).
pub fn extract_github_repo_info(
    payload: &[u8],
) -> Result<(i64, String, String, Option<i64>)> {
    #[derive(Deserialize)]
    struct MinimalPayload {
        repository: GitHubRepository,
        installation: Option<GitHubInstallation>,
    }

    let data: MinimalPayload = serde_json::from_slice(payload)?;
    let (owner, repo_name) = parse_full_name(&data.repository.full_name)?;

    Ok((
        data.repository.id,
        owner,
        repo_name,
        data.installation.map(|i| i.id),
    ))
}

/// Extracts minimal repository identification from a GitLab payload.
///
/// Returns (gitlab_project_id, owner, repo_name).
pub fn extract_gitlab_repo_info(payload: &[u8]) -> Result<(i64, String, String)> {
    #[derive(Deserialize)]
    struct MinimalPayload {
        project: GitLabProject,
    }

    let data: MinimalPayload = serde_json::from_slice(payload)?;
    let (owner, repo_name) = parse_full_name(&data.project.path_with_namespace)?;

    Ok((data.project.id, owner, repo_name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_push() {
        let payload = r#"{
            "ref": "refs/heads/main",
            "after": "abc123",
            "repository": {
                "id": 12345,
                "full_name": "owner/repo"
            },
            "installation": {
                "id": 67890
            }
        }"#;

        let event = parse_github_webhook("push", payload.as_bytes()).unwrap();
        assert_eq!(event.event_type, WebhookEventType::Push);
        assert_eq!(event.repository_owner, "owner");
        assert_eq!(event.repository_name, "repo");
        assert_eq!(event.commit_sha, "abc123");
        assert_eq!(event.branch, "main");
        assert_eq!(event.github_repository_id, Some(12345));
        assert_eq!(event.github_installation_id, Some(67890));
    }

    #[test]
    fn test_parse_github_pull_request() {
        let payload = r#"{
            "action": "opened",
            "number": 42,
            "pull_request": {
                "head": {
                    "sha": "def456",
                    "ref": "feature-branch"
                }
            },
            "repository": {
                "id": 12345,
                "full_name": "owner/repo"
            }
        }"#;

        let event = parse_github_webhook("pull_request", payload.as_bytes()).unwrap();
        assert_eq!(event.event_type, WebhookEventType::PullRequest);
        assert_eq!(event.commit_sha, "def456");
        assert_eq!(event.branch, "feature-branch");
        assert_eq!(event.pull_request_number, Some(42));
        assert_eq!(event.action, Some("opened".to_string()));
    }

    #[test]
    fn test_parse_gitlab_push() {
        let payload = r#"{
            "ref": "refs/heads/main",
            "after": "abc123",
            "project": {
                "id": 12345,
                "path_with_namespace": "group/project"
            }
        }"#;

        let event = parse_gitlab_webhook("Push Hook", payload.as_bytes()).unwrap();
        assert_eq!(event.event_type, WebhookEventType::Push);
        assert_eq!(event.repository_owner, "group");
        assert_eq!(event.repository_name, "project");
        assert_eq!(event.gitlab_project_id, Some(12345));
    }

    #[test]
    fn test_parse_gitlab_merge_request() {
        let payload = r#"{
            "object_kind": "merge_request",
            "object_attributes": {
                "iid": 42,
                "action": "open",
                "last_commit": {
                    "id": "def456"
                },
                "source_branch": "feature-branch"
            },
            "project": {
                "id": 12345,
                "path_with_namespace": "group/project"
            }
        }"#;

        let event = parse_gitlab_webhook("Merge Request Hook", payload.as_bytes()).unwrap();
        assert_eq!(event.event_type, WebhookEventType::MergeRequest);
        assert_eq!(event.commit_sha, "def456");
        assert_eq!(event.branch, "feature-branch");
        assert_eq!(event.pull_request_number, Some(42));
    }
}
