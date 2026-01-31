//! Build artifact models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use ulid::Ulid;

use super::BuildId;

/// Unique identifier for a build artifact.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BuildArtifactId(pub Ulid);

impl BuildArtifactId {
    /// Creates a new random artifact ID.
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    /// Creates an artifact ID from a string.
    pub fn from_string(s: &str) -> Result<Self, ulid::DecodeError> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for BuildArtifactId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for BuildArtifactId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A build artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildArtifact {
    pub id: BuildArtifactId,
    pub build_id: BuildId,
    /// Display name (file name).
    pub name: String,
    /// Relative path from workspace root (preserves directory structure).
    pub relative_path: String,
    /// Actual storage path on disk.
    pub storage_path: String,
    /// File size in bytes.
    pub size_bytes: i64,
    /// MIME content type.
    pub content_type: Option<String>,
    /// SHA-256 checksum.
    pub checksum_sha256: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl BuildArtifact {
    /// Creates a new build artifact.
    pub fn new(
        build_id: BuildId,
        name: String,
        relative_path: String,
        storage_path: String,
        size_bytes: i64,
        content_type: Option<String>,
        checksum_sha256: Option<String>,
    ) -> Self {
        Self {
            id: BuildArtifactId::new(),
            build_id,
            name,
            relative_path,
            storage_path,
            size_bytes,
            content_type,
            checksum_sha256,
            created_at: Utc::now(),
        }
    }
}

/// Response for build artifact (for API).
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../../types/")]
pub struct BuildArtifactResponse {
    pub id: String,
    pub build_id: String,
    pub name: String,
    pub relative_path: String,
    #[ts(type = "number")]
    pub size_bytes: i64,
    pub content_type: Option<String>,
    pub checksum_sha256: Option<String>,
    pub created_at: String,
    /// Download URL (relative).
    pub download_url: String,
}

impl BuildArtifactResponse {
    pub fn from_artifact(artifact: BuildArtifact) -> Self {
        let download_url = format!(
            "/api/builds/{}/artifacts/{}",
            artifact.build_id, artifact.id
        );
        Self {
            id: artifact.id.to_string(),
            build_id: artifact.build_id.to_string(),
            name: artifact.name,
            relative_path: artifact.relative_path,
            size_bytes: artifact.size_bytes,
            content_type: artifact.content_type,
            checksum_sha256: artifact.checksum_sha256,
            created_at: artifact.created_at.to_rfc3339(),
            download_url,
        }
    }
}

/// Infers content type from file extension.
pub fn infer_content_type(path: &std::path::Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_lowercase();
    let content_type = match extension.as_str() {
        // iOS artifacts
        "ipa" => "application/octet-stream",
        "app" => "application/octet-stream",
        "xcarchive" => "application/octet-stream",
        "dSYM" | "dsym" => "application/octet-stream",

        // Android artifacts
        "apk" => "application/vnd.android.package-archive",
        "aab" => "application/octet-stream",

        // Common archives
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" => "application/gzip",
        "tgz" => "application/gzip",

        // Text files
        "txt" => "text/plain",
        "log" => "text/plain",
        "json" => "application/json",
        "xml" => "application/xml",
        "html" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",

        // Images
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",

        // Documents
        "pdf" => "application/pdf",

        _ => "application/octet-stream",
    };

    Some(content_type.to_string())
}

/// Computes SHA-256 checksum of a file.
pub async fn compute_sha256(path: &std::path::Path) -> std::io::Result<String> {
    use sha2::{Digest, Sha256};
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024]; // 64KB buffer

    loop {
        let bytes_read = file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let result = hasher.finalize();
    Ok(hex::encode(result))
}

/// Sanitizes a filename for safe use in Content-Disposition header.
///
/// Uses a whitelist approach to only allow safe characters.
/// Handles path traversal sequences like ".." by replacing dots.
pub fn sanitize_filename(name: &str) -> String {
    // First, handle potential path traversal by extracting just the filename
    let name = name
        .rsplit(|c| c == '/' || c == '\\')
        .next()
        .unwrap_or(name);

    // Build sanitized filename using whitelist approach
    let sanitized: String = name
        .chars()
        .map(|c| {
            // Allow alphanumeric, common safe punctuation for filenames
            if c.is_alphanumeric()
                || c == '.'
                || c == '-'
                || c == '_'
                || c == ' '
            {
                c
            } else {
                '_' // Replace unsafe characters with underscore
            }
        })
        .collect();

    // Handle ".." sequences that could cause issues
    let sanitized = sanitized.replace("..", "_");

    // Trim whitespace and ensure non-empty
    let sanitized = sanitized.trim().to_string();

    if sanitized.is_empty() || sanitized == "." {
        "unnamed".to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_infer_content_type() {
        assert_eq!(
            infer_content_type(Path::new("app.ipa")),
            Some("application/octet-stream".to_string())
        );
        assert_eq!(
            infer_content_type(Path::new("app.apk")),
            Some("application/vnd.android.package-archive".to_string())
        );
        assert_eq!(
            infer_content_type(Path::new("report.json")),
            Some("application/json".to_string())
        );
        assert_eq!(
            infer_content_type(Path::new("unknown")),
            None
        );
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("app.ipa"), "app.ipa");
        // Path traversal attempts should be stripped/sanitized
        assert_eq!(sanitize_filename("../../../etc/passwd"), "passwd");
        assert_eq!(sanitize_filename("..\\..\\windows\\system32"), "system32");
        // Null bytes and control chars become underscores
        assert_eq!(sanitize_filename("file\0name"), "file_name");
        // Whitespace is trimmed
        assert_eq!(sanitize_filename("  spaces  "), "spaces");
        // ".." sequences are replaced
        assert_eq!(sanitize_filename("file..name"), "file_name");
        // Empty/dot-only becomes "unnamed"
        assert_eq!(sanitize_filename(""), "unnamed");
        assert_eq!(sanitize_filename("."), "unnamed");
        // Safe special characters preserved
        assert_eq!(sanitize_filename("my-app_v1.0.ipa"), "my-app_v1.0.ipa");
    }
}
