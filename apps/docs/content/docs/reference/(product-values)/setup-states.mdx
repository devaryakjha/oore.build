---
title: 'Setup states'
status: implemented
description: 'Setup states and public setup-status fields for an Oore backend.'
---

`GET /v1/public/setup-status` reports whether an Oore backend is ready. The
endpoint is non-sensitive and does not require a session.

## States

| State               | Meaning                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `uninitialized`     | No persisted setup record exists                                 |
| `bootstrap_pending` | The fresh instance is waiting for setup                          |
| `idp_configured`    | Access preferences and any identity-provider configuration exist |
| `owner_created`     | The initial owner exists, but setup is not complete              |
| `ready`             | Setup is complete and normal authentication is active            |

A fresh database normally persists `bootstrap_pending`. Generating a bootstrap
token does not define the state; the token only authorizes a browser setup
session.

## Setup paths

The browser OIDC flow can advance through:

```text
bootstrap_pending → idp_configured → owner_created → ready
```

That sequence is not universal. A direct backend-host command can complete
Local Only or External Access (Trusted Proxy) setup in one transaction:

```bash
oore setup init --mode local --owner-email owner@example.com
```

Likewise, first loopback login can complete a Local Only instance. Do not use
database deletion as a setup or recovery procedure.

Once `ready`, setup-mutating endpoints reject further setup. Use normal
settings for configuration changes and [`oore recovery`](/reference/cli/oore-recovery)
for External Access break-glass recovery.

## Public response

```json
{
  "instance_id": "instance_01",
  "state": "ready",
  "runtime_mode": "remote",
  "remote_auth_mode": "oidc",
  "setup_mode": false,
  "is_configured": true
}
```

| Field              | Values or meaning                                                     |
| ------------------ | --------------------------------------------------------------------- |
| `instance_id`      | Stable instance identifier                                            |
| `state`            | One of the setup states above                                         |
| `runtime_mode`     | `local` or `remote`                                                   |
| `remote_auth_mode` | `oidc` or `trusted_proxy`; meaningful when `runtime_mode` is `remote` |
| `setup_mode`       | `true` until the state is `ready`                                     |
| `is_configured`    | `true` only when the state is `ready`                                 |

See the generated [Setup API category](/reference/api/categories/setup) for
the current request and response contracts.
