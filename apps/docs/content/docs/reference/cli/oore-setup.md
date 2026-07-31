---
title: '`oore setup`'
status: implemented
description: 'Interactive setup, direct backend-host initialization, and browser setup-token commands.'
---

Run `oore setup` on a new backend to choose a setup path interactively.

```text
oore setup [--daemon-url <URL>] [COMMAND]
```

| Command | Purpose                                                          |
| ------- | ---------------------------------------------------------------- |
| `init`  | Initialize Local Only or Trusted Proxy setup on the backend host |
| `token` | Create a short-lived token for browser setup                     |

## Interactive setup

Without a subcommand, the CLI offers the current setup paths. The prompt uses
the literal labels **Local Only**, **Remote Trusted Proxy**, **Remote OIDC**,
and **Generate a web setup token**. In the public documentation these
correspond to Local Only, External Access (Trusted Proxy), External Access
(OIDC), and token-only browser setup.

Local Only and Trusted Proxy use the direct initialization seam.

The OIDC branch remains a four-step CLI flow: verify the bootstrap capability,
configure the provider, authenticate the initial owner, and finalize setup.
Only the owner's identity-provider authentication hands off to a browser and
loopback callback; provider configuration and finalization stay in the CLI.

## Direct initialization

```text
oore setup init --mode <local|trusted-proxy> --owner-email <EMAIL> [OPTIONS]
```

| Option                        | Meaning                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `--mode`                      | Required: `local` or `trusted-proxy`                             |
| `--owner-email`               | Required initial Owner email                                     |
| `--user-email-header`         | Trusted Proxy identity header; defaults to `x-oore-user-email`   |
| `--trusted-proxy-cidr <CIDR>` | Allowed immediate proxy/frontend peer; repeatable                |
| `--shared-secret`             | Trusted Proxy proof value                                        |
| `--shared-secret-file`        | File containing the Trusted Proxy proof                          |
| `--state-file`                | Setup database path                                              |
| `--force`                     | Reinitialize an incomplete setup; never changes a ready instance |
| `--json`                      | Print machine-readable output                                    |

For `--mode trusted-proxy`, provide at least one proof source:
`--shared-secret`, `OORE_TRUSTED_PROXY_SHARED_SECRET`,
`--shared-secret-file`, or `OORE_TRUSTED_PROXY_SHARED_SECRET_FILE`. You may
provide both a direct value and a file; a nonempty direct value takes
precedence.

Local Only:

```bash
oore setup init \
  --mode local \
  --owner-email owner@example.com
```

Trusted Proxy:

```bash
oore setup init \
  --mode trusted-proxy \
  --owner-email owner@example.com \
  --user-email-header x-auth-request-email \
  --trusted-proxy-cidr 127.0.0.1/32 \
  --shared-secret-file /path/to/oore-trusted-proxy-secret
```

Trusted Proxy accepts identity only from an allowed immediate peer with the
configured proof. When `oore-web` also sits behind an authentication proxy,
the proxy-to-frontend and frontend-to-backend proofs must be different.

## Browser setup token

```text
oore setup token [--ttl <DURATION>] [--state-file <PATH>] [--json]
```

The default lifetime is `15m`. A setup token authorizes an incomplete browser
setup; it does not change the setup state by itself. Treat token output as a
secret and use it before expiry.

See [Configure External Access](/team/access) for supported access-mode tasks
and [Setup states](/reference/setup-states) for the state contract.
