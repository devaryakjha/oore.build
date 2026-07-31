---
title: 'Upgrade Oore'
status: implemented
description: 'Update a managed Oore installation on its current release channel with rollback protection.'
---

Use the installed `oore` command for a managed installation. It defaults to the
installed channel, verifies the release index and checksums, coordinates
managed work, creates a pre-update backup, replaces the release, restarts the
managed services, and verifies the result.

## What you need

- An Owner operating on the backend Mac.
- A [verified Oore backup](/operate/maintain/backups/create).
- Enough free space for the staged release, snapshot, and rollback data.
- The release notes for the target version.

## 1. Check for an update

```bash
oore update --check
```

To intentionally change streams, add `--channel stable`, `--channel beta`, or
`--channel alpha`. Otherwise, keep the installed channel.

## 2. Install the update

```bash
oore update
```

The managed transaction drains or coordinates active work, updates the backend
and managed runner, and restores the previous release and data if migration,
readiness, or runner acknowledgement fails.

If an old installation cannot use its updater or the UI says managed-service
repair is required, rerun the current installer for the same release channel.
Do not use hidden staged or supervisor arguments.

## Verify the result

```bash
oore version
oored version
curl --fail-with-body http://127.0.0.1:8787/healthz
curl --fail-with-body http://127.0.0.1:8787/readyz
```

Confirm **Settings > Runners** shows the managed runner online, then run a
small build from an approved repository.

## Troubleshooting

If the command reports a failed transaction, preserve its error and logs; the
updater attempts to restore both release and data. Verify readiness and the
runner before retrying. If a source-built installation is unmanaged, update
its checkout and services with your own deployment procedure—the managed
transaction does not claim that topology.

## Next step

[Monitor Oore](/operate/maintain/monitor) through the next normal build.
