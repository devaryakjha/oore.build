# Security Policy

## Report a vulnerability

Do not open a public issue for a security report.

Use [GitHub Security Advisories](https://github.com/oore-ci/oore.build/security/advisories/new) for private disclosure.

If you cannot use an advisory, request a private contact channel in a minimal issue.
Do not include exploit details, secrets, or sensitive logs.

## Scope

- The daemon (`oored`).
- The operator CLI (`oore`).
- The runner (`oore-runner`).
- The web UI (`apps/web`).

Hosted UI at `ci.oore.build` is UI-only and does not accept backend secrets.

## Supported versions

Security fixes target the latest release in each channel:

- `stable`
- `beta`
- `alpha`

## Disclosure process

- We confirm receipt after the initial review.
- We provide a fix plan after we confirm the impact.
- We credit the reporter when requested.
