---
title: 'Create and verify a backup'
status: implemented
description: 'Create a verified backup of the default managed Oore database and encryption key.'
---

Back up Oore state before an upgrade or recovery operation. The backup contains
a consistent SQLite snapshot, the encryption key needed for encrypted state,
and a checksum manifest in an owner-readable `.tar.gz` archive.

This task supports only the default managed data layout. Do not use the manual
command for a custom database/key layout: the command can select another
database, but it cannot select that database's matching encryption key.

## What you need

- Write access to a separate encrypted destination.
- Enough free space for a database snapshot and archive.
- A plan to back up artifact payloads separately. Oore state backups do not
  contain local artifact files or S3/R2 objects.

## 1. Create the archive

```bash
oore backup create --output /Volumes/oore-backups/oore-state.tar.gz
```

Creation uses a consistent SQLite snapshot and may run while `oored` is live.

## 2. Verify the archive

```bash
oore backup verify --input /Volumes/oore-backups/oore-state.tar.gz
```

Verification checks the expected flat manifest, database, and key files; their
SHA-256 digests; the key length; and SQLite integrity.

## Verify the result

Confirm the first command prints `Created backup` and the second prints
`Backup verified`. Copy the archive off the backend Mac, verify the copied
archive again, and record the date and installed Oore version with it.

## Troubleshooting

If creation cannot find state or the key, stop and confirm you are using the
default managed layout. If verification fails, do not retain that archive as a
recovery point; create a new one and investigate disk or copy errors.

## Next step

[Rehearse a restore](/operate/maintain/backups/restore) on a non-production
instance.
