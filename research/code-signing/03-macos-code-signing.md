# macOS Code Signing Research

> Last Updated: 2026-01-28
> Status: Comprehensive research for Oore CI/CD implementation

## Table of Contents
1. [Overview](#overview)
2. [Distribution Methods](#distribution-methods)
3. [Certificate Types](#certificate-types)
4. [Notarization](#notarization)
5. [Hardened Runtime](#hardened-runtime)
6. [Entitlements](#entitlements)
7. [Command-Line Tools](#command-line-tools)
8. [Implementation Recommendations](#implementation-recommendations)

---

## Overview

macOS code signing serves multiple purposes:
- **Gatekeeper verification**: Ensures apps are from identified developers
- **System integrity**: Protects against tampering
- **Notarization**: Apple's malware scan for non-App Store apps
- **Capabilities**: Enables features like iCloud, push notifications

**Source**: [Signing Mac Software with Developer ID - Apple](https://developer.apple.com/developer-id/)

### macOS vs iOS Signing

| Aspect | macOS | iOS |
|--------|-------|-----|
| Distribution outside store | Yes (Developer ID) | No (except Enterprise) |
| Notarization | Required (since 10.15) | Not applicable |
| Hardened Runtime | Required for notarization | Default behavior |
| Sideloading | Possible (with warnings) | Not possible |

---

## Distribution Methods

### Mac App Store

**Requirements**:
- Apple Distribution certificate
- Mac App Store provisioning profile
- Passes App Review
- Sandbox required

**Certificate**: `Apple Distribution` (replaces legacy `Mac App Distribution`)

**Provisioning Profile**: `MAC_APP_STORE` type

**Source**: [Distributing Software on macOS - Apple](https://developer.apple.com/macos/distribution/)

### Developer ID (Direct Distribution)

**Requirements**:
- Developer ID Application certificate
- Developer ID Installer certificate (for .pkg)
- Notarization required (since macOS 10.15 Catalina)
- No provisioning profile needed

**Use cases**:
- Website downloads
- Enterprise distribution
- Alternative stores

**Source**: [Developer ID - Apple](https://developer.apple.com/developer-id/)

### Key Differences

| Aspect | Mac App Store | Developer ID |
|--------|---------------|--------------|
| Certificate | Apple Distribution | Developer ID Application |
| Provisioning Profile | Required | Not required |
| Notarization | Not needed (implicit) | Required |
| Sandbox | Required | Optional |
| App Review | Required | Not required |
| Updates | App Store handles | Developer handles |

**Source**: [macOS Distribution - Apple](https://developer.apple.com/macos/distribution/)

---

## Certificate Types

### Current macOS Certificates

| Certificate | Purpose | Distribution Method |
|-------------|---------|---------------------|
| **Apple Development** | Development/testing | N/A |
| **Apple Distribution** | Mac App Store | App Store |
| **Developer ID Application** | Sign .app bundles | Direct |
| **Developer ID Installer** | Sign .pkg installers | Direct |

**Source**: [Certificates - Apple Developer](https://developer.apple.com/support/certificates/)

### Legacy Certificates (Still Supported)

| Legacy | Replaced By |
|--------|-------------|
| Mac Development | Apple Development |
| Mac App Distribution | Apple Distribution |
| Mac Installer Distribution | Apple Distribution |
| 3rd Party Mac Developer Application | Apple Distribution |
| 3rd Party Mac Developer Installer | Apple Distribution |

**Source**: [Apple Developer Forums - Certificates](https://developer.apple.com/forums/thread/713161)

### Requesting Developer ID Certificates

Only the **Account Holder** can generate Developer ID certificates:

1. Go to Certificates, Identifiers & Profiles
2. Click + to add new certificate
3. Select Developer ID Application or Developer ID Installer
4. Upload CSR (Certificate Signing Request)
5. Download and install certificate

**Source**: [Developer ID - Apple](https://developer.apple.com/developer-id/)

---

## Notarization

### What is Notarization?

Apple's automated malware scanning service for apps distributed outside the Mac App Store.

**When required**: All apps for macOS 10.15+ distributed outside App Store

**Source**: [Notarizing macOS Software - Apple](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

### Notarization Requirements

1. **Developer ID signature**: Must be signed with Developer ID certificate
2. **Hardened Runtime**: Must be enabled
3. **Secure timestamp**: Must include timestamp in signature
4. **No prohibited code**: Passes Apple's malware scan

### Supported File Types

- .app (application bundles)
- .pkg (installer packages)
- .dmg (disk images)
- .zip (containing apps)

### notarytool (Current Method)

**Since Xcode 13** - replaces the deprecated `altool`.

```bash
# Store credentials in keychain (one-time setup)
xcrun notarytool store-credentials "notary-profile" \
  --apple-id "developer@example.com" \
  --team-id "XXXXXXXXXX" \
  --password "app-specific-password"

# Submit for notarization
xcrun notarytool submit MyApp.dmg \
  --keychain-profile "notary-profile" \
  --wait

# Check status
xcrun notarytool log <submission-id> \
  --keychain-profile "notary-profile"

# Get history
xcrun notarytool history \
  --keychain-profile "notary-profile"
```

**Source**: [Customizing the Notarization Workflow - Apple](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)

### Stapling

**What it does**: Attaches the notarization ticket to the app/dmg for offline verification.

```bash
xcrun stapler staple MyApp.dmg
# or
xcrun stapler staple MyApp.app
```

**Benefits**:
- Works without network
- Gatekeeper can verify offline
- Recommended for all notarized software

**Source**: [Complete Guide to Notarizing macOS Apps](https://tonygo.tech/blog/2023/notarization-for-macos-app-with-notarytool)

### Verification

```bash
# Check if app is notarized
spctl -a -vvv -t install MyApp.app
# Look for "source=Notarized Developer ID"

# Check staple status
xcrun stapler validate MyApp.dmg
```

**Source**: [Notarize a Command Line Tool](https://scriptingosx.com/2021/07/notarize-a-command-line-tool-with-notarytool/)

### Important Note (January 2026)

Notarization submissions have experienced delays (24-72+ hours) despite Apple's status page showing operational.

**Source**: [Apple Developer Forums - Notarization](https://developer.apple.com/forums/tags/notarization)

---

## Hardened Runtime

### What is Hardened Runtime?

Security protections that:
- Prevent code injection
- Block DLL hijacking
- Protect process memory

**Required for**: Notarization

**Source**: [Configuring the Hardened Runtime - Apple](https://developer.apple.com/documentation/xcode/configuring-the-hardened-runtime)

### Enabling Hardened Runtime

**Via codesign**:
```bash
codesign --force --timestamp --options runtime \
  --sign "Developer ID Application: Company (TEAM_ID)" \
  MyApp.app
```

**Via Xcode**:
1. Select target
2. Signing & Capabilities
3. Enable "Hardened Runtime"

### Hardened Runtime Entitlements

If your app needs functionality blocked by hardened runtime, use entitlements:

| Entitlement | Purpose |
|-------------|---------|
| `com.apple.security.cs.allow-jit` | JIT compilation (safer) |
| `com.apple.security.cs.allow-unsigned-executable-memory` | Writable+executable memory |
| `com.apple.security.cs.disable-library-validation` | Load unsigned libraries |
| `com.apple.security.cs.allow-dyld-environment-variables` | DYLD_* environment vars |
| `com.apple.security.cs.disable-executable-page-protection` | Disable code page protection |

**Source**: [Security Entitlements - Apple](https://developer.apple.com/documentation/bundleresources/security-entitlements)

### JIT vs Unsigned Memory

| Entitlement | Security Level | Use Case |
|-------------|----------------|----------|
| `allow-jit` | Higher | JavaScript engines, dynamic languages |
| `allow-unsigned-executable-memory` | Lower | Legacy code, DRM |

**Recommendation**: Prefer `allow-jit` when possible.

**Source**: [Allow Execution of JIT-compiled Code - Apple](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.cs.allow-jit)

---

## Entitlements

### Entitlements File Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

### Common macOS Entitlements

| Category | Entitlement Key | Purpose |
|----------|-----------------|---------|
| **Sandbox** | `com.apple.security.app-sandbox` | Enable sandbox (required for App Store) |
| **Network** | `com.apple.security.network.client` | Outgoing connections |
| **Network** | `com.apple.security.network.server` | Incoming connections |
| **Files** | `com.apple.security.files.user-selected.read-write` | User-selected files |
| **Files** | `com.apple.security.files.downloads.read-write` | Downloads folder |
| **Hardware** | `com.apple.security.device.camera` | Camera access |
| **Hardware** | `com.apple.security.device.microphone` | Microphone access |
| **Apple Events** | `com.apple.security.automation.apple-events` | Send Apple Events |

**Source**: [Hardened Runtime - Eclectic Light](https://eclecticlight.co/2021/01/07/notarization-the-hardened-runtime/)

### Extracting Entitlements

```bash
# From signed app
codesign -d --entitlements :- MyApp.app

# From provisioning profile (macOS)
security cms -D -i embedded.provisionprofile | plutil -extract Entitlements xml1 -o - -
```

---

## Command-Line Tools

### codesign

```bash
# Sign app bundle
codesign --force --deep --timestamp --options runtime \
  --entitlements entitlements.plist \
  --sign "Developer ID Application: Company Name (TEAM_ID)" \
  MyApp.app

# Sign with specific keychain
codesign --force --deep --timestamp --options runtime \
  --keychain build.keychain \
  --sign "Developer ID Application: Company Name (TEAM_ID)" \
  MyApp.app

# Verify signature
codesign --verify --verbose=4 MyApp.app

# Display signature details
codesign -dv --verbose=4 MyApp.app

# Check entitlements
codesign -d --entitlements :- MyApp.app
```

**Key flags**:
- `--force`: Replace existing signature
- `--deep`: Sign nested bundles (use carefully)
- `--timestamp`: Include Apple timestamp server
- `--options runtime`: Enable hardened runtime
- `--entitlements`: Specify entitlements file

**Source**: [codesign Man Page](https://keith.github.io/xcode-man-pages/codesign.1.html)

### productsign

Signs installer packages (.pkg):

```bash
productsign --sign "Developer ID Installer: Company Name (TEAM_ID)" \
  --timestamp \
  MyApp-unsigned.pkg \
  MyApp.pkg
```

### pkgbuild and productbuild

Create installer packages:

```bash
# Create component package
pkgbuild --root /path/to/payload \
  --identifier "com.company.myapp" \
  --version "1.0" \
  --install-location "/Applications" \
  MyApp-component.pkg

# Create product archive
productbuild --distribution distribution.xml \
  --resources resources/ \
  --package-path . \
  MyApp-unsigned.pkg
```

### Complete Notarization Workflow

```bash
#!/bin/bash
set -e

APP_PATH="MyApp.app"
DMG_PATH="MyApp.dmg"
IDENTITY="Developer ID Application: Company Name (TEAM_ID)"
INSTALLER_IDENTITY="Developer ID Installer: Company Name (TEAM_ID)"
NOTARY_PROFILE="notary-profile"

# 1. Sign the app
codesign --force --deep --timestamp --options runtime \
  --sign "$IDENTITY" "$APP_PATH"

# 2. Verify signature
codesign --verify --verbose=4 "$APP_PATH"

# 3. Create DMG
hdiutil create -volname "MyApp" -srcfolder "$APP_PATH" \
  -ov -format UDZO "$DMG_PATH"

# 4. Sign DMG (optional but recommended)
codesign --force --timestamp --sign "$IDENTITY" "$DMG_PATH"

# 5. Submit for notarization
xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "$NOTARY_PROFILE" \
  --wait

# 6. Staple the ticket
xcrun stapler staple "$DMG_PATH"

# 7. Verify notarization
spctl -a -vvv -t install "$APP_PATH"
```

**Source**: [Mac App Notarization Workflow](https://christiantietze.de/posts/2022/07/mac-app-notarization-workflow-in-2022/)

---

## Implementation Recommendations

### For Oore CI/CD Platform

1. **Certificate Storage**
   - Same as iOS (encrypted .p12)
   - Track certificate expiration
   - Separate Developer ID Application and Installer certificates

2. **Notarization Workflow**
   ```
   1. Sign app with Developer ID + hardened runtime
   2. Create DMG/ZIP container
   3. Sign container
   4. Submit to notarization service
   5. Wait for completion (may take minutes to hours)
   6. Staple ticket
   7. Verify notarization
   ```

3. **Credential Storage**
   - Store App Store Connect API key for notarytool
   - Store app-specific password (alternative)
   - Store team ID

4. **Database Schema Additions**
   ```sql
   CREATE TABLE macos_notarization_credentials (
     id TEXT PRIMARY KEY,
     team_id TEXT NOT NULL,
     -- Option 1: App Store Connect API Key
     api_key_id TEXT,
     api_issuer_id TEXT,
     api_key_encrypted BLOB,
     api_key_nonce TEXT,
     -- Option 2: App-specific password
     apple_id TEXT,
     app_specific_password_encrypted BLOB,
     app_specific_password_nonce TEXT,
     created_at TEXT NOT NULL
   );
   ```

5. **Key Differences from iOS**
   - No provisioning profiles for Developer ID distribution
   - Notarization is asynchronous (can take time)
   - Need to create DMG/ZIP for distribution
   - Hardened runtime must be explicitly enabled

6. **Entitlements Handling**
   - Store entitlements template per app
   - Merge with build-time requirements
   - Validate entitlements before signing

---

## References

1. [Signing Mac Software with Developer ID - Apple](https://developer.apple.com/developer-id/)
2. [Notarizing macOS Software - Apple](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
3. [Configuring the Hardened Runtime - Apple](https://developer.apple.com/documentation/xcode/configuring-the-hardened-runtime)
4. [Customizing the Notarization Workflow - Apple](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
5. [Resolving Common Notarization Issues - Apple](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
6. [codesign Man Page](https://keith.github.io/xcode-man-pages/codesign.1.html)
7. [notarytool Man Page](https://keith.github.io/xcode-man-pages/notarytool.1.html)
8. [Code Signing for macOS - Codemagic](https://docs.codemagic.io/yaml-code-signing/signing-macos/)
9. [macOS Distribution Overview - Apple Gist](https://gist.github.com/rsms/929c9c2fec231f0cf843a1a746a416f5)
10. [Mac App Notarization Workflow 2022](https://christiantietze.de/posts/2022/07/mac-app-notarization-workflow-in-2022/)
11. [Notarize a Command Line Tool](https://scriptingosx.com/2021/07/notarize-a-command-line-tool-with-notarytool/)
12. [Security Entitlements - Apple](https://developer.apple.com/documentation/bundleresources/security-entitlements)
