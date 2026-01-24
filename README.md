# Oore (`/ɔːr/`)

**Self-hosted, Mac-first build & release hub for Flutter.**  
*Refine your code. Forge your artifacts. Own your metal.*

---

## What is Oore?

**Oore** is a self-hosted, "Mac-first" CI/CD orchestration hub designed specifically for Flutter projects. It turns a Mac mini or Mac Studio into a private build machine that can:

- listen to GitHub/GitLab webhooks (or run builds manually),
- store per-app build configuration and signing material locally (encrypted / Keychain-backed),
- run builds and produce signed artifacts,
- publish to distribution targets when you choose (manual promotion),
- and provide a simple web UI where non-devs can browse and download builds.

The goal is to remove the “Apple signing/notarization” friction and the overhead of hosted CI, while keeping your code and credentials on hardware you control.

---

## Why the name "Oore"?

In industry, **ore** is raw, unrefined material—valuable, but unusable until processed.

- Your source code is the **ore**.
- Oore is the **refinery** that turns it into signed, distributable artifacts.

Pronounced like “ore,” the spelling also nods to Apple’s “Core” ecosystem and the Mac-first focus.

---

## Project goals

- **Mac-first**: optimized for running on Apple Silicon machines you own.
- **Private by default**: code and signing credentials stay on your hardware.
- **Hassle-free releases**: a common UI for building, signing, and distributing Flutter apps.
- **Team-friendly**: a build gallery so non-devs can access artifacts without touching Xcode/CI.

---

**Developed by [Aryakumar Jha](https://github.com/devaryakjha)**