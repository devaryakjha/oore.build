---
title: 'Installer configuration'
status: implemented
description: 'Installer roles, release selection, automation inputs, frontend pairing, and transport assertions.'
---

The default macOS installer creates a complete local Oore installation:

```bash
curl -fsSL https://oore.build/install | bash
```

Use `--advanced` to choose an install role or provide automation inputs:

```bash
curl -fsSL https://oore.build/install | bash -s -- --advanced
```

The installer accepts `--advanced`, `--no-open`, and `--help`. `--no-open`
suppresses the post-install browser launch for that invocation.

## Install roles

| Role       | Host support   | Installs                                                                             |
| ---------- | -------------- | ------------------------------------------------------------------------------------ |
| `auto`     | macOS or Linux | Selects `all` on macOS or `frontend` on Linux; advanced interactive macOS can prompt |
| `all`      | macOS          | Backend, CLI, Direct runner binary, frontend, and web assets                         |
| `backend`  | macOS          | Backend and CLI, including Direct runner commands                                    |
| `frontend` | macOS or Linux | Frontend service and web assets                                                      |

`full` remains a compatibility alias for `all`; new automation should use
`all`. See [Choose a supported deployment](/operate/deploy) before splitting
roles.

## Release and install

| Variable                      | Default                   | Purpose                                               |
| ----------------------------- | ------------------------- | ----------------------------------------------------- |
| `OORE_VERSION`                | `latest`                  | `latest` or an exact release tag                      |
| `OORE_CHANNEL`                | `stable`                  | `stable`, `beta`, or `alpha` when resolving `latest`  |
| `OORE_INSTALL_MODE`           | `auto`                    | `auto`, `all`, `backend`, or `frontend`               |
| `OORE_INSTALL_ROOT`           | `~/.oore`                 | Installation root                                     |
| `OORE_NONINTERACTIVE`         | `0`                       | Disable prompts when true                             |
| `OORE_OPEN_BROWSER`           | Interactive local only    | Open the local web root after installation            |
| `OORE_START_DAEMON`           | Local default or explicit | Start the backend during installation                 |
| `OORE_INSTALL_DAEMON_SERVICE` | Local default or explicit | Install the managed backend and runner services       |
| `OORE_ENABLE_LINGER`          | Unset                     | Enable systemd lingering for a Linux frontend service |
| `OORE_LOCAL_WEB_MODE`         | Interactive choice        | `off`, `run`, or `login`                              |
| `OORE_LOCAL_WEB_LISTEN`       | `127.0.0.1:4173`          | Frontend listen address                               |
| `OORE_HOSTED_UI`              | `https://ci.oore.build`   | Hosted UI used for setup and browser handoff          |

An exact `OORE_VERSION` overrides channel discovery. The default non-advanced
macOS path is a managed all-in-one install. For an advanced non-interactive
install, provide every value required by the selected role; backend startup is
skipped unless `OORE_INSTALL_DAEMON_SERVICE` or `OORE_START_DAEMON` is true.

## Release origins

| Variable                      | Default                         | Purpose                              |
| ----------------------------- | ------------------------------- | ------------------------------------ |
| `OORE_GITHUB_REPO`            | `oore-ci/oore.build`            | Repository containing release assets |
| `OORE_RELEASE_BASE_URL`       | GitHub Releases download origin | Versioned asset origin               |
| `OORE_RELEASE_INDEX_BASE_URL` | `https://releases.oore.build`   | Static channel-index origin          |
| `OORE_RELEASE_MANIFEST_URL`   | `<index>/latest/<channel>.json` | Exact channel manifest override      |

## Backend and browser networking

| Variable                               | Default or role                                      |
| -------------------------------------- | ---------------------------------------------------- |
| `OORE_DAEMON_LISTEN`                   | Derived from `OORE_DAEMON_URL`                       |
| `OORE_DAEMON_URL`                      | `http://127.0.0.1:8787`; setup-helper backend URL    |
| `OORE_PUBLIC_URL`                      | Browser-visible HTTPS origin                         |
| `OORE_ARTIFACT_DELIVERY_URL`           | Optional token-only HTTPS artifact-delivery origin   |
| `OORE_WARPGATE_TICKET`                 | Optional Warpgate ticket for iOS OTA delivery        |
| `OORE_CORS_ORIGINS`                    | Defaults from `OORE_PUBLIC_URL` when set             |
| `OORE_WEB_BACKEND_URL`                 | Defaults to `OORE_DAEMON_URL`                        |
| `OORE_WEB_BROWSER_TRANSPORT_PROTECTED` | Assert encrypted ingress before non-loopback HTTP UI |
| `OORE_WEB_BACKEND_TRANSPORT_PROTECTED` | Assert encrypted transport around a remote HTTP hop  |

The two transport variables are assertions, not encryption. Set them only
after a separate encrypted transport is in place. The installer rejects a
remote plaintext hop without the corresponding assertion.

## Frontend pairing and Trusted Proxy

| Variable                                             | Purpose                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `OORE_FRONTEND_PAIRING_CODE`                         | Short-lived code from `oore frontend invite`                |
| `OORE_SETUP_OWNER_EMAIL`                             | Initial Owner email for Trusted Proxy setup                 |
| `OORE_SETUP_PROXY_PRESET`                            | `generic`, `warpgate`, or `custom`                          |
| `OORE_SETUP_USER_EMAIL_HEADER`                       | Identity header required by a custom preset                 |
| `OORE_TRUSTED_PROXY_SHARED_SECRET`                   | Frontend/proxy proof accepted by the backend                |
| `OORE_TRUSTED_PROXY_SHARED_SECRET_FILE`              | File containing that backend proof                          |
| `OORE_TRUSTED_PROXY_CIDRS`                           | Comma-separated immediate proxy/frontend peer CIDRs         |
| `OORE_WEB_TRUSTED_PROXY_USER_EMAIL_HEADER`           | Identity header the frontend may forward after verification |
| `OORE_WEB_UPSTREAM_TRUSTED_PROXY_SHARED_SECRET`      | Authentication-proxy proof accepted by the frontend         |
| `OORE_WEB_UPSTREAM_TRUSTED_PROXY_SHARED_SECRET_FILE` | File containing the authentication-proxy proof              |
| `OORE_WEB_UPSTREAM_TRUSTED_PROXY_SECRET_HEADER`      | Proof header; defaults to `x-oore-web-trusted-proxy-secret` |

Prefer `OORE_FRONTEND_PAIRING_CODE` for a split frontend. Pairing transfers the
backend proof without requiring an operator to copy it. When an authentication
proxy fronts `oore-web`, its proof and the frontend-to-backend proof must be
different.

Do not place secret values directly in reusable shell history. Use protected
files or a secret-injection mechanism and keep proof files readable only by the
service account.
