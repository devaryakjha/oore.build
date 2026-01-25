//! OAuth callback HTML pages.

use axum::{
    extract::{Query, State},
    http::{header, HeaderValue},
    response::{Html, IntoResponse, Response},
};
use serde::Deserialize;

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

/// Generates error page HTML.
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
            max-width: 500px;
            text-align: center;
        }}
        h1 {{
            color: #ff6b6b;
            margin-bottom: 1rem;
        }}
        p {{
            color: #aaa;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{}</h1>
        <p>{}</p>
    </div>
</body>
</html>"#,
        title, message
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

/// Generates GitHub manifest creation page HTML.
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
            max-width: 500px;
            text-align: center;
        }}
        h1 {{
            color: #4ecdc4;
            margin-bottom: 1rem;
        }}
        p {{
            color: #aaa;
            line-height: 1.6;
        }}
        .spinner {{
            width: 40px;
            height: 40px;
            border: 3px solid #333;
            border-top-color: #4ecdc4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 2rem auto;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
        noscript {{
            display: block;
            background: #ff6b6b;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }}
    </style>
</head>
<body>
    <div class="container">
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

/// GET /setup/github/callback - Displays "Copy this URL to CLI" page.
pub async fn github_callback_handler(
    State(state): State<AppState>,
    axum::extract::OriginalUri(uri): axum::extract::OriginalUri,
    Query(params): Query<GitHubCallbackQuery>,
) -> Response {
    // Check for error
    if let Some(error) = params.error {
        let message = params
            .error_description
            .unwrap_or_else(|| error.clone());
        let html = error_page("GitHub Error", &message);
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

    let html = callback_page("GitHub", &full_url);
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
