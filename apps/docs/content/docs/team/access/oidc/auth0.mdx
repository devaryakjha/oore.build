---
title: 'Configure Auth0 OIDC'
description: 'Create an Auth0 regular web application and connect its tenant issuer to Oore.'
status: implemented
---

Create an Auth0 regular web application for Oore. This page covers only Auth0-specific configuration; [configure the shared OIDC network and enablement steps](/team/access/oidc) separately.

## What you need

- Permission to create applications in the Auth0 tenant
- The exact Oore frontend callback ending in `/auth/callback`

## 1. Create the Auth0 application

1. In the Auth0 Dashboard, open **Applications > Applications**.
2. Select **Create Application**.
3. Choose **Regular Web Applications**.
4. Open the application's settings.
5. Add the exact Oore callback under **Allowed Callback URLs**. If you operate more than one frontend origin, list each complete callback explicitly.
6. Copy the application's domain, client ID, and client secret.

## 2. Save Auth0 in Oore

In Oore's **2. Identity** step, enter:

| Oore field                   | Auth0 value                     |
| ---------------------------- | ------------------------------- |
| **Issuer URL**               | `https://<your-auth0-domain>/`  |
| **Client ID**                | The application's client ID     |
| **Client secret (optional)** | The application's client secret |

Keep the trailing slash in the Auth0 issuer and select **Save changes**.

Use the exact domain shown by Auth0, including a custom domain when that is the issuer your tenant exposes.

## Verify the result

Confirm Oore reports the same Auth0 issuer. After you complete the shared External Access steps and select **Turn on**, sign in from a private window and confirm Auth0 returns the browser to the exact Oore callback.

Auth0 documents its [application settings](https://auth0.com/docs/get-started/applications/application-settings), including allowed callback URLs and credentials.

## Troubleshooting

### Auth0 reports an unauthorized callback URL

The complete callback is missing from **Allowed Callback URLs** or differs in scheme, host, port, path, or trailing slash. Register the exact URI Oore sends.

### Oore reports an issuer mismatch

The issuer does not exactly match the Auth0 tenant or custom domain discovery response. Copy the tenant domain and preserve its trailing slash.

## Next step

Return to [Configure External Access (OIDC)](/team/access/oidc) to run technical checks and enable access.
