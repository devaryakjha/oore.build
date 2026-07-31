---
title: 'Check that your Mac is ready'
status: implemented
description: 'Confirm the host, repository, and Android tools needed for the default Oore build.'
---

This check confirms that one Mac can follow Oore's default Local Only journey.
It does not install Oore or change the machine.

## What you need

- A customer-owned Mac with Apple silicon or an `x86_64` processor.
- A macOS account that can approve the installer's service operations.
- A Flutter project that is already a local Git repository.
- Android Studio or a supported JDK and an Android SDK with Platform-Tools.
- Internet access for the stable installer and the dependencies your project
  downloads.

You do not need to install Flutter or FVM before Oore. The release includes FVM
and downloads the selected Flutter SDK on the first build.

## 1. Check macOS and the processor

```bash
uname -s
```

The result must be `Darwin`.

```bash
uname -m
```

The result must be `arm64` or `x86_64`.

## 2. Check the repository

```bash
git -C <absolute-path-to-flutter-repository> rev-parse --is-inside-work-tree
```

Replace `<absolute-path-to-flutter-repository>` with the repository path on
this Mac. The command must print `true`.

## 3. Confirm the Android tools

The Direct macOS runner needs a JDK and an Android SDK with Platform-Tools.
Android Studio can provide both. Oore verifies the exact tool locations after
installation with `oore doctor --platform android`.

You do not need to upload release-signing material for the first build.
**Quick Debug APK** uses Flutter's debug signing.

## Verify the result

You are ready to install when:

- `uname -s` prints `Darwin`;
- `uname -m` prints `arm64` or `x86_64`;
- the Git check prints `true`; and
- the runner account can use the Android toolchain installed on this Mac.

## Troubleshooting

### The operating system or processor is unsupported

The Oore backend and Direct macOS runner require macOS on `arm64` or `x86_64`.
Do not use the frontend-only Linux package for this one-Mac journey.

### Git does not print `true`

Use the absolute path to the repository root. If the project is not yet a Git
repository, initialize it or choose a repository that you already trust to run
on this Mac.

### You are unsure whether the Android SDK is complete

Install Android Studio and its Android SDK Platform-Tools. The install task runs
`oore doctor --platform android` before you create a project.

## Next step

[Install Oore on this Mac](/start/install).
