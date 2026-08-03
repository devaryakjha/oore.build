---
title: 'Configure Keycloak OIDC'
description: 'Create a Keycloak OpenID Connect client and connect its realm issuer to Oore.'
status: implemented
---

Create a Keycloak OpenID Connect client for Oore. This page covers only Keycloak-specific configuration; [configure the shared OIDC network and enablement steps](/team/access/oidc) separately.

## What you need

- Realm-administrator access in Keycloak
- A browser-reachable HTTPS Keycloak realm
- The exact Oore frontend callback ending in `/auth/callback`

## 1. Create the Keycloak client

1. In the Keycloak Admin Console, select the realm that will authenticate Oore users.
2. Open **Clients** and select **Create client**.
3. Set **Client type** to **OpenID Connect** and enter a client ID.
4. Enable **Client authentication** and **Standard flow**.
5. Add the exact Oore callback under **Valid redirect URIs**. Keep broader wildcard patterns out of this list.
6. Save the client, open **Credentials**, and copy the client secret.

## 2. Save Keycloak in Oore

In Oore's **2. Identity** step, enter:

| Oore field                   | Keycloak value                           |
| ---------------------------- | ---------------------------------------- |
| **Issuer URL**               | `https://<keycloak-host>/realms/<realm>` |
| **Client ID**                | The Keycloak client ID                   |
| **Client secret (optional)** | The client secret                        |

Replace both placeholders with the externally reachable host and exact realm name, then select **Save changes**.

The issuer must be reachable by the Oore backend and must match the issuer in Keycloak's discovery document. Do not use the Admin Console URL.

## Verify the result

Confirm Oore reports the same realm issuer. After you complete the shared External Access steps and select **Turn on**, sign in from a private window and confirm Keycloak returns the browser to the exact Oore callback.

Keycloak documents its [OIDC endpoints](https://www.keycloak.org/securing-apps/oidc-layers) and client settings in the [Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/).

## Troubleshooting

### Oore cannot reach Keycloak discovery

The backend cannot resolve or trust the issuer URL, or the URL contains the Admin Console path. Use the external realm issuer and make it reachable from the backend Mac.

### Keycloak rejects the redirect

The callback is absent from **Valid redirect URIs** or is not an exact match. Add the full frontend callback ending in `/auth/callback`.

## Next step

Return to [Configure External Access (OIDC)](/team/access/oidc) to run technical checks and enable access.
