---
title: 'Split the frontend and backend'
status: implemented
description: 'Install Oore’s frontend proxy on one host and its macOS backend and runner on another.'
---

This is an advanced deployment. Use it when the browser-facing client must run
on a separate macOS or Linux host while `oored` and builds remain on a Mac.
Oore supplies the two installer roles and frontend proxy; you supply protected
network paths, TLS, DNS, and peer restrictions.

## What you need

- A Mac for the `backend` role and its managed Direct macOS runner.
- A macOS or Linux host for the `frontend` role.
- Protected browser ingress and a protected path from the frontend host to the
  backend.
- For External Access (Trusted Proxy), a ready backend, allowlisted frontend
  peer CIDR, configured identity header, and distinct proof for each identity
  hop.

## 1. Install the backend role

On the backend Mac:

```bash
curl -fsSL https://oore.build/install | \
  OORE_INSTALL_MODE=backend \
  bash
```

The backend role installs `oored`, `oore`, and the managed Direct macOS runner.
It does not install the browser-facing frontend service.

## 2. Protect the cross-host path

Choose an HTTPS backend URL or an HTTP private address carried by an encrypted
transport you control. If you use remote HTTP, the installer requires an
explicit assertion:

```bash
OORE_WEB_BACKEND_TRANSPORT_PROTECTED=true
```

That setting records your assertion; it does not create or verify the
transport.

For Trusted Proxy, create a short-lived, single-use pairing code on the backend:

```bash
oore frontend invite
```

## 3. Install the frontend role

On the frontend host:

```bash
curl -fsSL https://oore.build/install | \
  OORE_INSTALL_MODE=frontend \
  OORE_WEB_BACKEND_URL=https://backend.example.com \
  bash
```

For a Trusted Proxy deployment, supply the new pairing code when prompted. The
frontend proxy serves the static client and forwards its supported API,
health, readiness, and install paths. Backend authentication and RBAC remain
authoritative.

## Verify the result

Run this on the frontend host:

```bash
oore-web status --url http://127.0.0.1:4173
```

Confirm both frontend and backend readiness. Open the protected frontend URL,
leave **Backend URL** empty when adding the same-origin instance, sign in, and
confirm **Settings > Runners** shows the backend Mac's runner online.

## Troubleshooting

If the installer rejects remote HTTP, either use HTTPS or protect the hop
before setting `OORE_WEB_BACKEND_TRANSPORT_PROTECTED=true`. If pairing fails,
confirm the frontend peer is allowlisted, create a new code, and retry; codes
expire and are consumed once.

## Next step

[Configure External Access](/team/access) for the browser entry point, then
[monitor both roles](/operate/maintain/monitor).
