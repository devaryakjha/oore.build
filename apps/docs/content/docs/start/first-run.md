---
title: 'Open Oore for the first time'
status: implemented
description: 'Use loopback Local Only sign-in to initialize the owner and reach a ready instance.'
---

Your first loopback sign-in creates the Local Only owner and takes a fresh
instance directly to `ready`. It does not enable External Access or require a
bootstrap-token wizard.

## What you need

- Oore installed with the default complete install on this Mac.
- The local web client and backend running on loopback.
- A browser on the same Mac.

## 1. Open the local web client

Open `http://127.0.0.1:4173`.

Oore shows **Sign in** and lists **Local Only** as the sign-in method. Use this
installed client for the default path; `ci.oore.build` cannot sign in to a
loopback-only backend from an HTTPS page.

## 2. Sign in locally

On a fresh default install:

1. Leave **Email (optional)** empty.
2. Select **Sign in locally**.

Oore creates the first active owner, completes Local Only setup, creates a
session, and opens the **Dashboard**.

## Verify the result

The browser displays **Dashboard** instead of the setup flow. Reload the page
and confirm that it returns to the same instance.

The backend is now `ready`, but it remains Local Only: ordinary sign-in is
accepted only over loopback.

## Troubleshooting

### Oore says local sign-in is unavailable from this host

Both the web client and backend must use loopback for Local Only sign-in. Open
the installed client at `http://127.0.0.1:4173` on the backend Mac instead of a
host name, IP address, or the hosted UI.

### Sign-in cannot find the email

On a fresh default install, clear **Email (optional)** and try again. An email
is an account selector for an existing active user; it does not rename the
automatically created local owner.

### The local client cannot reach the instance

Return to [Install Oore on one Mac](/start/install), check the managed-service
logs, and rerun the stable installer if the installation needs repair.

## Next step

[Build your first debug APK](/start/first-build).
