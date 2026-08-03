---
title: 'Configure External Access (OIDC)'
description: 'Connect an OpenID Connect provider, pass External Access checks, and verify a complete Oore sign-in.'
status: implemented
---

Connect Oore to an OpenID Connect provider and enable sign-in from your intended browser client. Local Only remains unchanged until you select **Turn on**.

Oore uses provider discovery, the authorization code flow with PKCE, and the scopes `openid`, `email`, and `profile`. The provider authenticates the person; Oore then creates its own session and enforces Oore roles.

## What you need

- The Oore Owner account
- A ready customer-operated macOS backend
- A non-loopback HTTPS URL that browsers can reach
- Permission to create an OIDC web application at your provider
- The exact origin of each browser client you will use

## 1. Define the frontend origin and callback

Choose the browser client first. During initial setup, copy the callback URI Oore shows. Its value is always the exact frontend origin followed by `/auth/callback`.

For example:

```text
Frontend origin: https://ci.example.com
Callback URI:    https://ci.example.com/auth/callback
```

If you use the hosted client:

```text
Frontend origin: https://ci.oore.build
Callback URI:    https://ci.oore.build/auth/callback
```

Register the complete callback URI at your identity provider. Do not omit `redirect_uri`, point it at the backend API, or add a trailing slash that the browser client does not use.

Choose the provider-specific instructions for the remaining registration:

- [Google](/team/access/oidc/google)
- [Microsoft Entra ID](/team/access/oidc/entra)
- [Okta](/team/access/oidc/okta)
- [Auth0](/team/access/oidc/auth0)
- [Keycloak](/team/access/oidc/keycloak)

## 2. Configure the network

1. In Oore, open **Settings > General**.
2. Under **External access**, select **1. Network**.
3. Set **Public URL (HTTPS)** to the browser-reachable backend URL.
4. Add each exact client origin under **Allowed frontend origins**. An origin contains the scheme, host, and optional port, but no path.
5. Select **Save network settings**.

The hosted client is UI-only. Setting `https://ci.oore.build` as an allowed origin does not make your backend public or proxy requests through Oore's site.

## 3. Configure the identity provider

1. Under **External access**, select **2. Identity**.
2. Enter the provider's exact **Issuer URL** and **Client ID**.
3. Enter **Client secret (optional)** when the provider created a confidential web client.
4. Select **Save changes**.

Oore runs discovery immediately. A successful save shows `OIDC configured: <issuer>`.

## 4. Enable External Access

1. Open **Technical checks**.
2. Resolve every failed network or identity check.
3. When Oore reports **All checks are passing**, select **Turn on**.
4. Start a new session with **Sign in with OIDC**.

Turning External Access on revokes existing sessions. This is expected.

## Verify the result

Use a private window or a second browser on the intended client origin:

1. Open the Oore client.
2. Select **Sign in with OIDC**.
3. Complete sign-in at the provider.
4. Confirm the browser returns to `/auth/callback` and then opens the Oore UI as the expected user.

For an invited user, confirm **Settings > Users** changes their status from `invited` to `active`. Their provider email must match the invitation.

## Troubleshooting

### OIDC discovery fails

The issuer is not the provider's exact discovery issuer or the backend cannot reach it. Copy the issuer from the provider configuration and verify its discovery document is reachable from the backend Mac.

### The provider reports a redirect URI mismatch

The registered URI differs by scheme, host, port, path, or trailing slash. Copy the exact frontend origin and append `/auth/callback`, then update the provider registration.

### Technical checks do not pass

Open the failed check and fix that specific network or identity setting. In particular, the Public URL must be non-loopback HTTPS and its origin must be allowed.

### The callback returns but the user is rejected

The provider email does not match an active or invited Oore user. Correct the provider claim or invite the exact email it supplies.

## Next step

[Invite a team member](/team/invite) with the same email their provider will return.
