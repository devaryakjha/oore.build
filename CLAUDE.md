# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oore is a **self-hosted Codemagic alternative** - a Flutter-focused CI/CD platform that runs on your own Mac hardware (Mac mini, Mac Studio) instead of cloud infrastructure. Think of it as bringing Codemagic's functionality to dedicated hardware you control.

## Why Self-Hosted?

- **Signing credentials stay local**: No uploading certs/provisioning profiles to third parties
- **Dedicated hardware**: Faster, predictable builds on Apple Silicon you own
- **No per-build costs**: Fixed hardware cost vs. pay-per-minute cloud builds
- **Full control**: Your code never leaves your network

## Project Status

Early development. As the codebase grows, update this file with build commands, architecture details, and development workflow.

## Target Feature Set (Codemagic Parity)

- **Webhook triggers**: GitHub/GitLab integration for automated builds
- **Build pipelines**: Flutter builds for iOS, Android, macOS, web
- **Code signing**: Keychain-backed certificate and provisioning profile management
- **Artifact storage**: Build history with downloadable IPAs, APKs, app bundles
- **Distribution**: Publish to TestFlight, App Store, Play Store, Firebase App Distribution
- **Notifications**: Slack, email, webhook notifications on build status
- **Web dashboard**: Team-friendly UI for triggering builds and downloading artifacts
