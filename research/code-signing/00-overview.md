# Code Signing Research Overview

> Last Updated: 2026-01-28
> Status: Comprehensive research for Oore CI/CD implementation

## Research Documents

| Document | Description |
|----------|-------------|
| [01-ios-code-signing.md](./01-ios-code-signing.md) | iOS certificates, provisioning profiles, distribution |
| [02-android-code-signing.md](./02-android-code-signing.md) | Android keystores, Play App Signing, AAB |
| [03-macos-code-signing.md](./03-macos-code-signing.md) | macOS Developer ID, notarization, hardened runtime |
| [04-codemagic-cli-analysis.md](./04-codemagic-cli-analysis.md) | Reference implementation analysis |

---

## Executive Summary

### Core Requirements for Oore

To build and sign Flutter apps for iOS, Android, and macOS, Oore needs:

#### iOS/macOS
1. **Certificate Management**: Store and manage .p12 files
2. **Keychain Integration**: Create/manage macOS keychains
3. **Provisioning Profile Management**: Store or fetch via App Store Connect API
4. **Code Signing**: Execute codesign with correct options
5. **Notarization** (macOS only): Submit to Apple, wait, staple

#### Android
1. **Keystore Management**: Store and manage .jks/.keystore files
2. **Gradle Configuration**: Generate key.properties at build time
3. **APK/AAB Signing**: Configure Gradle or use apksigner
4. **Google Play Integration**: Service account for uploads

---

## Platform Comparison

### Certificate/Key Types

| Platform | Credential | Format | Validity | Issuer |
|----------|------------|--------|----------|--------|
| iOS/macOS | Signing Certificate | .p12 | 1 year | Apple |
| iOS/macOS | Provisioning Profile | .mobileprovision | 1 year | Apple |
| iOS/macOS | APNs Key | .p8 | Never expires | Apple |
| Android | Keystore | .jks/.keystore | 25+ years | Self-signed |
| Android | Upload Key | .jks/.keystore | 25+ years | Self-signed |

### Distribution Methods

| Platform | Method | Store Review | Device Limit |
|----------|--------|--------------|--------------|
| iOS | App Store | Yes | Unlimited |
| iOS | TestFlight | Beta review | 10,000 |
| iOS | Ad Hoc | No | 100 |
| iOS | Enterprise | No | Unlimited |
| macOS | Mac App Store | Yes | Unlimited |
| macOS | Developer ID | No (notarized) | Unlimited |
| Android | Google Play | Yes | Unlimited |
| Android | APK sideload | No | Unlimited |

### Command-Line Tools

| Task | iOS/macOS | Android |
|------|-----------|---------|
| Create credentials | Keychain Access, Apple Portal | keytool |
| Import to system | security import | N/A (file-based) |
| Sign app | codesign | apksigner, Gradle |
| Build archive | xcodebuild archive | Gradle |
| Export IPA/APK | xcodebuild -exportArchive | Gradle, bundletool |
| Notarize | notarytool | N/A |
| Upload to store | altool, App Store Connect API | Google Play API |

---

## Proposed Database Schema

### Signing Credentials Tables

```sql
-- iOS/macOS Certificates
CREATE TABLE signing_certificates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- 'apple_development', 'apple_distribution', 'developer_id_application', 'developer_id_installer'
    certificate_type TEXT NOT NULL,
    team_id TEXT NOT NULL,
    team_name TEXT,
    serial_number TEXT NOT NULL UNIQUE,
    common_name TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    -- Encrypted with AES-256-GCM
    p12_encrypted BLOB NOT NULL,
    p12_nonce TEXT NOT NULL,
    p12_password_encrypted BLOB NOT NULL,
    p12_password_nonce TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- iOS/macOS Provisioning Profiles
CREATE TABLE provisioning_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    uuid TEXT NOT NULL UNIQUE,
    -- 'development', 'adhoc', 'appstore', 'enterprise'
    profile_type TEXT NOT NULL,
    -- 'ios', 'macos', 'tvos', 'catalyst'
    platform TEXT NOT NULL,
    bundle_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    -- JSON array of certificate serial numbers
    certificates TEXT NOT NULL,
    -- JSON array of device UDIDs (for dev/adhoc)
    devices TEXT,
    -- JSON object of entitlements
    entitlements TEXT,
    expires_at TEXT NOT NULL,
    -- Raw profile data
    profile_data BLOB NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Android Keystores
CREATE TABLE android_keystores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_alias TEXT NOT NULL,
    key_algorithm TEXT NOT NULL DEFAULT 'RSA',
    key_size INTEGER NOT NULL DEFAULT 2048,
    validity_years INTEGER NOT NULL DEFAULT 25,
    expires_at TEXT,
    sha1_fingerprint TEXT NOT NULL,
    sha256_fingerprint TEXT NOT NULL,
    -- Encrypted keystore file
    keystore_encrypted BLOB NOT NULL,
    keystore_nonce TEXT NOT NULL,
    store_password_encrypted BLOB NOT NULL,
    store_password_nonce TEXT NOT NULL,
    key_password_encrypted BLOB NOT NULL,
    key_password_nonce TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- App Store Connect API Keys
CREATE TABLE appstore_connect_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_id TEXT NOT NULL UNIQUE,
    issuer_id TEXT NOT NULL,
    -- Encrypted .p8 key content
    private_key_encrypted BLOB NOT NULL,
    private_key_nonce TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Google Play Service Accounts
CREATE TABLE google_play_credentials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- Client email from service account JSON
    client_email TEXT NOT NULL,
    -- Encrypted service account JSON
    credentials_encrypted BLOB NOT NULL,
    credentials_nonce TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- macOS Notarization Credentials
CREATE TABLE notarization_credentials (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    -- For notarytool authentication
    apple_id TEXT,
    app_specific_password_encrypted BLOB,
    app_specific_password_nonce TEXT,
    -- Alternative: use App Store Connect API key
    appstore_connect_key_id TEXT REFERENCES appstore_connect_keys(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_certificates_team ON signing_certificates(team_id);
CREATE INDEX idx_certificates_type ON signing_certificates(certificate_type);
CREATE INDEX idx_profiles_bundle ON provisioning_profiles(bundle_id);
CREATE INDEX idx_profiles_team ON provisioning_profiles(team_id);
CREATE INDEX idx_keystores_fingerprint ON android_keystores(sha256_fingerprint);
```

---

## Proposed CLI Commands

### Certificate Management

```bash
# iOS/macOS Certificates
oore signing cert add --p12 /path/to/cert.p12 --password $CERT_PASSWORD
oore signing cert list
oore signing cert show <cert-id>
oore signing cert delete <cert-id>
oore signing cert export <cert-id> --output /path/to/cert.p12

# Provisioning Profiles
oore signing profile add /path/to/profile.mobileprovision
oore signing profile list [--bundle-id <id>] [--type <type>]
oore signing profile show <profile-id>
oore signing profile delete <profile-id>
oore signing profile fetch --bundle-id <id> --type <type>  # via App Store Connect API

# Android Keystores
oore signing keystore add --keystore /path/to/keystore.jks --alias <alias>
oore signing keystore create --alias <alias> --validity 25 --output /path/to/keystore.jks
oore signing keystore list
oore signing keystore show <keystore-id>
oore signing keystore delete <keystore-id>
oore signing keystore verify <keystore-id>

# App Store Connect API Keys
oore signing asc-key add --key-id <id> --issuer-id <id> --p8 /path/to/key.p8
oore signing asc-key list
oore signing asc-key delete <key-id>

# Google Play Credentials
oore signing google-play add --service-account /path/to/service-account.json
oore signing google-play list
oore signing google-play delete <cred-id>
```

### Build & Sign

```bash
# iOS
oore build ios --repo <repo-id> --scheme <scheme> --export-method appstore
oore build ios --repo <repo-id> --scheme <scheme> --export-method adhoc

# Android
oore build android --repo <repo-id> --keystore <keystore-id> --build-type release
oore build android --repo <repo-id> --keystore <keystore-id> --build-type release --aab

# macOS
oore build macos --repo <repo-id> --scheme <scheme> --distribution developer-id
oore build macos --repo <repo-id> --scheme <scheme> --distribution app-store
```

---

## Proposed API Endpoints

### Certificate Management

```
POST   /api/signing/certificates          # Upload certificate
GET    /api/signing/certificates          # List certificates
GET    /api/signing/certificates/:id      # Get certificate details
DELETE /api/signing/certificates/:id      # Delete certificate

POST   /api/signing/profiles              # Upload provisioning profile
GET    /api/signing/profiles              # List profiles
GET    /api/signing/profiles/:id          # Get profile details
DELETE /api/signing/profiles/:id          # Delete profile
POST   /api/signing/profiles/fetch        # Fetch from App Store Connect

POST   /api/signing/keystores             # Upload Android keystore
GET    /api/signing/keystores             # List keystores
GET    /api/signing/keystores/:id         # Get keystore details
DELETE /api/signing/keystores/:id         # Delete keystore
POST   /api/signing/keystores/create      # Create new keystore
POST   /api/signing/keystores/:id/verify  # Verify credentials

POST   /api/signing/asc-keys              # Add App Store Connect API key
GET    /api/signing/asc-keys              # List API keys
DELETE /api/signing/asc-keys/:id          # Delete API key

POST   /api/signing/google-play           # Add Google Play credentials
GET    /api/signing/google-play           # List credentials
DELETE /api/signing/google-play/:id       # Delete credentials
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Database schema for all credential types
2. Encryption/decryption for stored credentials
3. Basic CRUD operations via CLI and API
4. Credential validation (verify certificates, keystores)

### Phase 2: iOS/macOS Signing
1. Keychain management (create, import, cleanup)
2. Certificate and profile storage
3. ExportOptions.plist generation
4. xcodebuild integration
5. IPA export

### Phase 3: Android Signing
1. Keystore storage and management
2. key.properties generation
3. Gradle integration
4. APK/AAB signing
5. bundletool integration

### Phase 4: Distribution
1. App Store Connect API integration (upload, TestFlight)
2. Google Play API integration (upload, tracks)
3. macOS notarization (notarytool, stapling)

### Phase 5: Advanced Features
1. Automatic certificate renewal reminders
2. Profile expiration monitoring
3. App Store Connect provisioning profile fetch/create
4. Multi-team support

---

## Security Considerations

### Credential Storage
- All sensitive data encrypted with AES-256-GCM
- Encryption key from environment variable
- Never log passwords or key contents
- Secure deletion of temporary files

### Keychain Security
- Create ephemeral keychains per build
- Random keychain passwords
- Set partition list for codesign access
- Delete keychain after build completes

### API Security
- Require authentication for all signing endpoints
- Audit log for credential access
- Rate limiting on sensitive operations
- No credential content in API responses (only metadata)

---

## Key External Dependencies

### macOS Tools (Built-in)
- `security` - Keychain management
- `codesign` - Code signing
- `xcodebuild` - Build and archive
- `xcrun notarytool` - Notarization
- `xcrun stapler` - Ticket stapling
- `hdiutil` - DMG creation

### Java Tools (Requires JDK)
- `keytool` - Keystore management
- `jarsigner` - JAR/APK signing (legacy)

### Android SDK Tools
- `apksigner` - APK signing
- `bundletool` - AAB processing
- `zipalign` - APK alignment

### Optional (via API)
- App Store Connect API - Certificate/profile management, uploads
- Google Play Developer API - App uploads

---

## References

All sources are cited in the individual research documents:
- [01-ios-code-signing.md](./01-ios-code-signing.md)
- [02-android-code-signing.md](./02-android-code-signing.md)
- [03-macos-code-signing.md](./03-macos-code-signing.md)
- [04-codemagic-cli-analysis.md](./04-codemagic-cli-analysis.md)
