---
title: 'Configure Okta OIDC'
description: 'Create an Okta OIDC web application and connect its authorization-server issuer to Oore.'
status: implemented
---

Create an Okta OIDC web application for Oore. This page covers only Okta-specific configuration; [configure the shared OIDC network and enablement steps](/team/access/oidc) separately.

## What you need

- Permission to create applications in your Okta organization
- An Okta authorization server that returns the user's email
- The exact Oore frontend callback ending in `/auth/callback`

## 1. Create the Okta application

1. In the Okta Admin Console, open **Applications > Applications**.
2. Select **Create App Integration**.
3. Choose **OIDC - OpenID Connect**, then **Web Application**.
4. Enable the authorization code grant and add the exact Oore callback under **Sign-in redirect URIs**.
5. Assign the people or groups who may use the application.
6. Save the application and copy its client ID and client secret.
7. Copy the exact issuer for the authorization server you selected. For a custom server this often resembles `https://<your-okta-domain>/oauth2/default`; do not use an Admin Console URL.

## 2. Save Okta in Oore

In Oore's **2. Identity** step, enter:

| Oore field                   | Okta value                              |
| ---------------------------- | --------------------------------------- |
| **Issuer URL**               | The authorization server's exact issuer |
| **Client ID**                | The application's client ID             |
| **Client secret (optional)** | The application's client secret         |

Select **Save changes**.

## Verify the result

Confirm the issuer Oore reports matches the Okta authorization server. After you complete the shared External Access steps and select **Turn on**, sign in as an assigned user from a private window and confirm Okta returns the browser to the exact Oore callback.

Okta's [web-app redirect guide](https://developer.okta.com/docs/guides/sign-into-web-app-redirect/main/) covers the application type, grants, redirect URI, and assignments.

## Troubleshooting

### Oore cannot discover the issuer

The value is probably an Okta organization or Admin Console URL rather than the selected authorization server's issuer. Copy the issuer from that authorization server.

### Okta denies an otherwise valid user

The user or their group is not assigned to the application. Update **Assignments**, then repeat sign-in.

## Next step

Return to [Configure External Access (OIDC)](/team/access/oidc) to run technical checks and enable access.
