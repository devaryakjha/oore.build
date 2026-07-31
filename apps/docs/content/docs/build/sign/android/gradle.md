---
title: 'Configure Gradle for Android signing'
status: implemented
description: 'Keep local Gradle signing separate from Oore runner-owned post-build signing.'
---

Configure Gradle to use local signing credentials only outside CI. Oore
defaults `CI` to `true` for repository commands and signs supported Android
output with its runner-owned signer. A pipeline environment value can override
that default, so leave `CI` unset or set it to `true`.

## What you need

- [Android signing configured](/build/sign/android) for the pipeline.
- A Flutter Android project with a local Gradle signing block.
- A local `key.properties` file that is not committed to the repository.

## 1. Gate local signing on `CI`

In `android/app/build.gradle`, load the developer's local properties and
assign the Gradle signing configuration only when `CI` is false:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
def isCi = System.getenv("CI")?.toBoolean() ?: false

android {
    signingConfigs {
        release {
            if (!isCi) {
                storeFile file(keystoreProperties["storeFile"])
                storePassword keystoreProperties["storePassword"]
                keyAlias keystoreProperties["keyAlias"]
                keyPassword keystoreProperties["keyPassword"]
            }
        }
    }

    buildTypes {
        release {
            if (!isCi) {
                signingConfig signingConfigs.release
            }
        }
    }
}
```

Adapt the surrounding Gradle syntax to the repository's existing Groovy or
Kotlin build file. Keep the boundary the same: local credentials remain local,
and the Oore build produces output for the runner-owned signer.

Check the pipeline's **Environment Variables** before relying on this gate.
Remove an unnecessary `CI` override or set it to `true`; a false override would
activate the local signing branch on the runner.

## 2. Keep secrets out of repository configuration

Do not add keystore content or passwords to `.oore.yaml`, UI environment
variables, Gradle source, or committed `key.properties`.

Do not read runner-managed signing variables from Gradle. They are not a
supported repository contract.

## 3. Run one Android variant

Use a supported Flutter APK or App Bundle build command for one variant in the
pipeline, then trigger a build.

## Verify the result

The repository build commands observe `CI=true`, the `android-sign` step
succeeds, and the final downloaded artifact passes `apksigner verify` or
`jarsigner -verify`.

Also run the release build locally with `CI` unset and confirm the existing
developer signing path still works with the local `key.properties`.

## Troubleshooting

**Gradle still asks for Oore signing variables**

Remove the Oore-specific environment lookup and gate the repository's existing
local signing configuration on `CI` instead.

**The local signing branch runs in Oore**

Inspect the pipeline's **Environment Variables**. Remove a false `CI` override
or set `CI` to `true`, then trigger a new build.

**No Android artifact is found for signing**

Confirm the Flutter build command produces an APK under
`build/app/outputs` or an App Bundle under the corresponding bundle output,
and that the pipeline artifact patterns include it.

**The runner reports both debug and release**

Separate those commands into different pipeline runs. Managed signing selects
one Android signing profile per run.

## Next step

[Trigger the release build](/build/run/trigger) and verify its downloaded
artifact.
