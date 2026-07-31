---
title: 'Team and access'
description: 'Invite people, assign the access they need, and choose how your team signs in to Oore.'
status: implemented
---

Invite people to your Oore instance, give them access to the right projects, and control how they sign in.

## Add people

Start with an invitation, then assign project access separately:

1. [Invite a team member](/team/invite) with an instance role.
2. [Manage roles and project access](/team/roles) for the projects they need.
3. [Disable or restore a user](/team/disable-users) when their access should change temporarily.

Instance roles control Oore-wide actions. Project roles control access within one project. Oore checks both on the backend; hiding a control in the web UI is not the authorization boundary.

## Let your team sign in

**Local Only** is the default for one operator using the backend Mac over loopback. It does not provide ordinary sign-in from another device.

Configure [External Access](/team/access) when other people or devices need the instance:

- **External Access (OIDC)** is the supported choice for most teams. Your identity provider handles sign-in, and Oore applies its own roles afterward.
- **External Access (Trusted Proxy)** is an advanced choice when an existing authentication proxy is already the identity boundary.

The hosted client at `ci.oore.build` is a static browser UI. It does not host your backend, proxy API traffic, run builds, or store your Oore data. Your browser must still reach your customer-operated backend over HTTPS.

## Access boundaries

- Invited users activate only when the email supplied by OIDC or Trusted Proxy matches their invitation.
- Owner and Admin have implicit Maintainer-equivalent access to every project.
- Developer and QA Viewer need explicit project membership. QA Viewer is always capped at Viewer.
- Removing project access does not disable the user's Oore account.
- Disabling a user revokes their Oore sessions and API tokens but does not delete their account or project data.

See [Roles and permissions](/reference/roles) for the complete permission matrix.
