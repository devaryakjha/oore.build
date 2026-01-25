//! Admin authentication middleware.

use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::net::IpAddr;
use std::sync::Arc;
use subtle::ConstantTimeEq;

/// Admin authentication configuration.
#[derive(Debug, Clone)]
pub struct AdminAuthConfig {
    /// Admin token (hashed for comparison).
    pub admin_token: Option<Arc<String>>,
    /// Whether to require HTTPS.
    pub require_https: bool,
    /// Whether dev mode is enabled (allows HTTP on loopback).
    pub dev_mode: bool,
    /// Trusted proxy CIDRs.
    pub trusted_proxies: Vec<ipnet::IpNet>,
}

impl AdminAuthConfig {
    /// Creates config from environment variables.
    pub fn from_env() -> Self {
        let admin_token = std::env::var("OORE_ADMIN_TOKEN").ok().map(Arc::new);
        let dev_mode = std::env::var("OORE_DEV_MODE").ok() == Some("true".to_string());
        let require_https = !dev_mode;

        let mut trusted_proxies = Vec::new();
        if let Ok(proxies) = std::env::var("OORE_TRUSTED_PROXIES") {
            for cidr in proxies.split(',') {
                let cidr = cidr.trim();
                if !cidr.is_empty() {
                    match cidr.parse::<ipnet::IpNet>() {
                        Ok(net) => trusted_proxies.push(net),
                        Err(e) => {
                            tracing::warn!("Invalid CIDR in OORE_TRUSTED_PROXIES: {} - {}", cidr, e);
                        }
                    }
                }
            }
        }

        Self {
            admin_token,
            require_https,
            dev_mode,
            trusted_proxies,
        }
    }

    /// Checks if admin token is configured.
    pub fn is_configured(&self) -> bool {
        self.admin_token.is_some()
    }

    /// Validates the provided token using constant-time comparison.
    pub fn validate_token(&self, provided: &str) -> bool {
        match &self.admin_token {
            Some(expected) => {
                let expected_bytes = expected.as_bytes();
                let provided_bytes = provided.as_bytes();

                if expected_bytes.len() != provided_bytes.len() {
                    return false;
                }

                expected_bytes.ct_eq(provided_bytes).into()
            }
            None => false,
        }
    }

    /// Checks if the request is from a trusted proxy.
    pub fn is_trusted_proxy(&self, ip: IpAddr) -> bool {
        for cidr in &self.trusted_proxies {
            if cidr.contains(&ip) {
                return true;
            }
        }
        false
    }

    /// Gets the real client IP using rightmost-untrusted algorithm.
    pub fn get_client_ip(&self, peer_ip: IpAddr, forwarded_for: Option<&str>) -> IpAddr {
        if self.trusted_proxies.is_empty() || !self.is_trusted_proxy(peer_ip) {
            return peer_ip;
        }

        // Parse X-Forwarded-For header
        let forwarded_for = match forwarded_for {
            Some(header) => header,
            None => return peer_ip,
        };

        // Walk right to left, find first untrusted IP
        let ips: Vec<&str> = forwarded_for.split(',').map(|s| s.trim()).collect();

        for ip_str in ips.iter().rev() {
            if let Ok(ip) = ip_str.parse::<IpAddr>()
                && !self.is_trusted_proxy(ip)
            {
                return ip;
            }
        }

        // All IPs in chain are trusted, return leftmost
        if let Some(first) = ips.first()
            && let Ok(ip) = first.parse::<IpAddr>()
        {
            return ip;
        }

        peer_ip
    }

    /// Checks if the request is over HTTPS.
    pub fn is_https(&self, peer_ip: IpAddr, forwarded_proto: Option<&str>) -> bool {
        // If peer is trusted proxy, check X-Forwarded-Proto
        if self.is_trusted_proxy(peer_ip)
            && let Some(proto) = forwarded_proto
        {
            return proto.eq_ignore_ascii_case("https");
        }

        // For direct connections, we assume HTTP unless TLS is configured
        // (TLS termination would set a flag on the request)
        false
    }

    /// Checks if loopback bypass is allowed.
    pub fn is_loopback_bypass_allowed(&self, ip: IpAddr) -> bool {
        self.dev_mode && ip.is_loopback()
    }
}

/// Layer for admin authentication.
#[derive(Clone)]
#[allow(dead_code)]
pub struct AdminAuthLayer {
    config: Arc<AdminAuthConfig>,
}

#[allow(dead_code)]
impl AdminAuthLayer {
    pub fn new(config: AdminAuthConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }
}

impl<S> tower::Layer<S> for AdminAuthLayer {
    type Service = AdminAuth<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AdminAuth {
            inner,
            config: self.config.clone(),
        }
    }
}

/// Admin authentication middleware service.
#[derive(Clone)]
#[allow(dead_code)]
pub struct AdminAuth<S> {
    inner: S,
    config: Arc<AdminAuthConfig>,
}

impl<S> tower::Service<Request<Body>> for AdminAuth<S>
where
    S: tower::Service<Request<Body>, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>,
    >;

    fn poll_ready(
        &mut self,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let config = self.config.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            // Get peer IP from connection info
            let peer_ip = req
                .extensions()
                .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
                .map(|ci| ci.0.ip())
                .unwrap_or_else(|| "127.0.0.1".parse().unwrap());

            // Get forwarded headers
            let forwarded_for = req
                .headers()
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok());
            let forwarded_proto = req
                .headers()
                .get("x-forwarded-proto")
                .and_then(|v| v.to_str().ok());

            // Reject X-Forwarded-* from untrusted peers
            if !config.is_trusted_proxy(peer_ip)
                && (forwarded_for.is_some() || forwarded_proto.is_some())
            {
                return Ok(error_response(
                    StatusCode::BAD_REQUEST,
                    "UNTRUSTED_HEADERS",
                    "X-Forwarded-* headers from untrusted source",
                ));
            }

            // Check HTTPS requirement
            let client_ip = config.get_client_ip(peer_ip, forwarded_for);
            let is_https = config.is_https(peer_ip, forwarded_proto);

            if config.require_https && !is_https {
                // Allow loopback bypass in dev mode
                if !config.is_loopback_bypass_allowed(client_ip) {
                    return Ok(error_response(
                        StatusCode::BAD_REQUEST,
                        "HTTPS_REQUIRED",
                        "HTTPS is required for admin endpoints",
                    ));
                }
            }

            // Check admin token is configured
            if !config.is_configured() {
                return Ok(error_response(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "SETUP_DISABLED",
                    "Admin token not configured. Set OORE_ADMIN_TOKEN.",
                ));
            }

            // Validate Authorization header
            let auth_header = req.headers().get(header::AUTHORIZATION);

            let token = match auth_header {
                Some(header) => {
                    let header_str = match header.to_str() {
                        Ok(s) => s,
                        Err(_) => {
                            return Ok(error_response(
                                StatusCode::BAD_REQUEST,
                                "INVALID_HEADER",
                                "Invalid Authorization header encoding",
                            ));
                        }
                    };

                    if !header_str.starts_with("Bearer ") {
                        return Ok(error_response(
                            StatusCode::UNAUTHORIZED,
                            "INVALID_AUTH_TYPE",
                            "Expected 'Bearer' authentication",
                        ));
                    }

                    &header_str[7..]
                }
                None => {
                    return Ok(error_response(
                        StatusCode::UNAUTHORIZED,
                        "MISSING_AUTH",
                        "Authorization header required",
                    ));
                }
            };

            // Validate token
            if !config.validate_token(token) {
                return Ok(error_response(
                    StatusCode::UNAUTHORIZED,
                    "INVALID_TOKEN",
                    "Invalid admin token",
                ));
            }

            // Token valid, proceed
            inner.call(req).await
        })
    }
}

/// Admin authentication middleware function for use with axum::middleware::from_fn.
pub async fn require_admin(
    axum::extract::State(config): axum::extract::State<Arc<AdminAuthConfig>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    // Get peer IP
    let peer_ip = req
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip())
        .unwrap_or_else(|| "127.0.0.1".parse().unwrap());

    // Get forwarded headers
    let forwarded_for = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok());
    let forwarded_proto = req
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok());

    // Reject X-Forwarded-* from untrusted peers
    if !config.is_trusted_proxy(peer_ip) && (forwarded_for.is_some() || forwarded_proto.is_some())
    {
        return error_response(
            StatusCode::BAD_REQUEST,
            "UNTRUSTED_HEADERS",
            "X-Forwarded-* headers from untrusted source",
        );
    }

    // Check HTTPS requirement
    let client_ip = config.get_client_ip(peer_ip, forwarded_for);
    let is_https = config.is_https(peer_ip, forwarded_proto);

    if config.require_https && !is_https && !config.is_loopback_bypass_allowed(client_ip) {
        return error_response(
            StatusCode::BAD_REQUEST,
            "HTTPS_REQUIRED",
            "HTTPS is required for admin endpoints",
        );
    }

    // Check admin token is configured
    if !config.is_configured() {
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "SETUP_DISABLED",
            "Admin token not configured. Set OORE_ADMIN_TOKEN.",
        );
    }

    // Validate Authorization header
    let auth_header = req.headers().get(header::AUTHORIZATION);

    let token = match auth_header {
        Some(header) => {
            let header_str = match header.to_str() {
                Ok(s) => s,
                Err(_) => {
                    return error_response(
                        StatusCode::BAD_REQUEST,
                        "INVALID_HEADER",
                        "Invalid Authorization header encoding",
                    );
                }
            };

            if !header_str.starts_with("Bearer ") {
                return error_response(
                    StatusCode::UNAUTHORIZED,
                    "INVALID_AUTH_TYPE",
                    "Expected 'Bearer' authentication",
                );
            }

            &header_str[7..]
        }
        None => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                "MISSING_AUTH",
                "Authorization header required",
            );
        }
    };

    // Validate token
    if !config.validate_token(token) {
        return error_response(
            StatusCode::UNAUTHORIZED,
            "INVALID_TOKEN",
            "Invalid admin token",
        );
    }

    // Add security headers
    let mut response = next.run(req).await;
    add_security_headers(response.headers_mut());
    response
}

/// Adds security headers to response.
fn add_security_headers(headers: &mut axum::http::HeaderMap) {
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, no-cache, must-revalidate"),
    );
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
}

/// Error response type.
#[derive(Serialize)]
struct ErrorResponse {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    code: String,
    message: String,
}

fn error_response(status: StatusCode, code: &str, message: &str) -> Response {
    let body = ErrorResponse {
        error: ErrorDetail {
            code: code.to_string(),
            message: message.to_string(),
        },
    };

    let mut response = (status, Json(body)).into_response();
    add_security_headers(response.headers_mut());
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_time_token_comparison() {
        let config = AdminAuthConfig {
            admin_token: Some(Arc::new("test-token-123".to_string())),
            require_https: false,
            dev_mode: true,
            trusted_proxies: vec![],
        };

        assert!(config.validate_token("test-token-123"));
        assert!(!config.validate_token("wrong-token"));
        assert!(!config.validate_token("test-token-12")); // Different length
    }

    #[test]
    fn test_trusted_proxy_detection() {
        let config = AdminAuthConfig {
            admin_token: None,
            require_https: false,
            dev_mode: false,
            trusted_proxies: vec!["10.0.0.0/8".parse().unwrap()],
        };

        assert!(config.is_trusted_proxy("10.1.2.3".parse().unwrap()));
        assert!(!config.is_trusted_proxy("192.168.1.1".parse().unwrap()));
    }

    #[test]
    fn test_client_ip_extraction() {
        let config = AdminAuthConfig {
            admin_token: None,
            require_https: false,
            dev_mode: false,
            trusted_proxies: vec!["10.0.0.0/8".parse().unwrap()],
        };

        // Trusted proxy with forwarded header
        let peer_ip: IpAddr = "10.0.0.1".parse().unwrap();
        let forwarded = "8.8.8.8, 10.0.0.2";
        let client = config.get_client_ip(peer_ip, Some(forwarded));
        assert_eq!(client, "8.8.8.8".parse::<IpAddr>().unwrap());

        // Untrusted peer - ignore header
        let peer_ip: IpAddr = "1.2.3.4".parse().unwrap();
        let client = config.get_client_ip(peer_ip, Some(forwarded));
        assert_eq!(client, peer_ip);
    }

    #[test]
    fn test_loopback_bypass() {
        let config = AdminAuthConfig {
            admin_token: None,
            require_https: true,
            dev_mode: true,
            trusted_proxies: vec![],
        };

        assert!(config.is_loopback_bypass_allowed("127.0.0.1".parse().unwrap()));
        assert!(config.is_loopback_bypass_allowed("::1".parse().unwrap()));
        assert!(!config.is_loopback_bypass_allowed("192.168.1.1".parse().unwrap()));

        // Dev mode off - no bypass
        let config = AdminAuthConfig {
            admin_token: None,
            require_https: true,
            dev_mode: false,
            trusted_proxies: vec![],
        };
        assert!(!config.is_loopback_bypass_allowed("127.0.0.1".parse().unwrap()));
    }
}
