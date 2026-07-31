---
title: 'Review known limitations'
status: implemented
description: 'Check current platform, trust, browser, storage, backup, and maturity boundaries.'
---

Oore maintainers own this list. Its maintained sources are the shipped runtime
and public CLI contract. These are the maintained public boundaries for Oore
`0.1.x`. Report a mismatch against current behavior through
[Report an issue](/operate/support/report-an-issue).

## Product maturity

- Oore is in public alpha. APIs, configuration formats, and CLI flags may
  change across `0.1.x`.
- `stable` names the default update stream; it is not a 1.0 maturity or uptime
  guarantee.

## Platform and execution

- The V1 backend and Direct runner target macOS. A frontend-only host may use
  macOS or Linux.
- Embedded and hybrid build execution are unsupported.
- Direct runners execute repository commands with the runner account's host
  permissions. They are not hostile-code or same-account credential sandboxes.

## Access and browser clients

- Local Only login is passwordless and loopback-only. External Access has no
  ordinary local bypass and supports no local password.
- `ci.oore.build` hosts static UI assets only. It cannot call an HTTP loopback
  backend from its HTTPS page and is not a default allowed backend origin.
- Adding a browser instance does not check readiness. The current UI does not
  remove saved instances.

## State, storage, and recovery

- Oore state backups do not include local artifact payloads or S3/R2 objects.
- Manual backup and restore are documented only for the default managed
  database/key layout.
- S3/R2 configuration does not create buckets or own provider policy,
  retention, availability, or backup.
- Artifact and install links expire; the target browser or device still needs a
  network path to the delivery endpoint.

## Authentication and signing

- External Access (OIDC) examples must supply the exact frontend
  `/auth/callback` URI.
- Signing runs within the trusted Direct-runner boundary. Do not treat signing
  configuration as isolation from repository code or the runner account.

## Next step

Choose a supported path from [Operate Oore](/operate), or
[report a reproducible issue](/operate/support/report-an-issue) when behavior
does not match a boundary above.
