//! API integration tests for oore-server.
//!
//! These tests verify the core API endpoints work correctly with an in-memory database.

use axum_test::TestServer;
use oore_server::test_utils::{create_test_app_with_state, TEST_ADMIN_TOKEN};
use serde_json::{json, Value};

/// Helper to create a test server.
async fn create_server() -> TestServer {
    let (app, _config) = create_test_app_with_state().await;
    TestServer::new(app).expect("Failed to create test server")
}

// =============================================================================
// Health & Version Tests
// =============================================================================

mod health {
    use super::*;

    #[tokio::test]
    async fn health_check_returns_ok() {
        let server = create_server().await;

        let response = server.get("/api/health").await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert_eq!(body["status"], "ok");
    }

    #[tokio::test]
    async fn version_returns_server_info() {
        let server = create_server().await;

        let response = server.get("/api/version").await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert_eq!(body["name"], "oored");
        assert!(body["version"].is_string());
    }
}

// =============================================================================
// Repository Tests
// =============================================================================

mod repositories {
    use super::*;

    #[tokio::test]
    async fn list_repositories_empty() {
        let server = create_server().await;

        let response = server.get("/api/repositories").await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert!(body.is_array());
        assert_eq!(body.as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn create_repository_success() {
        let server = create_server().await;

        let payload = json!({
            "provider": "github",
            "owner": "test-owner",
            "repo_name": "test-repo",
            "default_branch": "main"
        });

        let response = server
            .post("/api/repositories")
            .json(&payload)
            .await;

        response.assert_status(axum::http::StatusCode::CREATED);
        let body: Value = response.json();
        assert_eq!(body["provider"], "github");
        assert_eq!(body["owner"], "test-owner");
        assert_eq!(body["repo_name"], "test-repo");
        assert!(body["id"].is_string());
    }

    #[tokio::test]
    async fn create_repository_missing_fields() {
        let server = create_server().await;

        let payload = json!({
            "provider": "github"
            // Missing required fields
        });

        let response = server
            .post("/api/repositories")
            .json(&payload)
            .await;

        response.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn get_repository_not_found() {
        let server = create_server().await;

        // Invalid ULID returns 400, valid but non-existent returns 404
        let response = server.get("/api/repositories/01HXYZ123456789ABCDEFGHIJK").await;
        response.assert_status(axum::http::StatusCode::BAD_REQUEST);

        // Use a valid ULID format that doesn't exist
        let response = server.get("/api/repositories/01HQ9RHHSFA5HRGFH1A7X0Y1FJ").await;
        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn create_and_get_repository() {
        let server = create_server().await;

        // Create
        let payload = json!({
            "provider": "github",
            "owner": "myorg",
            "repo_name": "myrepo",
            "default_branch": "main"
        });

        let create_response = server
            .post("/api/repositories")
            .json(&payload)
            .await;

        create_response.assert_status(axum::http::StatusCode::CREATED);
        let created: Value = create_response.json();
        let repo_id = created["id"].as_str().unwrap();

        // Get
        let get_response = server
            .get(&format!("/api/repositories/{}", repo_id))
            .await;

        get_response.assert_status_ok();
        let fetched: Value = get_response.json();
        assert_eq!(fetched["id"], repo_id);
        assert_eq!(fetched["owner"], "myorg");
    }

    #[tokio::test]
    async fn delete_repository() {
        let server = create_server().await;

        // Create
        let payload = json!({
            "provider": "gitlab",
            "owner": "company",
            "repo_name": "app",
            "default_branch": "develop"
        });

        let create_response = server
            .post("/api/repositories")
            .json(&payload)
            .await;

        let created: Value = create_response.json();
        let repo_id = created["id"].as_str().unwrap();

        // Delete
        let delete_response = server
            .delete(&format!("/api/repositories/{}", repo_id))
            .await;

        delete_response.assert_status(axum::http::StatusCode::NO_CONTENT);

        // Verify deleted
        let get_response = server
            .get(&format!("/api/repositories/{}", repo_id))
            .await;

        get_response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn list_repositories_after_create() {
        let server = create_server().await;

        // Create two repos
        let payload1 = json!({
            "provider": "github",
            "owner": "org1",
            "repo_name": "repo1"
        });
        server.post("/api/repositories").json(&payload1).await;

        let payload2 = json!({
            "provider": "gitlab",
            "owner": "org2",
            "repo_name": "repo2"
        });
        server.post("/api/repositories").json(&payload2).await;

        // List
        let response = server.get("/api/repositories").await;
        let body: Value = response.json();

        assert_eq!(body.as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn get_webhook_url() {
        let server = create_server().await;

        // Create repo
        let payload = json!({
            "provider": "github",
            "owner": "test",
            "repo_name": "webhooks"
        });
        let create_response = server.post("/api/repositories").json(&payload).await;
        let created: Value = create_response.json();
        let repo_id = created["id"].as_str().unwrap();

        // Get webhook URL
        let response = server
            .get(&format!("/api/repositories/{}/webhook-url", repo_id))
            .await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert!(body["webhook_url"].is_string());
        assert_eq!(body["provider"], "github");
    }
}

// =============================================================================
// Build Tests
// =============================================================================

mod builds {
    use super::*;

    #[tokio::test]
    async fn list_builds_empty() {
        let server = create_server().await;

        let response = server.get("/api/builds").await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert!(body.is_array());
        assert_eq!(body.as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn get_build_not_found() {
        let server = create_server().await;

        // Use a valid ULID format that doesn't exist
        let response = server.get("/api/builds/01HQ9RHHSFA5HRGFH1A7X0Y1FJ").await;
        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn trigger_build_repo_not_found() {
        let server = create_server().await;

        let payload = json!({
            "branch": "main"
        });

        // Use a valid ULID format that doesn't exist
        let response = server
            .post("/api/repositories/01HQ9RHHSFA5HRGFH1A7X0Y1FJ/trigger")
            .json(&payload)
            .await;

        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }
}

// =============================================================================
// Pipeline Tests
// =============================================================================

mod pipelines {
    use super::*;

    #[tokio::test]
    async fn validate_pipeline_valid_yaml() {
        let server = create_server().await;

        // Scripts must be objects with name and script fields
        let payload = json!({
            "config_content": r#"
workflows:
  build:
    name: Build
    scripts:
      - name: Say Hello
        script: echo "Hello"
"#,
            "config_format": "yaml"
        });

        let response = server
            .post("/api/pipelines/validate")
            .json(&payload)
            .await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert_eq!(body["valid"], true);
    }

    #[tokio::test]
    async fn validate_pipeline_invalid_yaml() {
        let server = create_server().await;

        let payload = json!({
            "config_content": "not: [valid: yaml",
            "config_format": "yaml"
        });

        let response = server
            .post("/api/pipelines/validate")
            .json(&payload)
            .await;

        // Invalid YAML returns 400 with error message
        response.assert_status(axum::http::StatusCode::BAD_REQUEST);
        let body: Value = response.json();
        assert_eq!(body["valid"], false);
        assert!(body["error"].is_string());
    }

    #[tokio::test]
    async fn get_pipeline_config_not_found() {
        let server = create_server().await;

        // Create repo first
        let payload = json!({
            "provider": "github",
            "owner": "test",
            "repo_name": "pipeline-test"
        });
        let create_response = server.post("/api/repositories").json(&payload).await;
        let created: Value = create_response.json();
        let repo_id = created["id"].as_str().unwrap();

        // Get pipeline (should be not found)
        let response = server
            .get(&format!("/api/repositories/{}/pipeline", repo_id))
            .await;

        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn set_and_get_pipeline_config() {
        let server = create_server().await;

        // Create repo
        let repo_payload = json!({
            "provider": "github",
            "owner": "test",
            "repo_name": "pipeline-crud"
        });
        let create_response = server.post("/api/repositories").json(&repo_payload).await;
        let created: Value = create_response.json();
        let repo_id = created["id"].as_str().unwrap();

        // Set pipeline - scripts must be objects
        let pipeline_content = r#"
workflows:
  test:
    name: Test
    scripts:
      - name: Run Tests
        script: flutter test
"#;
        let set_payload = json!({
            "config_content": pipeline_content,
            "config_format": "yaml"
        });

        let set_response = server
            .put(&format!("/api/repositories/{}/pipeline", repo_id))
            .json(&set_payload)
            .await;

        set_response.assert_status_ok();

        // Get pipeline
        let get_response = server
            .get(&format!("/api/repositories/{}/pipeline", repo_id))
            .await;

        get_response.assert_status_ok();
        let body: Value = get_response.json();
        assert_eq!(body["config_format"], "yaml");
        assert!(body["config_content"].as_str().unwrap().contains("flutter test"));
    }
}

// =============================================================================
// Admin Authentication Tests
// =============================================================================

mod admin_auth {
    use super::*;

    #[tokio::test]
    async fn setup_status_requires_auth() {
        let server = create_server().await;

        let response = server.get("/api/setup/status").await;

        response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn setup_status_with_invalid_token() {
        let server = create_server().await;

        let response = server
            .get("/api/setup/status")
            .add_header("Authorization", "Bearer wrong-token")
            .await;

        response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn setup_status_with_valid_token() {
        let server = create_server().await;

        let response = server
            .get("/api/setup/status")
            .add_header("Authorization", format!("Bearer {}", TEST_ADMIN_TOKEN))
            .await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert!(body["github"].is_object());
        assert!(body["gitlab"].is_array());
    }

    #[tokio::test]
    async fn github_app_not_configured() {
        let server = create_server().await;

        let response = server
            .get("/api/github/app")
            .add_header("Authorization", format!("Bearer {}", TEST_ADMIN_TOKEN))
            .await;

        // Returns 200 with configured: false when not set up
        response.assert_status_ok();
        let body: Value = response.json();
        assert_eq!(body["configured"], false);
    }

    #[tokio::test]
    async fn gitlab_credentials_empty() {
        let server = create_server().await;

        let response = server
            .get("/api/gitlab/credentials")
            .add_header("Authorization", format!("Bearer {}", TEST_ADMIN_TOKEN))
            .await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert!(body.is_array());
        assert_eq!(body.as_array().unwrap().len(), 0);
    }
}

// =============================================================================
// Webhook Tests
// =============================================================================

mod webhooks {
    use super::*;

    #[tokio::test]
    async fn list_webhook_events_empty() {
        let server = create_server().await;

        let response = server.get("/api/webhooks/events").await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert!(body.is_array());
    }

    #[tokio::test]
    async fn get_webhook_event_not_found() {
        let server = create_server().await;

        // Use a valid ULID format that doesn't exist
        let response = server.get("/api/webhooks/events/01HQ9RHHSFA5HRGFH1A7X0Y1FJ").await;
        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }
}
