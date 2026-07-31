---
title: 'Roles and permissions'
status: implemented
description: 'Instance roles, project roles, effective permissions, and authorization behavior.'
---

Oore combines one instance role with an optional role on each project.
Instance Owners and Admins have implicit full project access. Developers and
QA Viewers need explicit project membership.

## Instance roles

| Role        | Instance access                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `owner`     | Full administration and project access; exactly one Owner exists                                  |
| `admin`     | Full administration and project access, except Owner-only actions                                 |
| `developer` | Read projects, pipelines, builds, artifacts, runners, and integrations; operate assigned projects |
| `qa_viewer` | Read assigned project, pipeline, build, artifact, and integration data                            |

Developers can manage their API tokens. Owners and Admins can manage users,
settings, integrations, runners, and audit surfaces. QA Viewers do not receive
operator write permissions.

## Project roles

| Project role | Effective permissions                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `maintainer` | All project permissions, including settings, deletion, members, pipelines, builds, and artifacts |
| `developer`  | Read; manage pipelines; trigger or cancel builds; read and write artifacts                       |
| `viewer`     | Read the project and artifacts                                                                   |

Owners and Admins resolve to Maintainer on every project without a membership
row. A Developer's explicit membership is capped at Developer. A QA Viewer's
membership is always capped at Viewer, including if older data contains a
higher project role.

## Effective access

Project permission checks use both layers:

1. Resolve the instance role.
2. Resolve explicit project membership when the instance role is not Owner or
   Admin.
3. Cap the project role at the maximum allowed by the instance role or API
   token.
4. Check the action-specific project permission.

A caller with no project access receives `404 not_found`, which avoids leaking
the project's existence. A caller who can discover the project but lacks the
requested action receives `403 permission_denied`.

Users also have an account status: `invited`, `active`, or `disabled`.
Disabling a user revokes sessions and API tokens. Restoring the user does not
restore those credentials.

For operator tasks, see [Manage roles and project access](/team/roles) and
[Disable or restore a user](/team/disable-users).
