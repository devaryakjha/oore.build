---
title: '`oore login`'
status: implemented
description: 'Create a loopback Local Only session or import an existing Oore session token.'
---

```text
oore login [--daemon-url <URL>] [--token <TOKEN>] [--email <EMAIL>] [--json]
```

## Local Only login

Without `--token`, `oore login` requests a Local Only session. The backend must
be loopback-only and configured for Local Only access.

```bash
oore login --email owner@example.com
```

`--email` is optional and defaults to `owner@local` server-side. A ready
External Access instance rejects Local Only login.

## Import a session

Use `--token` to import a session created through the supported browser or
recovery flow:

```bash
oore login \
  --daemon-url https://ci.example.com \
  --token '<session-token>'
```

The CLI validates the token against `/v1/users/me` before saving it. On
success, it stores the daemon URL and session token in the protected CLI
configuration file. See [`oore config`](/reference/cli/oore-config) for storage
and resolution rules.

Treat command-line tokens as secrets: shell history and process inspection may
expose them. `--token` is the import interface; after import, authenticated
commands can read the token from the protected config file or
`OORE_SESSION_TOKEN`.
