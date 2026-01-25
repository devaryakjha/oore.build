//! OAuth callback HTML pages.

use axum::{
    extract::{Query, State},
    http::{header, HeaderValue},
    response::{Html, IntoResponse, Response},
};
use serde::Deserialize;

use oore_core::db::credentials::{GitHubAppCredentialsRepo, OAuthStateRepo};
use oore_core::oauth::github::GitHubClient;

use crate::state::AppState;

/// Query parameters for GitHub callback.
#[derive(Debug, Deserialize)]
pub struct GitHubCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Query parameters for GitLab callback.
#[derive(Debug, Deserialize)]
pub struct GitLabCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Security headers for OAuth callback pages.
fn security_headers(allow_scripts: bool) -> [(header::HeaderName, HeaderValue); 4] {
    let csp = if allow_scripts {
        // Allow inline scripts for the auto-submit form page
        HeaderValue::from_static("default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action https://github.com")
    } else {
        HeaderValue::from_static("default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'")
    };

    [
        (
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store, no-cache, must-revalidate"),
        ),
        (header::PRAGMA, HeaderValue::from_static("no-cache")),
        (
            header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ),
        (header::CONTENT_SECURITY_POLICY, csp),
    ]
}

/// Generates error page HTML with brand styling.
fn error_page(title: &str, message: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - Oore CI</title>
    <style>
        body {{
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: oklch(0.145 0 0);
            color: oklch(0.985 0 0);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }}
        .card {{
            max-width: 500px;
            background: oklch(0.205 0 0 / 0.5);
            backdrop-filter: blur(8px);
            border: 1px solid oklch(1 0 0 / 10%);
            border-radius: 0.75rem;
            padding: 2rem;
            text-align: center;
        }}
        .icon {{
            font-size: 3rem;
            margin-bottom: 1rem;
        }}
        h1 {{
            color: oklch(0.65 0.2 25);
            margin: 0 0 1rem 0;
            font-size: 1.5rem;
        }}
        p {{
            color: oklch(0.7 0 0);
            line-height: 1.6;
            margin: 0;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">&#10060;</div>
        <h1>{}</h1>
        <p>{}</p>
    </div>
</body>
</html>"#,
        html_escape(title),
        html_escape(message)
    )
}

/// Generates success page HTML with brand styling and auto-redirect to installation.
fn success_page(app_name: &str, app_slug: &str) -> String {
    let install_url = format!("https://github.com/apps/{}/installations/new", app_slug);
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Success - Oore CI</title>
    <style>
        body {{
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: oklch(0.145 0 0);
            color: oklch(0.985 0 0);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }}
        .card {{
            max-width: 500px;
            background: oklch(0.205 0 0 / 0.5);
            backdrop-filter: blur(8px);
            border: 1px solid oklch(1 0 0 / 10%);
            border-radius: 0.75rem;
            padding: 2rem;
            text-align: center;
        }}
        .icon {{
            font-size: 3rem;
            margin-bottom: 1rem;
        }}
        h1 {{
            color: oklch(0.77 0.16 70);
            margin: 0 0 1rem 0;
            font-size: 1.5rem;
        }}
        .app-name {{
            color: oklch(0.77 0.16 70);
            font-weight: 600;
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
        }}
        p {{
            color: oklch(0.7 0 0);
            line-height: 1.6;
            margin: 0;
        }}
        .spinner {{
            width: 24px;
            height: 24px;
            border: 3px solid oklch(0.3 0 0);
            border-top-color: oklch(0.77 0.16 70);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 1rem auto 0;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">&#9989;</div>
        <h1>GitHub App Created Successfully</h1>
        <div class="app-name">{}</div>
        <p>Redirecting to install the app...</p>
        <div class="spinner"></div>
    </div>
    <script>
        setTimeout(function() {{
            window.location.href = "{}";
        }}, 1500);
    </script>
</body>
</html>"#,
        html_escape(app_name),
        html_escape(&install_url)
    )
}

/// Generates callback success page HTML.
fn callback_page(provider: &str, full_url: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{} Setup - Oore CI</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }}
        .container {{
            max-width: 600px;
            text-align: center;
        }}
        h1 {{
            color: #4ecdc4;
            margin-bottom: 1rem;
        }}
        .instructions {{
            background: #16213e;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1.5rem 0;
            text-align: left;
        }}
        .step {{
            margin: 1rem 0;
            padding-left: 1.5rem;
            position: relative;
        }}
        .step::before {{
            content: attr(data-step);
            position: absolute;
            left: 0;
            color: #4ecdc4;
            font-weight: bold;
        }}
        .url-box {{
            background: #0f0f23;
            border: 1px solid #333;
            border-radius: 4px;
            padding: 0.75rem 1rem;
            font-family: monospace;
            font-size: 0.85rem;
            word-break: break-all;
            margin: 1rem 0;
            position: relative;
        }}
        .copy-btn {{
            background: #4ecdc4;
            color: #1a1a2e;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            font-weight: bold;
            margin-top: 0.5rem;
        }}
        .copy-btn:hover {{
            background: #3dbdb5;
        }}
        .warning {{
            color: #ff6b6b;
            font-size: 0.9rem;
            margin-top: 1rem;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{} Setup</h1>
        <div class="instructions">
            <div class="step" data-step="1.">Copy the URL below</div>
            <div class="step" data-step="2.">Return to your terminal</div>
            <div class="step" data-step="3.">Run: <code>oore {} callback "&lt;URL&gt;"</code></div>
        </div>

        <div class="url-box" id="callbackUrl">{}</div>
        <button class="copy-btn" onclick="copyUrl()">Copy URL</button>

        <p class="warning">Do not share this URL. It contains authentication codes.</p>
    </div>

    <script>
        function copyUrl() {{
            const url = document.getElementById('callbackUrl').textContent;
            navigator.clipboard.writeText(url).then(() => {{
                const btn = document.querySelector('.copy-btn');
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy URL', 2000);
            }});
        }}
    </script>
</body>
</html>"#,
        provider,
        provider,
        provider.to_lowercase(),
        full_url
    )
}

/// Generates GitHub manifest creation page HTML with brand styling.
fn github_create_page(manifest_json: &str, state: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create GitHub App - Oore CI</title>
    <style>
        body {{
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: oklch(0.145 0 0);
            color: oklch(0.985 0 0);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }}
        .card {{
            max-width: 500px;
            background: oklch(0.205 0 0 / 0.5);
            backdrop-filter: blur(8px);
            border: 1px solid oklch(1 0 0 / 10%);
            border-radius: 0.75rem;
            padding: 2rem;
            text-align: center;
        }}
        h1 {{
            color: oklch(0.77 0.16 70);
            margin: 0 0 1.5rem 0;
            font-size: 1.5rem;
        }}
        p {{
            color: oklch(0.7 0 0);
            line-height: 1.6;
            margin: 0;
        }}
        .spinner {{
            width: 48px;
            height: 48px;
            border: 3px solid oklch(0.3 0 0);
            border-top-color: oklch(0.77 0.16 70);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 1.5rem auto;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
        noscript {{
            display: block;
            background: oklch(0.65 0.2 25);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
        }}
    </style>
</head>
<body>
    <div class="card">
        <h1>Creating GitHub App</h1>
        <div class="spinner"></div>
        <p>Redirecting to GitHub...</p>

        <noscript>
            JavaScript is required. Please enable it and refresh the page.
        </noscript>
    </div>

    <form id="manifestForm" action="https://github.com/settings/apps/new?state={}" method="post" style="display: none;">
        <input type="hidden" name="manifest" value="{}">
    </form>

    <script>
        document.getElementById('manifestForm').submit();
    </script>
</body>
</html>"#,
        state,
        html_escape(manifest_json)
    )
}

/// HTML escape helper.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// GET /setup/github/create - HTML page that auto-POSTs manifest to GitHub.
pub async fn github_create_page_handler(
    State(state): State<AppState>,
    Query(params): Query<GitHubCallbackQuery>,
) -> Response {
    let state_param = match params.state {
        Some(s) => s,
        None => {
            let html = error_page("Missing State", "No state parameter provided. Start the setup from 'oore github setup'.");
            let mut response = Html(html).into_response();
            for (name, value) in security_headers(false) {
                response.headers_mut().insert(name, value);
            }
            return response;
        }
    };

    // Build manifest
    let manifest = oore_core::oauth::github::GitHubAppManifest::new(
        &state.config.base_url_parsed,
        None,
    );

    let manifest_json = match serde_json::to_string(&manifest) {
        Ok(j) => j,
        Err(e) => {
            tracing::error!("Failed to serialize manifest: {}", e);
            let html = error_page("Internal Error", "Failed to generate manifest.");
            let mut response = Html(html).into_response();
            for (name, value) in security_headers(false) {
                response.headers_mut().insert(name, value);
            }
            return response;
        }
    };

    let html = github_create_page(&manifest_json, &state_param);
    let mut response = Html(html).into_response();
    // Allow scripts for the auto-submit form
    for (name, value) in security_headers(true) {
        response.headers_mut().insert(name, value);
    }
    response
}

/// GET /setup/github/callback - Auto-exchanges code for credentials and shows success/error.
pub async fn github_callback_handler(
    State(app_state): State<AppState>,
    Query(params): Query<GitHubCallbackQuery>,
) -> Response {
    tracing::info!("GitHub callback received: code={:?}, state={:?}, error={:?}",
        params.code.as_ref().map(|_| "[REDACTED]"),
        params.state,
        params.error
    );

    // Helper to return error page with headers
    fn error_response(title: &str, message: &str) -> Response {
        let html = error_page(title, message);
        let mut response = Html(html).into_response();
        for (name, value) in security_headers(false) {
            response.headers_mut().insert(name, value);
        }
        response
    }

    // Check for error from GitHub
    if let Some(error) = params.error {
        let message = params
            .error_description
            .unwrap_or_else(|| error.clone());

        // Mark state as failed if we have it
        if let Some(ref state_param) = params.state {
            let _ = OAuthStateRepo::mark_failed(&app_state.db, state_param, &message).await;
        }

        return error_response("GitHub Error", &message);
    }

    // Validate required params
    let code = match params.code {
        Some(c) => c,
        None => return error_response("Missing Code", "The callback URL is missing the code parameter."),
    };
    let state_param = match params.state {
        Some(s) => s,
        None => return error_response("Missing State", "The callback URL is missing the state parameter."),
    };

    // Validate and consume OAuth state
    let oauth_state = match OAuthStateRepo::consume(&app_state.db, &state_param, "github").await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return error_response("Invalid State", "Invalid or expired state parameter. Please run 'oore github setup' again.");
        }
        Err(e) => {
            tracing::error!("Failed to validate OAuth state: {}", e);
            return error_response("Server Error", "Failed to validate state parameter.");
        }
    };

    tracing::info!("OAuth state consumed successfully for state: {}", state_param);

    // Get encryption key
    let encryption_key = match app_state.require_encryption_key() {
        Ok(key) => key.clone(),
        Err(msg) => {
            let _ = OAuthStateRepo::mark_failed(&app_state.db, &state_param, msg).await;
            return error_response("Configuration Error", msg);
        }
    };

    // Create GitHub client
    let client = match GitHubClient::new(encryption_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create GitHub client: {}", e);
            let _ = OAuthStateRepo::mark_failed(&app_state.db, &state_param, "Failed to create GitHub client").await;
            return error_response("Server Error", "Failed to initialize GitHub client.");
        }
    };

    // Exchange code for app credentials
    let app_response = match client.exchange_manifest_code(&code).await {
        Ok(app) => app,
        Err(e) => {
            tracing::error!("Failed to exchange manifest code: {}", e);
            let error_msg = format!("Failed to exchange code: {}", e);
            let _ = OAuthStateRepo::mark_failed(&app_state.db, &state_param, &error_msg).await;
            return error_response("Exchange Failed", &error_msg);
        }
    };

    // Check for existing app with same ID (idempotency)
    if let Ok(Some(existing)) = GitHubAppCredentialsRepo::get_by_app_id(&app_state.db, app_response.id).await {
        tracing::info!(
            "GitHub App {} already exists, marking as completed",
            app_response.id
        );

        let _ = OAuthStateRepo::mark_completed(
            &app_state.db,
            &state_param,
            existing.app_id,
            &existing.app_name,
        ).await;

        let html = success_page(&existing.app_name, &existing.app_slug);
        let mut response = Html(html).into_response();
        for (name, value) in security_headers(false) {
            response.headers_mut().insert(name, value);
        }
        return response;
    }

    // Create credentials
    let credentials = match client.create_credentials(&app_response) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create credentials: {}", e);
            let _ = OAuthStateRepo::mark_failed(&app_state.db, &state_param, "Failed to encrypt credentials").await;
            return error_response("Encryption Error", "Failed to encrypt credentials.");
        }
    };

    // Deactivate any existing credentials
    if let Err(e) = GitHubAppCredentialsRepo::deactivate_all(&app_state.db).await {
        tracing::warn!("Failed to deactivate existing credentials: {}", e);
    }

    // Store credentials
    if let Err(e) = GitHubAppCredentialsRepo::create(&app_state.db, &credentials).await {
        tracing::error!("Failed to store credentials: {}", e);
        let _ = OAuthStateRepo::mark_failed(&app_state.db, &state_param, "Failed to store credentials").await;
        return error_response("Database Error", "Failed to store credentials.");
    }

    tracing::info!(
        "GitHub App {} ({}) configured successfully via callback",
        credentials.app_name,
        credentials.app_id
    );

    // Mark state as completed
    match OAuthStateRepo::mark_completed(
        &app_state.db,
        &state_param,
        credentials.app_id,
        &credentials.app_name,
    ).await {
        Ok(true) => tracing::info!("OAuth state marked as completed for app: {}", credentials.app_name),
        Ok(false) => tracing::warn!("Failed to mark OAuth state as completed (no rows updated)"),
        Err(e) => tracing::error!("Failed to mark OAuth state as completed: {}", e),
    }

    let html = success_page(&credentials.app_name, &credentials.app_slug);
    let mut response = Html(html).into_response();
    for (name, value) in security_headers(false) {
        response.headers_mut().insert(name, value);
    }
    response
}

/// GET /setup/gitlab/callback - Displays "Copy this URL to CLI" page.
pub async fn gitlab_callback_handler(
    State(state): State<AppState>,
    axum::extract::OriginalUri(uri): axum::extract::OriginalUri,
    Query(params): Query<GitLabCallbackQuery>,
) -> Response {
    // Check for error
    if let Some(error) = params.error {
        let message = params
            .error_description
            .unwrap_or_else(|| error.clone());
        let html = error_page("GitLab Error", &message);
        let mut response = Html(html).into_response();
        for (name, value) in security_headers(false) {
            response.headers_mut().insert(name, value);
        }
        return response;
    }

    // Validate required params
    if params.code.is_none() || params.state.is_none() {
        let html = error_page(
            "Missing Parameters",
            "The callback URL is missing required parameters. Please try the setup again.",
        );
        let mut response = Html(html).into_response();
        for (name, value) in security_headers(false) {
            response.headers_mut().insert(name, value);
        }
        return response;
    }

    // Reconstruct full URL for user to copy using base_url from config
    let base_url = state.config.base_url.trim_end_matches('/');
    let path = uri.to_string();
    let full_url = format!("{}{}", base_url, path);

    let html = callback_page("GitLab", &full_url);
    let mut response = Html(html).into_response();
    for (name, value) in security_headers(false) {
        response.headers_mut().insert(name, value);
    }
    response
}

/// Query parameters for GitHub installation callback.
#[derive(Debug, Deserialize)]
pub struct GitHubInstalledQuery {
    pub installation_id: Option<i64>,
    pub setup_action: Option<String>,
}

/// Generates the installation complete page HTML.
fn installed_page() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installation Complete - Oore CI</title>
    <style>
        body {
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: oklch(0.145 0 0);
            color: oklch(0.985 0 0);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }
        .card {
            max-width: 500px;
            background: oklch(0.205 0 0 / 0.5);
            backdrop-filter: blur(8px);
            border: 1px solid oklch(1 0 0 / 10%);
            border-radius: 0.75rem;
            padding: 2rem;
            text-align: center;
        }
        .icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        h1 {
            color: oklch(0.77 0.16 70);
            margin: 0 0 1rem 0;
            font-size: 1.5rem;
        }
        p {
            color: oklch(0.7 0 0);
            line-height: 1.6;
            margin: 0 0 1rem 0;
        }
        .note {
            font-size: 0.875rem;
            color: oklch(0.5 0 0);
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">&#9989;</div>
        <h1>GitHub App Installed</h1>
        <p>Your repositories are now connected to Oore CI.</p>
        <p class="note">Webhooks will sync automatically. You can close this tab.</p>
    </div>
</body>
</html>"#.to_string()
}

/// GET /setup/github/installed - Shows success page after GitHub App installation.
pub async fn github_installed_handler(
    Query(params): Query<GitHubInstalledQuery>,
) -> Response {
    tracing::info!(
        "GitHub App installed: installation_id={:?}, setup_action={:?}",
        params.installation_id,
        params.setup_action
    );

    let html = installed_page();
    let mut response = Html(html).into_response();
    for (name, value) in security_headers(false) {
        response.headers_mut().insert(name, value);
    }
    response
}
