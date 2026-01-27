# iOS Code Signing Research

> Last Updated: 2026-01-28
> Status: Comprehensive research for Oore CI/CD implementation

## Table of Contents
1. [Overview](#overview)
2. [Certificate Types](#certificate-types)
3. [Provisioning Profiles](#provisioning-profiles)
4. [Distribution Methods](#distribution-methods)
5. [Keychain Management](#keychain-management)
6. [Command-Line Tools](#command-line-tools)
7. [App Store Connect API](#app-store-connect-api)
8. [Flutter-Specific Considerations](#flutter-specific-considerations)
9. [Implementation Recommendations](#implementation-recommendations)

---

## Overview

iOS code signing is a mandatory security mechanism that:
- Confirms the code cannot be modified after signing
- Identifies the developer/organization
- Authorizes apps to run on specific devices or be distributed via App Store

**Source**: [iOS Code Signing Breakdown - Medium](https://blorenzop.medium.com/ios-code-signing-breakdown-766d95c89f20)

### Core Components

| Component | Purpose |
|-----------|---------|
| **Signing Certificate** | Developer identity (public/private key pair) |
| **Provisioning Profile** | Links certificate, app ID, and authorized devices |
| **Entitlements** | App capabilities (push notifications, app groups, etc.) |
| **Private Key** | Signs the code (must be kept secure) |

---

## Certificate Types

### Current Certificate Types (2025+)

Apple has consolidated certificate types. Use these for new projects:

| Certificate | Purpose | Who Can Request |
|-------------|---------|-----------------|
| **Apple Development** | Development/debugging on devices | Any team member |
| **Apple Distribution** | App Store, TestFlight, Ad Hoc, Enterprise | Account Holder, Admin |

**Source**: [Apple Developer Certificates Guide](https://aso.dev/app-store-connect/developer-certificates/)

### Legacy Certificate Types (Still Supported)

| Certificate | Replaced By |
|-------------|-------------|
| iOS Development | Apple Development |
| iOS Distribution | Apple Distribution |
| Mac App Distribution | Apple Distribution |
| Mac Installer Distribution | Apple Distribution |

**Source**: [Apple Certificates Support](https://developer.apple.com/support/certificates/)

### Push Notification Authentication

Two methods available:

| Method | File Type | Expiration | Scope |
|--------|-----------|------------|-------|
| **Token-based (Recommended)** | .p8 key | Never expires | All apps in account |
| **Certificate-based (Legacy)** | .p12 certificate | 1 year | Single app |

**2025 Recommendation**: Use p8 keys for push notifications. They don't expire, work across multiple apps, and are easier to manage in CI/CD.

**Source**: [APNs p8 vs p12 - Medium](https://medium.com/@anshikapathak06/p8-vs-p12-in-ios-what-you-really-need-to-know-8d0de1364608)

### APNs 2025 Server Certificate Update

Apple updated APNs server certificates to USERTrust RSA Certification Authority (SHA-2 Root):
- **Sandbox**: January 20, 2025
- **Production**: February 24, 2025

Apps must update their Trust Store to include the new certificate.

**Source**: [Apple APNs Certificate Update](https://developer.apple.com/news/upcoming-requirements/?id=02242025a)

---

## Provisioning Profiles

### Profile Types

| Type | Use Case | Device Limit | App Review |
|------|----------|--------------|------------|
| **Development** | Testing on registered devices | 100 devices | No |
| **Ad Hoc** | Beta testing, QA, demos | 100 devices | No |
| **App Store** | App Store/TestFlight distribution | Unlimited | Yes |
| **Enterprise/In-House** | Internal corporate distribution | Unlimited | No |

**Source**: [iOS Provisioning Profiles Explained](https://getupdraft.com/blog/ios-code-signing-development-and-distribution-prov)

### App ID Types

| Type | Bundle ID Format | Use Case |
|------|------------------|----------|
| **Explicit** | `com.company.appname` | Production apps, specific capabilities |
| **Wildcard** | `com.company.*` | Development, multiple apps |

**Note**: Wildcard App IDs cannot use certain capabilities (Push Notifications, App Groups, etc.)

**Source**: [Demystifying iOS App Provisioning](https://www.bounteous.com/insights/2018/08/08/demystifying-ios-app-provisioning-process/)

### Profile Validity

- **Standard profiles**: Valid for 1 year
- **Offline provisioning profiles**: Valid for 7 days (new in 2025)
- Profiles must be regenerated if certificate expires or is revoked

**Source**: [Apple Provisioning Profile Updates](https://developer.apple.com/help/account/provisioning-profiles/provisioning-profile-updates/)

### Provisioning Profile File Format

The `.mobileprovision` file is an XML plist embedded in PKCS#7 (CMS) format.

**To extract contents**:
```bash
security cms -D -i Profile.mobileprovision -o Profile.plist
```

**File locations**:
- iOS: `MyApp.app/embedded.mobileprovision`
- macOS: `MyApp.app/Contents/embedded.provisionprofile`

**Source**: [Extracting Stuff from Provisioning Profiles](https://maniak-dobrii.com/extracting-stuff-from-provisioning-profile/)

---

## Distribution Methods

### App Store Distribution

**Requirements**:
- Apple Developer Program membership ($99/year)
- Apple Distribution certificate
- App Store provisioning profile (explicit App ID)
- App passes Apple Review

**Process**:
1. Archive app with distribution certificate
2. Export with App Store method
3. Upload to App Store Connect (via Xcode, altool, or API)
4. Submit for review

### TestFlight Distribution

**Two types**:
1. **Internal Testing**: Up to 100 internal testers, no review required
2. **External Testing**: Up to 10,000 testers, requires Beta App Review

**Source**: [iOS App Distribution Guide 2025](https://foresightmobile.com/blog/ios-app-distribution-guide-2025)

### Ad Hoc Distribution

**Requirements**:
- Device UDIDs must be registered in Developer Portal
- Ad Hoc provisioning profile with device list
- 100 device limit per device type per year

**Use cases**: QA testing, client demos, limited beta

### Enterprise Distribution

**Requirements**:
- Apple Developer Enterprise Program ($299/year)
- Rigorous approval process
- For internal corporate use only

**Key features**:
- No device registration required
- No App Review
- 2 active distribution certificates allowed simultaneously
- Must be hosted by organization (not on App Store)

**Source**: [Apple Developer Enterprise Program](https://developer.apple.com/programs/enterprise/)

---

## Keychain Management

### macOS Security Command

The `security` command manages keychains and certificates:

```bash
# Create a new keychain
security create-keychain -p "password" build.keychain

# Set as default
security default-keychain -s build.keychain

# Unlock keychain
security unlock-keychain -p "password" build.keychain

# Import certificate
security import certificate.p12 -k build.keychain -P "cert_password" \
  -T /usr/bin/codesign -T /usr/bin/productsign

# Set partition list (required for CI/CD since macOS 10.12)
security set-key-partition-list -S apple-tool:,apple:,codesign: \
  -s -k "password" build.keychain

# List certificates
security find-identity -v -p codesigning build.keychain
```

**Source**: [macOS Security Command - SS64](https://ss64.com/mac/security-export.html)

### Partition List (Critical for CI/CD)

Since macOS 10.12 Sierra, the partition list controls which applications can access keychain items without prompts.

**Required command after importing certificates**:
```bash
security set-key-partition-list -S apple-tool:,apple: -s -k <keychain_password> <keychain_name>
```

Without this, `codesign` will hang waiting for user approval.

**Source**: [Why is security set-key-partition-list needed?](https://developer.apple.com/forums/thread/666107)

### CI/CD Best Practice

Create an ephemeral keychain for each build:
1. Generate random password
2. Create temporary keychain
3. Import certificates
4. Set partition list
5. Sign code
6. Delete keychain after build

**Source**: [Creating a Temporary Keychain for Build Systems](https://byteable.medium.com/creating-a-temporary-keychain-for-your-build-system-e598628c65fd)

---

## Command-Line Tools

### codesign

Signs and verifies code signatures:

```bash
# Sign an app
codesign --force --deep --timestamp --options runtime \
  --sign "Apple Distribution: Company Name (TEAM_ID)" \
  MyApp.app

# Verify signature
codesign -vv -d MyApp.app

# Display signature info
codesign -dv --verbose=4 MyApp.app
```

**Key options**:
- `--force`: Replace existing signature
- `--deep`: Sign nested code
- `--timestamp`: Include secure timestamp
- `--options runtime`: Enable hardened runtime (required for notarization)
- `-s "identity"`: Signing identity (certificate name or SHA-1)

**Source**: [CodeSign Man Page - SS64](https://ss64.com/mac/codesign.html)

### xcodebuild

Archives and exports iOS apps:

```bash
# Create archive
xcodebuild archive \
  -workspace MyApp.xcworkspace \
  -scheme MyScheme \
  -configuration Release \
  -archivePath ./build/MyApp.xcarchive \
  -destination 'generic/platform=iOS'

# Export IPA
xcodebuild -exportArchive \
  -archivePath ./build/MyApp.xcarchive \
  -exportPath ./build/output \
  -exportOptionsPlist ExportOptions.plist
```

**Source**: [How to Build iOS App Archive via Command Line](https://www.andrewhoog.com/posts/how-to-build-an-ios-app-archive-via-command-line/)

### ExportOptions.plist

Configuration for archive export:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>XXXXXXXXXX</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>Apple Distribution</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.company.app</key>
        <string>App Store Profile Name</string>
    </dict>
    <key>uploadSymbols</key>
    <true/>
    <key>destination</key>
    <string>upload</string>
</dict>
</plist>
```

**Available method values**:
- `app-store`: App Store/TestFlight
- `ad-hoc`: Ad Hoc distribution
- `enterprise`: Enterprise distribution
- `development`: Development builds
- `validation`: Validate without export

**Source**: [xcodebuild exportOptionsPlist Keys](https://gist.github.com/DanBodnar/020e7a10bc286dc3e5946e7ccc20dd7b)

### altool (App Upload)

Upload to App Store Connect:

```bash
# Using API key (recommended)
xcrun altool --upload-package MyApp.ipa \
  --type ios \
  --apiKey YOUR_KEY_ID \
  --apiIssuer YOUR_ISSUER_ID

# Store API key in standard location
mkdir -p ~/.appstoreconnect/private_keys/
cp AuthKey_XXXXXXXX.p8 ~/.appstoreconnect/private_keys/
```

**Important**: Starting 2026, Xcode 14+ is required for uploads.

**Source**: [Apple Upload Builds Documentation](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

---

## App Store Connect API

### Authentication

The API uses JWT tokens signed with App Store Connect API keys.

**JWT Token Requirements**:
- Algorithm: ES256
- Issuer ID: From App Store Connect
- Key ID: From API key
- Audience: `appstoreconnect-v1`
- Expiration: Max 20 minutes

**Source**: [App Store Connect API Token Generation](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests)

### Provisioning Profile Management

The API can:
- List/create/delete provisioning profiles
- List/create/delete certificates
- Manage bundle IDs
- Register devices

**Endpoint for profiles**:
```
GET https://api.appstoreconnect.apple.com/v1/profiles
```

Profile content is base64 encoded in `profileContent` field.

**Source**: [App Store Connect API Overview](https://developer.apple.com/app-store-connect/api/)

### API Key Setup

1. Go to App Store Connect > Users and Access > Keys
2. Generate API Key with appropriate permissions
3. Download .p8 file (only available once)
4. Note Key ID and Issuer ID

**Required permissions for CI/CD**:
- App Manager or Developer role
- Access to certificates, identifiers, and profiles

---

## Flutter-Specific Considerations

### flutter build ipa

```bash
# With automatic signing
flutter build ipa

# With manual signing
flutter build ipa --export-options-plist=ExportOptions.plist
```

**Source**: [Flutter iOS Deployment](https://docs.flutter.dev/deployment/ios)

### Manual Build Process

For more control, use xcodebuild directly:

```bash
flutter clean
flutter build ios --release

xcodebuild -workspace ios/Runner.xcworkspace \
  -scheme Runner \
  -sdk iphoneos \
  -configuration Release \
  archive -archivePath build/Runner.xcarchive

xcodebuild -exportArchive \
  -archivePath build/Runner.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath build/output
```

**Source**: [Flutter build IPA with export-options-plist](https://github.com/flutter/flutter/issues/113977)

### ExportOptions.plist Location

Generate by manually exporting from Xcode once, then copy the generated plist.

---

## Implementation Recommendations

### For Oore CI/CD Platform

1. **Keychain Management**
   - Create ephemeral keychain per build
   - Use unique random password
   - Set partition list for codesign access
   - Clean up after build

2. **Certificate Storage**
   - Store .p12 files encrypted (AES-256-GCM)
   - Store certificate passwords separately
   - Track certificate expiration dates

3. **Provisioning Profile Management**
   - Option 1: Store profiles directly (simpler)
   - Option 2: Fetch via App Store Connect API (always current)

4. **Signing Workflow**
   ```
   1. Create temporary keychain
   2. Import certificate(s)
   3. Set partition list
   4. Copy provisioning profile(s)
   5. Generate ExportOptions.plist
   6. Run xcodebuild archive
   7. Run xcodebuild -exportArchive
   8. Clean up keychain
   ```

5. **Database Schema Additions**
   ```sql
   CREATE TABLE signing_certificates (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     type TEXT NOT NULL, -- 'apple_development', 'apple_distribution'
     team_id TEXT NOT NULL,
     serial_number TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     p12_encrypted BLOB NOT NULL,
     p12_nonce TEXT NOT NULL,
     created_at TEXT NOT NULL
   );

   CREATE TABLE provisioning_profiles (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     type TEXT NOT NULL, -- 'development', 'adhoc', 'appstore', 'enterprise'
     bundle_id TEXT NOT NULL,
     team_id TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     profile_data BLOB NOT NULL,
     created_at TEXT NOT NULL
   );
   ```

---

## References

1. [Apple Developer Certificates Support](https://developer.apple.com/support/certificates/)
2. [iOS Code Signing - Codemagic Docs](https://docs.codemagic.io/yaml-code-signing/signing-ios/)
3. [App Store Connect API Documentation](https://developer.apple.com/documentation/appstoreconnectapi)
4. [Flutter iOS Deployment Guide](https://docs.flutter.dev/deployment/ios)
5. [Codemagic CLI Tools - GitHub](https://github.com/codemagic-ci-cd/cli-tools)
6. [How iOS Code Signing Works](https://www.impaktfull.com/blog/how-ios-code-signing-works-certificates-provisioning-profiles-private-keys)
7. [iOS App Distribution Guide 2025](https://foresightmobile.com/blog/ios-app-distribution-guide-2025)
8. [Apple Developer Program Comparison](https://developer.apple.com/support/compare-memberships/)
