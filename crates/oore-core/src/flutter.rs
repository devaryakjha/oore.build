//! Flutter project detection and build setup.
//!
//! This module provides utilities for detecting Flutter projects and
//! generating appropriate setup commands for CI builds.

use std::path::Path;

/// Detects if a directory contains a Flutter project.
///
/// A Flutter project is identified by the presence of `pubspec.yaml`.
pub async fn detect_flutter_project(workspace: &Path) -> bool {
    workspace.join("pubspec.yaml").exists()
}

/// Gets the Flutter version specification from the project.
///
/// Checks for version files in order of priority:
/// 1. `.fvmrc` (FVM config)
/// 2. `.fvm/fvm_config.json` (FVM legacy config)
/// 3. `.flutter-version` (simple version file)
pub async fn get_flutter_version(workspace: &Path) -> Option<String> {
    // Check .fvmrc (YAML/JSON format)
    if let Ok(content) = tokio::fs::read_to_string(workspace.join(".fvmrc")).await {
        if let Some(version) = parse_fvmrc(&content) {
            return Some(version);
        }
    }

    // Check .fvm/fvm_config.json (legacy FVM config)
    if let Ok(content) = tokio::fs::read_to_string(workspace.join(".fvm/fvm_config.json")).await {
        if let Some(version) = parse_fvm_config_json(&content) {
            return Some(version);
        }
    }

    // Check .flutter-version (simple version file)
    if let Ok(version) = tokio::fs::read_to_string(workspace.join(".flutter-version")).await {
        let version = version.trim();
        if !version.is_empty() {
            return Some(version.to_string());
        }
    }

    None
}

/// Parses FVM config from .fvmrc content.
fn parse_fvmrc(content: &str) -> Option<String> {
    // Try JSON format first
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(flutter) = json.get("flutter") {
            if let Some(version) = flutter.as_str() {
                return Some(version.to_string());
            }
        }
        if let Some(version) = json.get("flutterSdkVersion") {
            if let Some(v) = version.as_str() {
                return Some(v.to_string());
            }
        }
    }

    // Try simple key: value format
    for line in content.lines() {
        let line = line.trim();
        if let Some(version) = line.strip_prefix("flutter:") {
            return Some(version.trim().trim_matches('"').to_string());
        }
        if let Some(version) = line.strip_prefix("flutterSdkVersion:") {
            return Some(version.trim().trim_matches('"').to_string());
        }
    }

    None
}

/// Parses FVM config from fvm_config.json content.
fn parse_fvm_config_json(content: &str) -> Option<String> {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(version) = json.get("flutterSdkVersion") {
            if let Some(v) = version.as_str() {
                return Some(v.to_string());
            }
        }
    }
    None
}

/// Generates the Flutter setup script for a build.
///
/// The script:
/// 1. Runs `flutter doctor -v` to show environment info
/// 2. Runs `flutter pub get` to fetch dependencies
/// 3. Optionally sets Flutter version if FVM is configured
pub fn generate_flutter_setup_script(flutter_version: Option<&str>) -> String {
    let mut script = String::new();

    // Show Flutter doctor for debugging
    script.push_str("echo '=== Flutter Doctor ==='\n");
    script.push_str("flutter doctor -v\n");
    script.push('\n');

    // If FVM version is specified, try to use it
    if let Some(version) = flutter_version {
        script.push_str(&format!("echo '=== Using Flutter version: {} ==='\n", version));
        // Check if FVM is available
        script.push_str("if command -v fvm &> /dev/null; then\n");
        script.push_str(&format!("  fvm use {} --force\n", version));
        script.push_str("  fvm flutter pub get\n");
        script.push_str("else\n");
        script.push_str(&format!(
            "  echo 'Warning: FVM not found. Using system Flutter instead of {}.'\n",
            version
        ));
        script.push_str("  flutter pub get\n");
        script.push_str("fi\n");
    } else {
        // Standard pub get
        script.push_str("echo '=== Fetching dependencies ==='\n");
        script.push_str("flutter pub get\n");
    }

    script
}

/// Detects the target platforms for a Flutter project.
///
/// Returns a list of platforms that have platform-specific directories.
pub async fn detect_platforms(workspace: &Path) -> Vec<FlutterPlatform> {
    let mut platforms = Vec::new();

    if workspace.join("android").is_dir() {
        platforms.push(FlutterPlatform::Android);
    }
    if workspace.join("ios").is_dir() {
        platforms.push(FlutterPlatform::Ios);
    }
    if workspace.join("macos").is_dir() {
        platforms.push(FlutterPlatform::MacOS);
    }
    if workspace.join("linux").is_dir() {
        platforms.push(FlutterPlatform::Linux);
    }
    if workspace.join("windows").is_dir() {
        platforms.push(FlutterPlatform::Windows);
    }
    if workspace.join("web").is_dir() {
        platforms.push(FlutterPlatform::Web);
    }

    platforms
}

/// Flutter target platform.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FlutterPlatform {
    Android,
    Ios,
    MacOS,
    Linux,
    Windows,
    Web,
}

impl FlutterPlatform {
    pub fn as_str(&self) -> &'static str {
        match self {
            FlutterPlatform::Android => "android",
            FlutterPlatform::Ios => "ios",
            FlutterPlatform::MacOS => "macos",
            FlutterPlatform::Linux => "linux",
            FlutterPlatform::Windows => "windows",
            FlutterPlatform::Web => "web",
        }
    }
}

impl std::fmt::Display for FlutterPlatform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_fvmrc_json() {
        let content = r#"{"flutter": "3.16.0"}"#;
        assert_eq!(parse_fvmrc(content), Some("3.16.0".to_string()));

        let content = r#"{"flutterSdkVersion": "stable"}"#;
        assert_eq!(parse_fvmrc(content), Some("stable".to_string()));
    }

    #[test]
    fn test_parse_fvmrc_yaml_like() {
        let content = "flutter: 3.16.0";
        assert_eq!(parse_fvmrc(content), Some("3.16.0".to_string()));

        let content = "flutter: \"stable\"";
        assert_eq!(parse_fvmrc(content), Some("stable".to_string()));
    }

    #[test]
    fn test_parse_fvm_config_json() {
        let content = r#"{"flutterSdkVersion": "3.16.0", "flavors": {}}"#;
        assert_eq!(parse_fvm_config_json(content), Some("3.16.0".to_string()));
    }

    #[test]
    fn test_generate_flutter_setup_script() {
        let script = generate_flutter_setup_script(None);
        assert!(script.contains("flutter doctor -v"));
        assert!(script.contains("flutter pub get"));

        let script = generate_flutter_setup_script(Some("3.16.0"));
        assert!(script.contains("3.16.0"));
        assert!(script.contains("fvm"));
    }
}
