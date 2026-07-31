---
title: 'Add a Direct macOS runner'
status: implemented
description: 'Use the managed runner on the backend Mac or register a runner on another Mac.'
---

Every Oore build runs in a separate Direct macOS runner process. The default
installer enrolls one on the backend Mac. Add another runner only when builds
need a different Mac or toolchain.

Repository commands run with the runner account's host permissions. A Direct
runner is not a hostile-code sandbox; connect only repositories you trust on
that account.

## What you need

- Owner, Admin, or runner-write access to the backend.
- The backend URL and a protected network path when the runner uses another
  Mac.
- The repository toolchains installed for the runner account.

## Use the managed runner first

On the backend Mac, repair or enroll the managed runner as the account that
should execute builds:

```bash
oore runner install-service --managed-local
```

Do not prefix the whole command with `sudo`. Oore requests administrator
approval only for the fixed launchd operation. Managed state is stored in
`~/.oore/managed-runner.json`.

## Register a runner on another Mac

This supported path needs a protected non-loopback connection to the backend,
the repository's toolchains on the runner Mac, and a session token with
runner-write permission.

```bash
oore runner register \
  --daemon-url https://oore.example.com \
  --token "$OORE_SESSION_TOKEN" \
  --name "build-mac"
```

The backend returns the runner token once. The CLI stores it in
`~/.oore/runner.json` and prints the runner identity and configuration path; it
does not display the token. Install its boot-time service:

```bash
oore runner install-service
```

For a foreground diagnostic, use:

```bash
oore runner start
```

## Verify the result

Open **Settings > Runners** and confirm the runner is online. Confirm **Allow
approved repositories** is on, then trigger a build from an already linked
source and verify that this runner claims it.

Turning **Allow approved repositories** off pauses new claims; active work
drains, and repository trust is unchanged.

## Troubleshooting

If registration fails, check the backend URL, protected transport, session
token, and runner-write permission. If work remains queued, inspect the UI for
**Direct runner paused** (`instance_paused`) or **Source unavailable**
(`repository_unavailable`), then confirm protocol compatibility and source
availability.

## Next step

[Learn the runner trust boundary](/understand/runner-trust) or
[monitor Oore](/operate/maintain/monitor).
