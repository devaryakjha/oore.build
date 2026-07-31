---
title: '`oore recovery`'
status: implemented
description: 'Mint a short-lived, single-use browser recovery link from the backend host.'
---

`oore recovery` is the External Access break-glass path. Run it locally as the
user who owns the Oore installation:

```text
oore recovery [OPTIONS]
```

| Option         | Meaning                                                          |
| -------------- | ---------------------------------------------------------------- |
| `--email`      | Account to recover; required when multiple active accounts exist |
| `--web-url`    | UI base URL placed before the capability fragment                |
| `--ttl`        | Capability lifetime; default `5m`, maximum `5m`                  |
| `--state-file` | Setup database used to locate the local management socket        |
| `--json`       | Print machine-readable output                                    |

```bash
oore recovery \
  --email owner@example.com \
  --web-url https://ci.example.com
```

The CLI requests the capability over a local Unix management socket. Oore
rejects a symlinked socket, the wrong owner, or permissions other than `0600`;
the socket directory must be owned by the current user with mode `0700`.

The returned browser URL carries the capability in its fragment, so the
capability is not sent to the web server in the initial request. It is
single-use and account-bound. Do not paste it into tickets, logs, or chat.

This command does not reset the database, disable authentication, or create a
permanent bypass. After recovering access, repair External Access and let the
capability expire or be consumed.
