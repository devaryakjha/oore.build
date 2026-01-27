# Codemagic CLI Tools Analysis

> Last Updated: 2026-01-28
> Status: Reference analysis for Oore CI/CD implementation
> Repository: https://github.com/codemagic-ci-cd/cli-tools

## Table of Contents
1. [Overview](#overview)
2. [Available Tools](#available-tools)
3. [Keychain Tool](#keychain-tool)
4. [App Store Connect Tool](#app-store-connect-tool)
5. [Android Keystore Tool](#android-keystore-tool)
6. [Xcode Project Tool](#xcode-project-tool)
7. [Google Play Tool](#google-play-tool)
8. [Implementation Patterns](#implementation-patterns)
9. [Lessons for Oore](#lessons-for-oore)

---

## Overview

Codemagic CLI Tools is an open-source Python package providing utilities for mobile app code signing and deployment.

**Repository**: https://github.com/codemagic-ci-cd/cli-tools
**License**: GPL-3.0
**Language**: Python 3.8+
**Installation**: `pip install codemagic-cli-tools`

**Source**: [Codemagic CLI Tools - GitHub](https://github.com/codemagic-ci-cd/cli-tools)

### Design Philosophy

1. **Command-line first**: All functionality accessible via CLI
2. **Python API mirroring**: Same functionality available programmatically
3. **Cross-platform focus**: iOS and Android signing in one package
4. **CI/CD optimized**: Designed for non-interactive environments

---

## Available Tools

| Tool | Purpose |
|------|---------|
| `keychain` | macOS keychain management for code signing |
| `app-store-connect` | Apple App Store Connect API integration |
| `xcode-project` | Xcode project configuration and building |
| `android-keystore` | Android keystore management |
| `google-play` | Google Play Store deployment |
| `universal-apk` | Create universal APKs from AAB |
| `android-app-bundle` | Manage Android App Bundles |
| `git-changelog` | Generate changelogs from git |

**Source**: [Codemagic CLI Tools Documentation](https://docs.codemagic.io/knowledge-codemagic/codemagic-cli-tools/)

---

## Keychain Tool

### Purpose

Manages macOS keychains for code signing, handling:
- Keychain creation and deletion
- Certificate imports
- Access control for CI/CD

### Commands

| Command | Description |
|---------|-------------|
| `initialize` | Create and configure keychain for code signing |
| `create` | Create a new keychain |
| `add-certificates` | Import .p12 certificates |
| `list-certificates` | List code signing certificates |
| `lock` / `unlock` | Lock/unlock keychain |
| `make-default` | Set as default keychain |
| `get-default` | Show default keychain |
| `use-login` | Switch to login keychain |
| `set-timeout` | Configure lock timeout |
| `delete` | Delete keychain |

**Source**: [Keychain README - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/keychain/README.md)

### initialize Command

Sets up a complete keychain for code signing:

```bash
keychain initialize \
  --path /path/to/build.keychain \
  --password "$KEYCHAIN_PASSWORD" \
  --timeout 0  # No timeout
```

**What it does**:
1. Creates keychain at specified path
2. Sets password
3. Configures timeout (0 = no auto-lock)
4. Makes it the default keychain
5. Unlocks for immediate use

**Source**: [keychain initialize - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/keychain/initialize.md)

### add-certificates Command

Imports .p12 certificates into keychain:

```bash
keychain add-certificates \
  --certificate /path/to/cert.p12 \
  --certificate-password "$CERT_PASSWORD" \
  --allow-app codesign \
  --allow-app productsign
```

**Options**:
- `-c, --certificate`: Path(s) to .p12 files (supports globs)
- `--certificate-password`: P12 password (supports `@env:` and `@file:` prefixes)
- `-a, --allow-app`: Applications allowed access (default: codesign, productsign)
- `-A, --allow-all-applications`: Allow any app access
- `-D, --disallow-all-applications`: Deny all access

**Source**: [keychain add-certificates - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/keychain/add-certificates.md)

### Implementation Details

Based on source code analysis:

1. **Uses `security` command**: Wraps macOS security CLI
2. **Handles `-db` suffix quirk**: macOS adds `-db` to keychain names
3. **Sets partition list**: Adds `apple-tool:,apple:` for codesign access
4. **Default paths**: `~/Library/codemagic-cli-tools/keychains/`
5. **Secure permissions**: Sets 0o600 on keychain files

**Key macOS commands used**:
```bash
security create-keychain -p [password] [path]
security unlock-keychain -p [password] [path]
security set-keychain-settings -t [timeout] [path]
security import [cert] -k [keychain] -f pkcs12 -P [password] -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k [password] [keychain]
```

**Source**: [keychain.py - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/v0.28.0/src/codemagic/tools/keychain.py)

---

## App Store Connect Tool

### Purpose

Interacts with Apple's App Store Connect API for:
- Fetching/creating certificates
- Fetching/creating provisioning profiles
- Managing apps and builds

### Authentication

Uses App Store Connect API keys (JWT-based):

```bash
app-store-connect <command> \
  --issuer-id "$ISSUER_ID" \
  --key-id "$KEY_ID" \
  --private-key "$PRIVATE_KEY"
```

Or via environment variables:
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_IDENTIFIER`
- `APP_STORE_CONNECT_PRIVATE_KEY`

### fetch-signing-files Command

Fetches or creates certificates and provisioning profiles:

```bash
app-store-connect fetch-signing-files \
  "com.company.app" \
  --type IOS_APP_STORE \
  --platform IOS \
  --create \
  --certificate-key @file:/path/to/private_key.pem
```

**Options**:
- `BUNDLE_ID_IDENTIFIER`: The bundle ID
- `--type`: Profile type (see below)
- `--platform`: IOS, MAC_OS, UNIVERSAL, SERVICES
- `--create`: Create resources if missing
- `--strict-match-identifier`: No wildcard matching
- `--certificates-dir`: Output directory for certs
- `--profiles-dir`: Output directory for profiles

**Profile types**:
- iOS: `IOS_APP_DEVELOPMENT`, `IOS_APP_ADHOC`, `IOS_APP_STORE`, `IOS_APP_INHOUSE`
- macOS: `MAC_APP_DEVELOPMENT`, `MAC_APP_STORE`, `MAC_APP_DIRECT`
- Catalyst: `MAC_CATALYST_APP_DEVELOPMENT`, `MAC_CATALYST_APP_STORE`, `MAC_CATALYST_APP_DIRECT`
- tvOS: `TVOS_APP_DEVELOPMENT`, `TVOS_APP_ADHOC`, `TVOS_APP_STORE`, `TVOS_APP_INHOUSE`

**Source**: [fetch-signing-files - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/app-store-connect/fetch-signing-files.md)

### Output Locations

Default paths:
- Certificates: `$HOME/Library/MobileDevice/Certificates`
- Profiles: `$HOME/Library/MobileDevice/Provisioning Profiles`

---

## Android Keystore Tool

### Purpose

Manages Android keystores for app signing.

### Commands

| Command | Description |
|---------|-------------|
| `create` | Create a new keystore |
| `create-debug-keystore` | Create debug keystore at `~/.android/debug.keystore` |
| `certificate` | Extract certificate for specified alias |
| `certificates` | List certificates in keystore |
| `verify` | Verify keystore credentials are correct |

**Source**: [android-keystore README - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/android-keystore/README.md)

### verify Command

Validates keystore configuration:

```bash
android-keystore verify \
  --keystore /path/to/keystore.jks \
  --keystore-password "$STORE_PASSWORD" \
  --key-alias release-key \
  --key-password "$KEY_PASSWORD"
```

### Relationship to keytool

The tool wraps Java's `keytool` utility for keystore operations. For keystore creation, Codemagic documentation recommends using `keytool` directly:

```bash
keytool -genkey -v -keystore codemagic.keystore \
  -storetype JKS -keyalg RSA -keysize 2048 \
  -validity 10000 -alias codemagic
```

**Source**: [Android Code Signing - Codemagic Docs](https://docs.codemagic.io/yaml-code-signing/signing-android/)

---

## Xcode Project Tool

### Purpose

Configures Xcode projects for building and exports IPAs.

### Key Commands

| Command | Description |
|---------|-------------|
| `use-profiles` | Apply provisioning profiles to project |
| `build-ipa` | Archive and export IPA |
| `detect-bundle-id` | Get bundle ID from project |

### use-profiles Command

Applies downloaded provisioning profiles to Xcode project:

```bash
xcode-project use-profiles \
  --project MyApp.xcodeproj \
  --profile /path/to/profile.mobileprovision
```

Or with custom export options:
```bash
xcode-project use-profiles \
  --custom-export-options='{"testFlightInternalTestingOnly": true}'
```

**Source**: [Signing iOS Apps - Codemagic Docs](https://docs.codemagic.io/yaml-code-signing/signing-ios/)

### build-ipa Command

Archives and exports IPA:

```bash
xcode-project build-ipa \
  --workspace MyApp.xcworkspace \
  --scheme MyScheme \
  --archive-flags="-destination 'generic/platform=iOS'"
```

**What it does**:
1. Runs `xcodebuild archive`
2. Generates ExportOptions.plist
3. Runs `xcodebuild -exportArchive`

**Source**: [xcode-project build-ipa - GitHub](https://github.com/codemagic-ci-cd/cli-tools/blob/master/docs/xcode-project/build-ipa.md)

---

## Google Play Tool

### Purpose

Deploys Android apps to Google Play Store.

### Authentication

Uses Google service account JSON:

```bash
google-play <command> \
  --credentials /path/to/service-account.json
```

Or via environment variable:
- `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`

### publish Command

Uploads AAB/APK to Google Play:

```bash
google-play publish \
  --credentials "$GCLOUD_SERVICE_ACCOUNT_CREDENTIALS" \
  --package-name com.company.app \
  --track internal \
  --artifact /path/to/app-release.aab
```

**Track options**:
- `internal`: Internal testing
- `alpha`: Closed testing
- `beta`: Open testing
- `production`: Production release

**Source**: [Google Play Publishing - Codemagic Docs](https://docs.codemagic.io/yaml-publishing/google-play/)

---

## Implementation Patterns

### Typical iOS Signing Workflow

```bash
# 1. Initialize keychain
keychain initialize

# 2. Fetch signing files from App Store Connect
app-store-connect fetch-signing-files \
  "$BUNDLE_ID" \
  --type IOS_APP_STORE \
  --create

# 3. Add certificates to keychain
keychain add-certificates

# 4. Apply profiles to project
xcode-project use-profiles

# 5. Build IPA
xcode-project build-ipa \
  --workspace "$WORKSPACE" \
  --scheme "$SCHEME"

# 6. (Optional) Upload to App Store Connect
app-store-connect publish \
  --path /path/to/app.ipa
```

**Source**: [iOS Native Apps - Codemagic Docs](https://docs.codemagic.io/yaml-quick-start/building-a-native-ios-app/)

### Typical Android Signing Workflow

```bash
# 1. Verify keystore
android-keystore verify \
  --keystore "$KEYSTORE_PATH" \
  --keystore-password "$STORE_PASSWORD" \
  --key-alias "$KEY_ALIAS" \
  --key-password "$KEY_PASSWORD"

# 2. Build with Gradle (signing configured in build.gradle)
./gradlew assembleRelease
# or
./gradlew bundleRelease

# 3. Upload to Google Play
google-play publish \
  --package-name "$PACKAGE_NAME" \
  --track internal \
  --artifact app-release.aab
```

**Source**: [Android Native Apps - Codemagic Docs](https://docs.codemagic.io/yaml-quick-start/building-a-native-android-app/)

---

## Lessons for Oore

### What to Adopt

1. **Ephemeral Keychain Pattern**
   - Create temporary keychain per build
   - Automatic cleanup after build
   - Prevents credential leakage

2. **Partition List Handling**
   - Always set after certificate import
   - Include `apple-tool:,apple:,codesign:`
   - Required for non-interactive signing

3. **Environment Variable Prefixes**
   - `@env:VAR_NAME` for environment variables
   - `@file:/path/to/file` for file contents
   - Clean separation of secrets

4. **Default Output Paths**
   - Use macOS standard locations for compatibility
   - `~/Library/MobileDevice/Certificates`
   - `~/Library/MobileDevice/Provisioning Profiles`

5. **Profile Type Enumeration**
   - Clear mapping of profile types to use cases
   - Consistent naming across platforms

### What to Do Differently

1. **Implementation Language**
   - Oore uses Rust (performance, memory safety)
   - Codemagic uses Python (flexibility, rapid development)

2. **Integration Approach**
   - Oore: Integrated into server binary
   - Codemagic: Separate CLI tools

3. **Credential Storage**
   - Oore: Encrypted in SQLite (local-first)
   - Codemagic: Environment variables / Codemagic dashboard

4. **API Design**
   - Consider whether to expose CLI or just internal API
   - CLI useful for debugging and manual operations

### Key macOS Commands to Wrap

```bash
# Keychain management
security create-keychain
security delete-keychain
security unlock-keychain
security lock-keychain
security default-keychain
security list-keychains
security set-keychain-settings
security import
security set-key-partition-list
security find-identity
security find-certificate

# Code signing
codesign --sign --force --deep --timestamp --options runtime
codesign --verify
codesign -d --entitlements

# Notarization
xcrun notarytool store-credentials
xcrun notarytool submit
xcrun notarytool log
xcrun stapler staple
xcrun stapler validate

# Xcode
xcodebuild archive
xcodebuild -exportArchive
```

### Key Java Commands to Wrap

```bash
# Keystore management
keytool -genkey
keytool -list
keytool -export
keytool -delete
keytool -storepasswd
keytool -keypasswd

# APK signing
apksigner sign
apksigner verify

# AAB handling
bundletool build-apks
bundletool install-apks
```

---

## References

1. [Codemagic CLI Tools - GitHub](https://github.com/codemagic-ci-cd/cli-tools)
2. [Codemagic CLI Tools Documentation](https://docs.codemagic.io/knowledge-codemagic/codemagic-cli-tools/)
3. [Signing iOS Apps - Codemagic](https://docs.codemagic.io/yaml-code-signing/signing-ios/)
4. [Signing macOS Apps - Codemagic](https://docs.codemagic.io/yaml-code-signing/signing-macos/)
5. [Android Code Signing - Codemagic](https://docs.codemagic.io/yaml-code-signing/signing-android/)
6. [Google Play Publishing - Codemagic](https://docs.codemagic.io/yaml-publishing/google-play/)
7. [Automating Signing Files Management](https://ioscodesigning.io/automating-signing-files-management-with-codemagic-cli-tools/)
8. [Deploy to App Store with CLI Tools - Codemagic Blog](https://blog.codemagic.io/deploy-your-app-to-app-store-with-codemagic-cli-tools-and-github-actions/)
9. [Deploy to Google Play with CLI Tools - Codemagic Blog](https://blog.codemagic.io/deploy-your-app-to-google-play-with-codemagic-cli-tools-and-github-actions/)
