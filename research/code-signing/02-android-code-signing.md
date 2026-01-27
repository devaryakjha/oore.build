# Android Code Signing Research

> Last Updated: 2026-01-28
> Status: Comprehensive research for Oore CI/CD implementation

## Table of Contents
1. [Overview](#overview)
2. [Key Concepts](#key-concepts)
3. [Keystore Management](#keystore-management)
4. [Play App Signing](#play-app-signing)
5. [APK vs AAB](#apk-vs-aab)
6. [Command-Line Tools](#command-line-tools)
7. [Gradle Configuration](#gradle-configuration)
8. [Google Play Developer API](#google-play-developer-api)
9. [Flutter-Specific Considerations](#flutter-specific-considerations)
10. [Implementation Recommendations](#implementation-recommendations)

---

## Overview

Android requires all apps to be digitally signed before installation. The signature:
- Identifies the developer
- Ensures app integrity (no tampering)
- Enables secure app updates (same signature required)

**Source**: [Android App Signing Guide](https://developer.android.com/studio/publish/app-signing)

### Key Differences from iOS

| Aspect | Android | iOS |
|--------|---------|-----|
| **Signing Authority** | Self-signed | Apple-issued certificates |
| **Certificate Management** | Local keystores | Apple Developer Portal |
| **Distribution Control** | Open (APK sideloading) | Controlled (App Store, Enterprise) |
| **Store Signing** | Google manages (Play App Signing) | Developer signs |

---

## Key Concepts

### Two-Key System (Play App Signing)

| Key | Owner | Purpose |
|-----|-------|---------|
| **App Signing Key** | Google | Signs APKs delivered to users |
| **Upload Key** | Developer | Signs AAB/APK before upload |

**Source**: [Use Play App Signing - Google](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)

### Keystore Components

| Component | Description |
|-----------|-------------|
| **Keystore file** | Binary container (.jks or .keystore) |
| **Store password** | Protects the keystore file |
| **Key alias** | Identifies a specific key in the keystore |
| **Key password** | Protects the specific key |
| **Certificate** | Public key + metadata |
| **Private key** | Signs the app (never shared) |

---

## Keystore Management

### Creating a Keystore

**Using keytool (recommended for CI/CD)**:
```bash
keytool -genkey -v \
  -keystore release-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias release-key \
  -storepass <store_password> \
  -keypass <key_password> \
  -dname "CN=Company Name, OU=Mobile, O=Company, L=City, ST=State, C=US"
```

**Source**: [Android Studio App Signing](https://developer.android.com/studio/publish/app-signing)

### Key Requirements

| Requirement | Value |
|-------------|-------|
| Algorithm | RSA |
| Key size | 2048 bits minimum |
| Validity | 25+ years recommended |
| Expiration | Must expire after October 22, 2033 |

**Source**: [Android App Signing Guide](https://developer.android.com/studio/publish/app-signing)

### Keystore File Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| **JKS** | .jks | Java KeyStore (legacy, still supported) |
| **PKCS12** | .p12, .keystore | Industry standard, recommended |

**Note**: Android Studio defaults to PKCS12 for new keystores.

### Extracting Certificate Information

```bash
# View certificate details
keytool -list -v -keystore release-keystore.jks -alias release-key

# Export certificate as PEM
keytool -export -rfc \
  -keystore release-keystore.jks \
  -alias release-key \
  -file certificate.pem
```

### SHA-1 and SHA-256 Fingerprints

Required for Google APIs (Maps, Sign-In, etc.):

```bash
keytool -list -v -keystore release-keystore.jks -alias release-key | grep SHA
```

**Source**: [Google Client Authentication](https://developers.google.com/android/guides/client-auth)

---

## Play App Signing

### What It Does

Google manages the app signing key:
1. Developer uploads AAB signed with **upload key**
2. Google verifies upload signature
3. Google generates APKs signed with **app signing key**
4. Users download APKs signed by Google

**Benefits**:
- App signing key never exposed
- Key loss doesn't lock you out
- Enables optimized APK delivery

**Source**: [Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)

### Enrollment Options

**For new apps**:
- Automatic (Google generates app signing key) - **Recommended**
- Use same key as another app
- Export and upload your own key

**For existing apps**:
- Upload from Java Keystore
- Upload from PKCS12
- Upload from PEM-encoded files

### Upload Key Management

**If upload key is lost or compromised**:
1. Generate new upload key
2. Export certificate: `keytool -export -rfc -keystore new-keystore.jks -alias upload -file upload_cert.pem`
3. Request reset in Play Console (Release > Setup > App signing)
4. Upload new certificate
5. Wait for Google approval

**Source**: [Android App Signing Guide](https://developer.android.com/studio/publish/app-signing)

### Key Upgrade Options

Play Console allows upgrading app signing keys:
- From 1024-bit to 2048-bit RSA
- To improve security posture

---

## APK vs AAB

### Android App Bundle (AAB)

**Required since August 2021** for new apps on Google Play.

| Aspect | AAB | APK |
|--------|-----|-----|
| File extension | .aab | .apk |
| Installable | No | Yes |
| Signing | Upload key | Full signing |
| Size optimization | Yes (dynamic delivery) | No |
| Google Play | Required | Deprecated for new apps |

**Source**: [Android App Bundle - Google](https://developer.android.com/guide/app-bundle)

### When to Use APK

- Ad-hoc testing
- Enterprise/internal distribution
- Alternative stores (not Google Play)
- Firebase App Distribution

---

## Command-Line Tools

### keytool

Java SDK tool for keystore management:

```bash
# Generate keystore
keytool -genkey -v -keystore my-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key

# List contents
keytool -list -v -keystore my-keystore.jks

# Change store password
keytool -storepasswd -keystore my-keystore.jks

# Change key password
keytool -keypasswd -alias my-key -keystore my-keystore.jks

# Delete entry
keytool -delete -alias old-key -keystore my-keystore.jks
```

### apksigner (Recommended)

Android SDK tool for APK signing:

```bash
# Sign APK
apksigner sign \
  --ks release-keystore.jks \
  --ks-key-alias release-key \
  --ks-pass pass:store_password \
  --key-pass pass:key_password \
  --out app-signed.apk \
  app-unsigned.apk

# Verify signature
apksigner verify --verbose app-signed.apk

# Show signature details
apksigner verify --print-certs app-signed.apk
```

**Source**: [apksigner - Android Developers](https://developer.android.com/studio/command-line/apksigner)

### jarsigner (Legacy)

Legacy tool, still works but apksigner is preferred:

```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore release-keystore.jks \
  -storepass store_password \
  -keypass key_password \
  app-unsigned.apk \
  release-key
```

### bundletool

Google's tool for working with AAB files:

```bash
# Generate signed APKs from AAB
bundletool build-apks \
  --bundle=app-release.aab \
  --output=app.apks \
  --ks=release-keystore.jks \
  --ks-pass=pass:store_password \
  --ks-key-alias=release-key \
  --key-pass=pass:key_password

# Generate universal APK (for testing)
bundletool build-apks \
  --bundle=app-release.aab \
  --output=app-universal.apks \
  --mode=universal \
  --ks=release-keystore.jks \
  --ks-pass=pass:store_password \
  --ks-key-alias=release-key \
  --key-pass=pass:key_password

# Extract APK from APKS
bundletool extract-apks \
  --apks=app.apks \
  --output-dir=./apks \
  --device-spec=device-spec.json

# Install on connected device
bundletool install-apks --apks=app.apks
```

**Source**: [bundletool - Android Developers](https://developer.android.com/tools/bundletool)

### zipalign

Aligns APK for optimized memory access (required before signing with jarsigner):

```bash
zipalign -v 4 app-unsigned.apk app-aligned.apk
```

**Note**: Not needed when using apksigner (it handles alignment).

---

## Gradle Configuration

### key.properties File

Create `android/key.properties` (do not commit):

```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=release-key
storeFile=/path/to/release-keystore.jks
```

### Groovy DSL (build.gradle)

```groovy
def keystorePropertiesFile = rootProject.file('key.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Source**: [Flutter Android Deployment](https://docs.flutter.dev/deployment/android)

### Kotlin DSL (build.gradle.kts) - Flutter 3.29+

```kotlin
import java.io.FileInputStream
import java.util.Properties

val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = keystoreProperties["storeFile"]?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

**Source**: [Kotlin DSL in Flutter 3.29](https://codewithandrea.com/articles/flutter-android-gradle-kts/)

---

## Google Play Developer API

### Overview

The Publishing API automates:
- App uploads (AAB/APK)
- Release management (tracks: internal, alpha, beta, production)
- Store listing updates
- Rollout management

**Source**: [Google Play Developer API](https://developers.google.com/android-publisher/)

### Service Account Setup

1. **Enable API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Enable "Google Play Android Developer API"

2. **Create Service Account**:
   - IAM & Admin > Service Accounts > Create
   - Download JSON key file

3. **Link to Play Console**:
   - Play Console > Setup > API access
   - Link Cloud project
   - Grant service account permissions

**Required permissions**:
- View app information
- Manage production releases
- Manage testing track releases
- Edit store listing, pricing & distribution

**Source**: [Deploying Android Apps - Bitrise](https://docs.bitrise.io/en/bitrise-ci/deploying/android-deployment/deploying-android-apps-to-bitrise-and-google-play.html)

### Important Limitations

1. **First upload must be manual**: The API cannot create new apps
2. **App must exist in Play Console**: API only works with existing apps
3. **Version code must increase**: Each upload needs higher version code

### Upload Endpoint

```
POST https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{packageName}/edits/{editId}/bundles
```

**Source**: [edits.bundles.upload - Google](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles/upload)

### 2025-2026 Changes

- Developer identity verification becoming mandatory
- Rolling out globally through 2026
- Applies even to apps distributed outside Play Store

**Source**: [Android App Publishing Guide 2025](https://foresightmobile.com/blog/complete-guide-to-android-app-publishing-in-2025)

---

## Flutter-Specific Considerations

### Building Release APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### Building App Bundle (AAB)

```bash
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

### Gradle Configuration

Flutter uses the Android Gradle plugin. Signing configuration goes in `android/app/build.gradle` or `android/app/build.gradle.kts`.

**Important**: Run `flutter clean` after changing Gradle signing config.

### Flutter 3.29+ Changes

New Flutter projects use Kotlin DSL (.kts) for Gradle files:
- `build.gradle.kts` instead of `build.gradle`
- Existing Groovy files continue to work
- No migration required for existing projects

**Source**: [Flutter Android Deployment](https://docs.flutter.dev/deployment/android)

---

## Implementation Recommendations

### For Oore CI/CD Platform

1. **Keystore Storage**
   - Encrypt keystore files (AES-256-GCM)
   - Store passwords separately
   - Track key expiration dates

2. **Signing Workflow**
   ```
   1. Retrieve encrypted keystore
   2. Decrypt to temporary file
   3. Run gradle/flutter build with signing config
   4. Sign AAB/APK if needed
   5. Delete temporary keystore
   ```

3. **key.properties Generation**
   ```bash
   # Generate at build time
   cat > android/key.properties << EOF
   storePassword=${STORE_PASSWORD}
   keyPassword=${KEY_PASSWORD}
   keyAlias=${KEY_ALIAS}
   storeFile=${KEYSTORE_PATH}
   EOF
   ```

4. **Database Schema Additions**
   ```sql
   CREATE TABLE android_keystores (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     key_alias TEXT NOT NULL,
     key_algorithm TEXT NOT NULL DEFAULT 'RSA',
     key_size INTEGER NOT NULL DEFAULT 2048,
     expires_at TEXT,
     sha1_fingerprint TEXT NOT NULL,
     sha256_fingerprint TEXT NOT NULL,
     keystore_encrypted BLOB NOT NULL,
     keystore_nonce TEXT NOT NULL,
     store_password_encrypted BLOB NOT NULL,
     store_password_nonce TEXT NOT NULL,
     key_password_encrypted BLOB NOT NULL,
     key_password_nonce TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   ```

5. **Validation Commands**
   ```bash
   # Verify keystore is valid
   keytool -list -v -keystore $KEYSTORE_PATH -storepass $STORE_PASSWORD -alias $KEY_ALIAS

   # Verify APK signature
   apksigner verify --print-certs $APK_PATH
   ```

6. **Google Play Upload Workflow**
   - Store service account JSON securely
   - Use Google Play Developer API
   - Support track selection (internal, alpha, beta, production)
   - Support staged rollouts

---

## References

1. [Android App Signing - Official Guide](https://developer.android.com/studio/publish/app-signing)
2. [Play App Signing - Google](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)
3. [bundletool - Android Developers](https://developer.android.com/tools/bundletool)
4. [Google Play Developer API](https://developers.google.com/android-publisher/)
5. [Flutter Android Deployment](https://docs.flutter.dev/deployment/android)
6. [Android Code Signing - Codemagic Docs](https://docs.codemagic.io/yaml-code-signing/signing-android/)
7. [Kotlin DSL in Flutter 3.29](https://codewithandrea.com/articles/flutter-android-gradle-kts/)
8. [Android App Publishing Guide 2025](https://foresightmobile.com/blog/complete-guide-to-android-app-publishing-in-2025)
9. [APK vs AAB - Medium](https://medium.com/droidstack/apk-vs-aab-a-developers-guide-to-packaging-and-distribution-1bdacca1f172)
10. [bundletool Releases - GitHub](https://github.com/google/bundletool/releases)
