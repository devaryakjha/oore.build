---
title: 'Add iOS certificates and provisioning profiles'
status: implemented
description: 'Prepare the Apple signing assets and bundle mappings required for an iOS pipeline.'
---

Prepare an Apple signing certificate and provisioning profile for every bundle
the pipeline will sign. Manual signing uploads these files directly; App Store
Connect signing can synchronize eligible profiles through the API.

## What you need

- Membership in the Apple Developer Program.
- Access to the application's App IDs, certificates, profiles, and registered
  devices.
- A Mac with Keychain Access when exporting a certificate and private key.
- The Apple Team ID and every bundle identifier in the application.

## 1. Create or select a certificate

In the Apple Developer portal, create or select an Apple Distribution
certificate. Oore's current runner uses a Distribution identity for ad hoc or
release-testing signing.

When creating a certificate, follow Apple's certificate-signing-request flow
on a Mac and install the resulting certificate in Keychain Access.

## 2. Export the certificate

In Keychain Access, find the certificate under **My Certificates** and confirm
that its private key is present. Export the certificate and private key as a
password-protected `.p12` file.

> **Warning — Protect the private key**
>
> The `.p12` file and its password authorize signing. Keep an independent,
> access-controlled backup and do not commit either value to the repository.

## 3. Create provisioning profiles

In the Apple Developer portal, create a profile for each bundle identifier
that the build signs, including extensions. Choose a profile type that matches
the intended distribution and certificate.

For registered-device installation, create an ad hoc profile with the Apple
Distribution certificate and include the intended test devices.

## Verify the result

You have:

- one `.p12` file with its export password
- the Apple Team ID
- the main application bundle identifier and any extension bundle identifiers
- one matching `.mobileprovision` file per bundle for manual signing, or
  App Store Connect API access that can synchronize those assets

## Troubleshooting

**The certificate has no private key**

Use the Mac and keychain where the certificate-signing request was created, or
import the matching private key before exporting the `.p12`.

**A profile does not include the device**

Register the device in the Apple Developer account, regenerate the profile,
and use the new profile for the next build.

**An extension fails signing**

Create and map a profile for that extension's exact bundle identifier. The
main application profile does not cover a different bundle ID.

## Next step

[Configure manual signing](/build/sign/ios/manual), or
[configure App Store Connect signing](/build/sign/ios/app-store-connect).
