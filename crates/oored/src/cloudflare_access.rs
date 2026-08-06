use std::collections::HashSet;
use std::time::{Duration, Instant};

use axum::Json;
use axum::http::{HeaderMap, StatusCode};
use jsonwebtoken::jwk::{JwkSet, KeyAlgorithm};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use oore_contract::ApiError;
use serde::Deserialize;
use tokio::sync::Mutex;

use crate::instance_settings::{EffectiveTrustedProxySettings, normalize_email_value};
use crate::util::{api_err, now_unix};

pub const ASSERTION_HEADER: &str = "cf-access-jwt-assertion";
const TEAM_DOMAIN_SUFFIX: &str = ".cloudflareaccess.com";
const MAX_TOKEN_BYTES: usize = 32 * 1024;
const MAX_JWKS_BYTES: usize = 256 * 1024;
const MAX_JWKS_KEYS: usize = 64;
const MAX_KID_BYTES: usize = 256;
const MAX_SUBJECT_BYTES: usize = 512;
const MAX_AUDIENCE_BYTES: usize = 512;
const MAX_CACHE_TTL: Duration = Duration::from_secs(5 * 60);
const UNKNOWN_KEY_REFRESH_COOLDOWN: Duration = Duration::from_secs(30);
const CLOCK_LEEWAY_SECONDS: u64 = 30;
const DEFAULT_CACHE_TTL: Duration = Duration::from_secs(60);

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

#[derive(Debug, Clone)]
struct CachedKeys {
    team_domain: String,
    keys: JwkSet,
    expires_at: Instant,
    last_unknown_refresh_at: Option<Instant>,
}

pub struct CloudflareAccessIdentity {
    pub email: String,
    pub subject: String,
}

#[derive(Debug, Deserialize)]
struct CloudflareClaims {
    email: String,
    sub: String,
    iat: i64,
    #[serde(rename = "type")]
    token_type: Option<String>,
}

pub struct CloudflareAccessVerifier {
    client: reqwest::Client,
    cache: Mutex<Option<CachedKeys>>,
}

impl CloudflareAccessVerifier {
    pub fn new() -> anyhow::Result<Self> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(concat!("oored/", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self {
            client,
            cache: Mutex::new(None),
        })
    }

    pub async fn verified_identity(
        &self,
        headers: &HeaderMap,
        settings: &EffectiveTrustedProxySettings,
    ) -> ApiResult<CloudflareAccessIdentity> {
        let team_domain = settings
            .cloudflare_team_domain
            .as_deref()
            .ok_or_else(|| config_error("Cloudflare Access team domain is not configured"))?;
        let audience = settings.cloudflare_audience.as_deref().ok_or_else(|| {
            config_error("Cloudflare Access application audience is not configured")
        })?;

        let token = headers
            .get(ASSERTION_HEADER)
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                api_err(
                    StatusCode::UNAUTHORIZED,
                    "cloudflare_access_assertion_missing",
                    "Cloudflare Access did not provide a signed user assertion",
                )
            })?;
        if token.len() > MAX_TOKEN_BYTES {
            return Err(invalid_assertion());
        }

        let header = decode_header(token).map_err(|_| invalid_assertion())?;
        if header.alg != Algorithm::RS256 {
            return Err(invalid_assertion());
        }
        let kid = header
            .kid
            .as_deref()
            .filter(|value| !value.is_empty() && value.len() <= MAX_KID_BYTES)
            .ok_or_else(invalid_assertion)?;

        let (mut keys, fetched_now) = self.load_keys(team_domain, false).await?;
        let mut jwk = keys.find(kid);
        if jwk.is_none() && !fetched_now {
            (keys, _) = self.load_keys(team_domain, true).await?;
            jwk = keys.find(kid);
        }
        let jwk = jwk.ok_or_else(invalid_assertion)?;
        if jwk
            .common
            .key_algorithm
            .is_some_and(|alg| alg != KeyAlgorithm::RS256)
        {
            return Err(invalid_assertion());
        }
        let decoding_key = DecodingKey::from_jwk(jwk).map_err(|_| invalid_assertion())?;

        let issuer = format!("https://{team_domain}");
        let mut validation = Validation::new(Algorithm::RS256);
        validation.algorithms = vec![Algorithm::RS256];
        validation.leeway = CLOCK_LEEWAY_SECONDS;
        validation.validate_nbf = true;
        validation.set_required_spec_claims(&["exp", "iss", "aud", "sub", "iat", "nbf"]);
        validation.set_issuer(&[issuer]);
        validation.set_audience(&[audience]);

        let claims = decode::<CloudflareClaims>(token, &decoding_key, &validation)
            .map_err(|_| invalid_assertion())?
            .claims;
        if claims
            .token_type
            .as_deref()
            .is_some_and(|token_type| token_type != "app")
            || claims.sub.is_empty()
            || claims.sub.len() > MAX_SUBJECT_BYTES
            || claims.iat <= 0
            || claims.iat > now_unix().saturating_add(CLOCK_LEEWAY_SECONDS as i64)
        {
            return Err(invalid_assertion());
        }

        let email = normalize_email_value(&claims.email).ok_or_else(invalid_assertion)?;
        Ok(CloudflareAccessIdentity {
            email,
            subject: format!("cloudflare-access::{team_domain}::{}", claims.sub),
        })
    }

    async fn load_keys(&self, team_domain: &str, force_refresh: bool) -> ApiResult<(JwkSet, bool)> {
        let mut cache = self.cache.lock().await;
        if !force_refresh
            && let Some(cached) = cache.as_ref()
            && cached.team_domain == team_domain
            && cached.expires_at > Instant::now()
        {
            return Ok((cached.keys.clone(), false));
        }
        if force_refresh
            && let Some(cached) = cache.as_ref()
            && cached.team_domain == team_domain
            && cached
                .last_unknown_refresh_at
                .is_some_and(|refreshed_at| refreshed_at.elapsed() < UNKNOWN_KEY_REFRESH_COOLDOWN)
        {
            return Ok((cached.keys.clone(), false));
        }

        let url = format!("https://{team_domain}/cdn-cgi/access/certs");
        let mut response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|_| unavailable("Cloudflare Access signing keys could not be reached"))?;
        if !response.status().is_success() {
            return Err(unavailable(
                "Cloudflare Access signing keys returned an error",
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_JWKS_BYTES as u64)
        {
            return Err(unavailable("Cloudflare Access signing keys were too large"));
        }
        let cache_ttl = cache_ttl(response.headers());

        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| unavailable("Cloudflare Access signing keys could not be read"))?
        {
            if body.len().saturating_add(chunk.len()) > MAX_JWKS_BYTES {
                return Err(unavailable("Cloudflare Access signing keys were too large"));
            }
            body.extend_from_slice(&chunk);
        }

        let keys: JwkSet = serde_json::from_slice(&body)
            .map_err(|_| unavailable("Cloudflare Access signing keys were invalid"))?;
        if keys.keys.is_empty() || keys.keys.len() > MAX_JWKS_KEYS {
            return Err(unavailable("Cloudflare Access signing keys were invalid"));
        }
        let mut key_ids = HashSet::with_capacity(keys.keys.len());
        for key in &keys.keys {
            let Some(kid) = key.common.key_id.as_deref() else {
                return Err(unavailable("Cloudflare Access signing keys were invalid"));
            };
            if kid.is_empty() || kid.len() > MAX_KID_BYTES {
                return Err(unavailable("Cloudflare Access signing keys were invalid"));
            }
            if key.common.key_algorithm != Some(KeyAlgorithm::RS256) || !key_ids.insert(kid) {
                return Err(unavailable("Cloudflare Access signing keys were invalid"));
            }
        }

        let fetched_at = Instant::now();
        *cache = Some(CachedKeys {
            team_domain: team_domain.to_string(),
            keys: keys.clone(),
            expires_at: fetched_at + cache_ttl,
            last_unknown_refresh_at: force_refresh.then_some(fetched_at),
        });
        Ok((keys, true))
    }
}

fn cache_ttl(headers: &reqwest::header::HeaderMap) -> Duration {
    let Some(value) = headers
        .get(reqwest::header::CACHE_CONTROL)
        .and_then(|value| value.to_str().ok())
    else {
        return DEFAULT_CACHE_TTL;
    };
    value
        .split(',')
        .map(str::trim)
        .find_map(|directive| directive.strip_prefix("max-age="))
        .and_then(|seconds| seconds.parse::<u64>().ok())
        .map(Duration::from_secs)
        .map(|duration| duration.min(MAX_CACHE_TTL))
        .unwrap_or(DEFAULT_CACHE_TTL)
}

pub fn normalize_team_domain(raw: Option<String>) -> ApiResult<Option<String>> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    let trimmed = raw.trim().trim_end_matches('/').to_ascii_lowercase();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let host = if trimmed.starts_with("https://") {
        let url = url::Url::parse(&trimmed).map_err(|_| invalid_configuration())?;
        if !url.username().is_empty()
            || url.password().is_some()
            || url.port().is_some()
            || url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(invalid_configuration());
        }
        url.host_str()
            .map(str::to_string)
            .ok_or_else(invalid_configuration)?
    } else if trimmed.contains("://") || trimmed.contains('/') {
        return Err(invalid_configuration());
    } else {
        trimmed
    };
    let Some(team) = host.strip_suffix(TEAM_DOMAIN_SUFFIX) else {
        return Err(invalid_configuration());
    };
    if host.len() > 253
        || team.is_empty()
        || team.len() > 63
        || team.contains('.')
        || !team
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        || !team
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphanumeric)
        || !team
            .as_bytes()
            .last()
            .is_some_and(u8::is_ascii_alphanumeric)
    {
        return Err(invalid_configuration());
    }
    Ok(Some(host))
}

pub fn normalize_audience(raw: Option<String>) -> ApiResult<Option<String>> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    let value = raw.trim();
    if value.is_empty() {
        return Ok(None);
    }
    if value.len() > MAX_AUDIENCE_BYTES
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Cloudflare Access application audience is invalid",
        ));
    }
    Ok(Some(value.to_string()))
}

fn invalid_configuration() -> (StatusCode, Json<ApiError>) {
    api_err(
        StatusCode::BAD_REQUEST,
        "invalid_input",
        "Cloudflare Access team domain must use the team.cloudflareaccess.com domain",
    )
}

fn invalid_assertion() -> (StatusCode, Json<ApiError>) {
    api_err(
        StatusCode::UNAUTHORIZED,
        "cloudflare_access_assertion_invalid",
        "Cloudflare Access user assertion is invalid",
    )
}

fn unavailable(message: &'static str) -> (StatusCode, Json<ApiError>) {
    api_err(
        StatusCode::SERVICE_UNAVAILABLE,
        "cloudflare_access_keys_unavailable",
        message,
    )
}

fn config_error(message: &'static str) -> (StatusCode, Json<ApiError>) {
    api_err(
        StatusCode::SERVICE_UNAVAILABLE,
        "trusted_proxy_config_invalid",
        message,
    )
}
