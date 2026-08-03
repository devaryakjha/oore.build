# Canonical public documentation tree

Status: prototype resolution for
[#205](https://github.com/oore-ci/oore.build/issues/205), at baseline
`66e56785394960f280b7c37244ed72b1dccca4bc`.

This artifact fixes the human-visible Fumadocs hierarchy and accounts for the
complete authored corpus. It does not implement Astro, rewrite the public
pages, change product behavior, or settle redirect mechanics owned by
[#204](https://github.com/oore-ci/oore.build/issues/204).

The decision incorporates the accepted architecture, page ledger, factual
truth table, deployment contract, and voice prototype:

- [Fumadocs-on-Astro architecture](https://github.com/oore-ci/oore.build/blob/962859b5df489f405701f5e9d3fda3ef9f7cbe0d/research/fumadocs-astro-7-architecture.md)
- [92-page disposition ledger](https://github.com/oore-ci/oore.build/blob/f9a9699d767012b8ed409c6622f1d2254cc8e37a/wayfinder/public-docs-page-ledger.md)
- [Public truth table](https://github.com/oore-ci/oore.build/blob/ca90c65a6fefbd5cf1df460a083da46d52167fcf/wayfinder/public-docs-truth-table.md)
- [Public deployment contract](https://github.com/oore-ci/oore.build/blob/27fd4e86dcff9d1e073032d035d60669a8d2ab9c/wayfinder/public-deployment-contract.md)
- [Public voice prototype](https://github.com/oore-ci/oore.build/blob/694e6311b9de4c04a7aa10b8639e58b9dfedb499/wayfinder/public-docs-voice-prototype.md)

## Decision

The primary reader is the technical owner or operator of a Flutter team with a
Mac. The first journey is one Mac, Local Only, a local Git repository, the
managed Direct macOS runner, automatic local artifact storage, and a successful
**Quick Debug APK**. Signing, distribution, Sources, team access, External
Access, additional clients, runners, instances, and storage follow only after
that success.

The one public hierarchy is, in this order:

1. **Start with Oore**
2. **Build and distribute**
3. **Team and access**
4. **Operate Oore**
5. **Understand Oore**
6. **Reference**

`/` remains the docs entry page. It is the index of the page-tree root, not a
seventh content group. It routes readers into the six groups and does not
restate their hierarchy in a second navbar.

One Fumadocs loader-owned page tree must drive the sidebar, breadcrumbs,
previous/next links, mobile navigation, static routes, and search. Generated
OpenAPI is visible only beneath **Reference**. Contributor guidance stays
outside this public product tree.

## Reconciled totals

| Measure                                    | Total | Meaning                                                                                       |
| ------------------------------------------ | ----: | --------------------------------------------------------------------------------------------- |
| Authored source pages                      |    92 | `1 + 9 + 31 + 8 + 28 + 1 + 14` from the accepted ledger                                       |
| Currently represented in the declared tree |    80 | The other 12 are omitted legacy API pointers                                                  |
| Retain or rewrite                          |    72 | One primary authored destination per source, including moves, validation, and split primaries |
| Merge                                      |     6 | Content enters one named destination; the source does not keep its own page                   |
| Redirect                                   |    12 | Eleven API pointers plus the unsupported embedded-runner archaeology page                     |
| Remove as internal                         |     2 | No public page and no redirect to a private destination                                       |
| Final authored destination pages           |    81 | Seventy-two retained primaries plus nine justified landing/split destinations                 |
| Generated OpenAPI pages                    |   130 | One page per operation across 102 paths; never part of the authored 92                        |
| Generated operation tag groups             |    21 | Nineteen declared tags plus two operation-only drift tags                                     |

The source buckets are exhaustive and mutually exclusive:
`72 + 6 + 12 + 2 = 92`.

The current internal classification is also preserved exactly: **66 No, 24
Mixed, 2 Yes**. The Mixed set includes the audit-corrected
`getting-started/first-instance`, `operations/index`, and
`operations/split-roles`; all three lose the maintainer-only recipe link and
material.

## Reading the tree

Every `P###` row is one authored page and appears once. Page types are exactly
**landing**, **tutorial**, **task**, **concept**, or **reference**. Bold
subheadings marked “visible folder” are real nested navigation nodes without a
page of their own. A page that is also a folder index remains a visible,
clickable row and is called out after the tree.

`S###` identifiers resolve to the exact source paths in the accounting
appendix. “Split” means a source supplies a clearly bounded fragment to an
additional page while retaining one primary disposition in the appendix.
Support levels appear only where deployment or access sensitivity makes them
useful.

<!-- CANONICAL_TREE_BEGIN -->

## Root entry

| ID   | Title              | Proposed canonical slug | Type    | Source and action           | Support               |
| ---- | ------------------ | ----------------------- | ------- | --------------------------- | --------------------- |
| P001 | Oore documentation | `/`                     | landing | S001 retained and rewritten | Default journey first |

## 1. Start with Oore

| ID   | Title                        | Proposed canonical slug | Type     | Source and action                                                   | Support                              |
| ---- | ---------------------------- | ----------------------- | -------- | ------------------------------------------------------------------- | ------------------------------------ |
| P002 | Start with Oore              | `/start`                | landing  | S002 retained and rewritten as the group index                      | Default — T1                         |
| P003 | Check that your Mac is ready | `/start/prerequisites`  | task     | S003 retained and rewritten                                         | Default — T1                         |
| P004 | Install Oore on one Mac      | `/start/install`        | task     | S004 retained; advanced installer material splits to P080           | Default — T1; installer boundary T17 |
| P005 | Open Oore for the first time | `/start/first-run`      | task     | S005 retained; maintainer-only link and material removed            | Default — T1                         |
| P006 | Build your first debug APK   | `/start/first-build`    | tutorial | S006 retained; S014 supplies only the verified UI-template fragment | Default — T1, T7, T10                |

## 2. Build and distribute

| ID   | Title                | Proposed canonical slug | Type    | Source and action                              | Support |
| ---- | -------------------- | ----------------------- | ------- | ---------------------------------------------- | ------- |
| P007 | Build and distribute | `/build`                | landing | S011 retained and rewritten as the group index | —       |

**Visible folder: Projects**

| ID   | Title            | Proposed canonical slug  | Type | Source and action           | Support                             |
| ---- | ---------------- | ------------------------ | ---- | --------------------------- | ----------------------------------- |
| P008 | Create a project | `/build/projects/create` | task | S012 retained and rewritten | Default local repository path first |

**Visible folder: Pipelines**

| ID   | Title                           | Proposed canonical slug       | Type | Source and action                                       | Support |
| ---- | ------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- | ------- |
| P009 | Configure a repository pipeline | `/build/pipelines/oore-yaml`  | task | S013 retained; exact command material splits to P076    | —       |
| P010 | Configure a pipeline in the UI  | `/build/pipelines/use-the-ui` | task | S014 retained; first-success fragment also informs P006 | —       |

**Visible folder: Run builds**

| ID   | Title           | Proposed canonical slug | Type | Source and action           | Support |
| ---- | --------------- | ----------------------- | ---- | --------------------------- | ------- |
| P011 | Trigger a build | `/build/run/trigger`    | task | S015 retained and rewritten | —       |
| P012 | Cancel a build  | `/build/run/cancel`     | task | S016 retained and rewritten | —       |

**Visible folder: Sources**

| ID   | Title                        | Proposed canonical slug                | Type | Source and action                                               | Support                               |
| ---- | ---------------------------- | -------------------------------------- | ---- | --------------------------------------------------------------- | ------------------------------------- |
| P013 | Connect GitHub               | `/build/sources/github`                | task | S017 retained; duplicate S007 merged                            | —                                     |
| P014 | Connect GitLab               | `/build/sources/gitlab`                | task | S018 retained; deployment-specific assumptions removed          | —                                     |
| P015 | Troubleshoot source webhooks | `/build/sources/webhooks/troubleshoot` | task | S019 retained and rewritten around observable delivery failures | Illustrative named tunnels only — T15 |

**Visible folder: Sign builds**

| ID   | Title                                          | Proposed canonical slug             | Type | Source and action                    | Support                           |
| ---- | ---------------------------------------------- | ----------------------------------- | ---- | ------------------------------------ | --------------------------------- |
| P016 | Add Android signing                            | `/build/sign/android`               | task | S020 retained; duplicate S008 merged | Product blockers constrain claims |
| P017 | Configure Gradle for Android signing           | `/build/sign/android/gradle`        | task | S021 retained and rewritten          | Product blockers constrain claims |
| P018 | Add iOS certificates and provisioning profiles | `/build/sign/ios/certificates`      | task | S022 retained and rewritten          | Product blockers constrain claims |
| P019 | Configure manual iOS signing                   | `/build/sign/ios/manual`            | task | S023 retained and rewritten          | Product blockers constrain claims |
| P020 | Configure App Store Connect signing            | `/build/sign/ios/app-store-connect` | task | S024 retained and rewritten          | Product blockers constrain claims |

**Visible folder: Distribute builds**

| ID   | Title                       | Proposed canonical slug             | Type | Source and action                                                                       | Support                 |
| ---- | --------------------------- | ----------------------------------- | ---- | --------------------------------------------------------------------------------------- | ----------------------- |
| P021 | Register an iOS test device | `/build/distribute/ios-devices`     | task | S025 retained and rewritten                                                             | —                       |
| P022 | Download a build artifact   | `/build/distribute/download`        | task | S027 retained and rewritten                                                             | Supported — T12         |
| P023 | Install an Android build    | `/build/distribute/install/android` | task | S028 retained as the primary platform task                                              | Advanced delivery — T13 |
| P024 | Install an iOS build        | `/build/distribute/install/ios`     | task | S028 split because iOS has different signing, manifest, token, and device preconditions | Advanced delivery — T13 |

## 3. Team and access

| ID   | Title           | Proposed canonical slug | Type    | Source and action                                                       | Support |
| ---- | --------------- | ----------------------- | ------- | ----------------------------------------------------------------------- | ------- |
| P025 | Team and access | `/team`                 | landing | New group index synthesized from bounded landing fragments of S029–S032 | —       |

**Visible folder: People**

| ID   | Title                           | Proposed canonical slug | Type | Source and action                    | Support |
| ---- | ------------------------------- | ----------------------- | ---- | ------------------------------------ | ------- |
| P026 | Invite a team member            | `/team/invite`          | task | S029 retained; duplicate S009 merged | —       |
| P027 | Manage roles and project access | `/team/roles`           | task | S030 retained and rewritten          | —       |
| P028 | Disable or restore a user       | `/team/disable-users`   | task | S031 retained and rewritten          | —       |

**Visible folder: Access**

| ID   | Title                                     | Proposed canonical slug      | Type    | Source and action                                                                             | Support                     |
| ---- | ----------------------------------------- | ---------------------------- | ------- | --------------------------------------------------------------------------------------------- | --------------------------- |
| P029 | Configure External Access                 | `/team/access`               | landing | S005, S032, S047, and S080 split only their shared mode-selection and trust-boundary material | Supported/Advanced — T2, T3 |
| P030 | Configure External Access (OIDC)          | `/team/access/oidc`          | task    | S032 retained and rewritten as the OIDC folder index                                          | Supported — T2              |
| P031 | Configure Google OIDC                     | `/team/access/oidc/google`   | task    | S033 retained and rewritten                                                                   | Supported — T2              |
| P032 | Configure Microsoft Entra ID OIDC         | `/team/access/oidc/entra`    | task    | S034 retained and renamed from Azure AD                                                       | Supported — T2              |
| P033 | Configure Okta OIDC                       | `/team/access/oidc/okta`     | task    | S035 retained and rewritten                                                                   | Supported — T2              |
| P034 | Configure Auth0 OIDC                      | `/team/access/oidc/auth0`    | task    | S036 retained and rewritten                                                                   | Supported — T2              |
| P035 | Configure Keycloak OIDC                   | `/team/access/oidc/keycloak` | task    | S037 retained and rewritten                                                                   | Supported — T2              |
| P036 | Configure External Access (Trusted Proxy) | `/team/access/trusted-proxy` | task    | S005, S047, and S080 split the generic implemented task from their mixed-purpose pages        | Advanced — T3               |

## 4. Operate Oore

| ID   | Title        | Proposed canonical slug | Type    | Source and action                                                                         | Support |
| ---- | ------------ | ----------------------- | ------- | ----------------------------------------------------------------------------------------- | ------- |
| P037 | Operate Oore | `/operate`              | landing | S079 retained and rewritten as the group index; maintainer-only link and material removed | —       |

**Visible folder: Deployment**

| ID   | Title                          | Proposed canonical slug       | Type    | Source and action                                                                                 | Support                                |
| ---- | ------------------------------ | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| P038 | Choose a supported deployment  | `/operate/deploy`             | landing | S080 retained as the deployment index; distinct access/client jobs split to P029, P036, and P041  | T1–T13; T15 illustrative; T17 boundary |
| P039 | Split the frontend and backend | `/operate/deploy/split-roles` | task    | S081 retained; S080 supplies shared support boundaries; maintainer-only link and material removed | Advanced — T6                          |

**Visible folder: Browser clients**

| ID   | Title                   | Proposed canonical slug          | Type | Source and action                                                           | Support                                                    |
| ---- | ----------------------- | -------------------------------- | ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| P040 | Connect the hosted UI   | `/operate/access/hosted-ui`      | task | S010 retained; S080 supplies deployment prerequisites                       | Supported — T4; requires External Access                   |
| P041 | Self-host the static UI | `/operate/access/self-hosted-ui` | task | S080 split because direct static hosting is a distinct supported client job | Supported — T5; requires External Access when cross-origin |

**Visible folder: Runners**

| ID   | Title                     | Proposed canonical slug   | Type | Source and action                                             | Support                                       |
| ---- | ------------------------- | ------------------------- | ---- | ------------------------------------------------------------- | --------------------------------------------- |
| P042 | Add a Direct macOS runner | `/operate/runners/direct` | task | S038 retained; one-time migration and protocol detail removed | Default same-Mac T7; supported another-Mac T8 |

**Visible folder: Instances**

| ID   | Title                     | Proposed canonical slug     | Type | Source and action                                    | Support        |
| ---- | ------------------------- | --------------------------- | ---- | ---------------------------------------------------- | -------------- |
| P043 | Add another Oore instance | `/operate/instances/add`    | task | S040 retained; browser implementation detail removed | Supported — T9 |
| P044 | Switch Oore instances     | `/operate/instances/switch` | task | S041 retained; browser implementation detail removed | Supported — T9 |

**Visible folder: Storage**

| ID   | Title                      | Proposed canonical slug      | Type | Source and action           | Support                                |
| ---- | -------------------------- | ---------------------------- | ---- | --------------------------- | -------------------------------------- |
| P045 | Configure artifact storage | `/operate/storage/artifacts` | task | S026 retained and rewritten | Default local T10; supported S3/R2 T11 |

**Visible folder: Maintain**

| ID   | Title                      | Proposed canonical slug             | Type | Source and action                                                                                                         | Support                                         |
| ---- | -------------------------- | ----------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P046 | Monitor Oore               | `/operate/maintain/monitor`         | task | S083 retained and rewritten                                                                                               | Generic signals only; T15 examples illustrative |
| P047 | Upgrade Oore               | `/operate/maintain/upgrade`         | task | S084 retained; one-time migrations and raw service repair removed                                                         | Installer/updater boundary — T17                |
| P048 | Create and verify a backup | `/operate/maintain/backups/create`  | task | S085 retained as the primary backup task                                                                                  | Default managed data layout only                |
| P049 | Restore a backup           | `/operate/maintain/backups/restore` | task | S085 split because restore has stopped-service, replacement, integrity, and rollback preconditions distinct from creation | Default managed data layout only                |
| P050 | Choose a release channel   | `/operate/releases`                 | task | S088 retained; internal automation and unrelated onboarding removed                                                       | —                                               |

**Visible folder: Recover**

| ID   | Title                      | Proposed canonical slug  | Type | Source and action                                                                | Support                  |
| ---- | -------------------------- | ------------------------ | ---- | -------------------------------------------------------------------------------- | ------------------------ |
| P051 | Reset an Oore installation | `/operate/recover/reset` | task | S087 supplies the recovery boundary; S086 merges its backup-first reset material | Installer boundary — T17 |

**Visible folder: Troubleshooting**

| ID   | Title                    | Proposed canonical slug      | Type      | Source and action                                                           | Support |
| ---- | ------------------------ | ---------------------------- | --------- | --------------------------------------------------------------------------- | ------- |
| P052 | Troubleshoot Oore        | `/operate/troubleshoot`      | task      | S087 retained as a symptom-led routing task; exact values stay in Reference | —       |
| P053 | Review known limitations | `/operate/known-limitations` | reference | S089 retained only with a named public owner and maintained source          | —       |

**Visible folder: Support**

| ID   | Title           | Proposed canonical slug            | Type | Source and action                    | Support |
| ---- | --------------- | ---------------------------------- | ---- | ------------------------------------ | ------- |
| P054 | Report an issue | `/operate/support/report-an-issue` | task | S090 retained; duplicate S091 merged | —       |

## 5. Understand Oore

| ID   | Title                                    | Proposed canonical slug              | Type    | Source and action                                                                | Support                           |
| ---- | ---------------------------------------- | ------------------------------------ | ------- | -------------------------------------------------------------------------------- | --------------------------------- |
| P055 | Understand Oore                          | `/understand`                        | landing | New group index synthesized from bounded landing fragments of S042–S049          | —                                 |
| P056 | How Oore is structured                   | `/understand/architecture`           | concept | S042 retained; internal deployment history removed                               | T1, T4–T8 boundaries              |
| P057 | How a build moves from queue to artifact | `/understand/build-lifecycle`        | concept | S043 retained and rewritten                                                      | Direct runners only — T7, T8, T14 |
| P058 | How Oore chooses pipeline configuration  | `/understand/pipeline-configuration` | concept | S044 retained and rewritten                                                      | —                                 |
| P059 | How signing works in Oore                | `/understand/signing`                | concept | S045 retained and narrowed to proven claims                                      | Product blockers constrain claims |
| P060 | How artifact delivery works              | `/understand/artifact-delivery`      | concept | S046 retained and rewritten                                                      | T10–T13                           |
| P061 | Oore's security model                    | `/understand/security`               | concept | S047 retained; task fragments split to P029 and P036                             | T1–T3, T7, T8                     |
| P062 | How multiple instances stay separate     | `/understand/multiple-instances`     | concept | S048 retained; browser-library detail removed                                    | Supported — T9                    |
| P063 | How Oore trusts Direct macOS runners     | `/understand/runner-trust`           | concept | S049 retained; unsupported S039 redirects here; operation detail stays generated | T7, T8; T14 unsupported           |

## 6. Reference

| ID   | Title     | Proposed canonical slug | Type    | Source and action                              | Support |
| ---- | --------- | ----------------------- | ------- | ---------------------------------------------- | ------- |
| P064 | Reference | `/reference`            | landing | S050 retained and rewritten as the group index | —       |

**Visible folder: Product values**

| ID   | Title                 | Proposed canonical slug   | Type      | Source and action                                                                       | Support |
| ---- | --------------------- | ------------------------- | --------- | --------------------------------------------------------------------------------------- | ------- |
| P065 | Error codes           | `/reference/errors`       | reference | S051 retained and mechanically validated; never claim a hand-maintained exhaustive list | —       |
| P066 | Build states          | `/reference/build-states` | reference | S052 retained and mechanically validated                                                | —       |
| P067 | Setup states          | `/reference/setup-states` | reference | S053 retained and mechanically validated                                                | —       |
| P068 | Roles and permissions | `/reference/roles`        | reference | S054 retained and mechanically validated                                                | —       |

**Visible folder: CLI**

| ID   | Title                    | Proposed canonical slug                 | Type      | Source and action                                                         | Support                           |
| ---- | ------------------------ | --------------------------------------- | --------- | ------------------------------------------------------------------------- | --------------------------------- |
| P069 | `oore` command reference | `/reference/cli`                        | landing   | S055 retained and validated as the CLI folder index                       | T7, T8, T17 boundaries            |
| P070 | `oore config`            | `/reference/cli/oore-config`            | reference | S056 retained and validated; alpha history removed                        | —                                 |
| P071 | `oore setup`             | `/reference/cli/oore-setup`             | reference | S057 retained and validated                                               | T1–T3                             |
| P072 | `oore recovery`          | `/reference/cli/oore-recovery`          | reference | S058 retained and validated                                               | External Access recovery boundary |
| P073 | `oore doctor`            | `/reference/cli/oore-doctor`            | reference | S059 retained and validated                                               | —                                 |
| P074 | `oore status`            | `/reference/cli/oore-status`            | reference | S060 retained and validated                                               | —                                 |
| P075 | `oore login`             | `/reference/cli/oore-login`             | reference | S061 retained and validated                                               | T1–T3                             |
| P076 | `oore pipeline validate` | `/reference/cli/oore-pipeline-validate` | reference | S055 and S013 split the exact command from their mixed command/task pages | —                                 |

**Visible folder: Configuration**

| ID   | Title                   | Proposed canonical slug         | Type      | Source and action                                                        | Support         |
| ---- | ----------------------- | ------------------------------- | --------- | ------------------------------------------------------------------------ | --------------- |
| P077 | `.oore.yaml`            | `/reference/config/oore-yaml`   | reference | S062 retained and mechanically validated                                 | —               |
| P078 | Daemon configuration    | `/reference/config/daemon`      | reference | S063 retained and mechanically validated                                 | T2–T6           |
| P079 | Environment variables   | `/reference/config/environment` | reference | S064 retained and mechanically validated                                 | T2, T3, T6, T13 |
| P080 | Installer configuration | `/reference/config/installer`   | reference | S065 retained; S004 supplies split role, automation, and variable detail | T1, T6–T8, T17  |

**Visible folder: API**

| ID   | Title    | Proposed canonical slug | Type    | Source and action                                                   | Support                                               |
| ---- | -------- | ----------------------- | ------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| P081 | HTTP API | `/reference/api`        | landing | S078 retained as the sole authored API landing; pointer S066 merged | Generated contract is drift-blocked where noted below |

<!-- CANONICAL_TREE_END -->

## Generated OpenAPI subtree

P081 is the only authored API page. It explains authentication and base URL
scope, links the machine-readable `openapi.json`, states known contract drift,
and routes readers into generated operations. It does not hand-copy endpoint
inventories or schemas.

The OpenAPI loader generates exactly one page for each operation and nests all
of them beneath **Reference → HTTP API → Operations**. Tag groups are generated
navigation nodes, not authored pages:

| Generated group order | Visible generated group | Exact OpenAPI tag        | Operation pages | Declaration status                                           |
| --------------------: | ----------------------- | ------------------------ | --------------: | ------------------------------------------------------------ |
|                     1 | Health                  | `Health`                 |               1 | Declared                                                     |
|                     2 | Setup                   | `Setup`                  |              12 | Declared                                                     |
|                     3 | Auth                    | `Auth`                   |               5 | Declared                                                     |
|                     4 | Users                   | `Users`                  |               6 | Declared                                                     |
|                     5 | Instance settings       | `Instance Settings`      |              12 | Declared                                                     |
|                     6 | Retention policy        | `Retention Policy`       |               6 | Declared                                                     |
|                     7 | Integrations            | `Integrations`           |              16 | Declared; exact API noun under Reference                     |
|                     8 | Projects                | `Projects`               |               5 | Declared                                                     |
|                     9 | Project members         | `Project Members`        |               5 | Declared                                                     |
|                    10 | Pipelines               | `Pipelines`              |               7 | Declared                                                     |
|                    11 | Pipeline signing        | `Pipeline Signing`       |               7 | Declared                                                     |
|                    12 | Builds                  | `Builds`                 |               6 | Declared                                                     |
|                    13 | Runners                 | `Runners`                |              10 | Declared                                                     |
|                    14 | Build logs              | `Build Logs`             |               4 | Declared                                                     |
|                    15 | Artifacts               | `Artifacts`              |               9 | Declared                                                     |
|                    16 | Notification channels   | `Notification Channels`  |               7 | Declared                                                     |
|                    17 | Audit logs              | `Audit Logs`             |               1 | Declared                                                     |
|                    18 | API tokens              | `API Tokens`             |               3 | Declared                                                     |
|                    19 | Webhooks                | `Webhooks`               |               2 | Declared                                                     |
|                    20 | System                  | `System`                 |               2 | Used by operations but missing from the root tag declaration |
|                    21 | Scoped download tokens  | `Scoped Download Tokens` |               4 | Used by operations but missing from the root tag declaration |
|                       | **Total**               |                          |         **130** | **21 used; 19 declared**                                     |

For compatibility entry points, those exact tags roll up into 11 named
generated category nodes beneath P081. These are generated navigation
categories, not authored pointer pages:

| Generated category node | Exact generated tag group(s)                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| Authentication          | `Auth`, `API Tokens`                                                       |
| Builds                  | `Builds`                                                                   |
| Users                   | `Users`                                                                    |
| Projects                | `Projects`, `Project Members`                                              |
| Artifacts               | `Artifacts`, `Scoped Download Tokens`                                      |
| Sources                 | `Integrations`, `Webhooks`                                                 |
| Pipelines               | `Pipelines`, `Pipeline Signing`                                            |
| Setup                   | `Health`, `Setup`                                                          |
| Logs                    | `Build Logs`, `Audit Logs`                                                 |
| Settings                | `Instance Settings`, `Retention Policy`, `Notification Channels`, `System` |
| Runners                 | `Runners`                                                                  |

Each generated page title comes from its OpenAPI operation summary and must
also show the exact method and path. The generated slug rule remains:

```text
/openapi/operations/<operationId>
```

Visual nesting under Reference does not authorize an operation URL move.
Changing the rule to `/reference/api/operations/<operationId>` requires #204
to define and verify a direct redirect for **all 130** old operation URLs. This
tree preserves the current operation URLs while presenting those generated
nodes beneath Reference; it does not create a competing top-level OpenAPI
branch.

The generated surface must not be described as complete or canonical where
runtime and export disagree. The accepted truth table records:

- runtime inventory: **117 paths / 145 operations**
- exporter inventory: **102 paths / 130 operations**
- **15** runtime operations absent from the export
- **4** drifted `BuildContext` fields between the fresh and checked exports
- an undefined root bearer scheme
- the two undeclared operation tags above
- response-status drift on generated operations

Those are product/reference blockers, not permission to hand-author replacement
API pages.

## Legacy API pointer destinations

The 12 `reference/api/**` authored pointers never survive as authored,
searchable pages. The index content merges into P081. Each of the other 11
sources maps to one named generated category node. It must not redirect to an
arbitrary first or representative operation. #204 must choose a stable direct
category landing or compatibility route for each node; until then, the legacy
entry URL remains a compatibility obligation rather than a self-redirect.

| Source ID | Legacy pointer     | Disposition | Named generated destination     | Stable direct route |
| --------- | ------------------ | ----------- | ------------------------------- | ------------------- |
| S066      | API index          | Merge       | P081, **HTTP API**              | `/reference/api`    |
| S067      | Authentication API | Redirect    | **Authentication** beneath P081 | #204 must choose    |
| S068      | Builds API         | Redirect    | **Builds** beneath P081         | #204 must choose    |
| S069      | Users API          | Redirect    | **Users** beneath P081          | #204 must choose    |
| S070      | Projects API       | Redirect    | **Projects** beneath P081       | #204 must choose    |
| S071      | Artifacts API      | Redirect    | **Artifacts** beneath P081      | #204 must choose    |
| S072      | Integrations API   | Redirect    | **Sources** beneath P081        | #204 must choose    |
| S073      | Pipelines API      | Redirect    | **Pipelines** beneath P081      | #204 must choose    |
| S074      | Setup API          | Redirect    | **Setup** beneath P081          | #204 must choose    |
| S075      | Build logs API     | Redirect    | **Logs** beneath P081           | #204 must choose    |
| S076      | Settings API       | Redirect    | **Settings** beneath P081       | #204 must choose    |
| S077      | Runners API        | Redirect    | **Runners** beneath P081        | #204 must choose    |

## Folder indexes and visible hierarchy

The current corpus has nine authored index sources:

- root home
- Getting started
- Guides
- OIDC
- Reference
- CLI
- the legacy authored API pointer index
- the authored OpenAPI landing
- Operations

The two API indexes collapse into one P081 landing, so those nine sources
produce eight retained index destinations. P025 **Team and access** and P055
**Understand Oore** are new genuine group landings because neither current
branch has an authored index. The final tree therefore has ten direct
root/group-derived index destinations before the additional clickable nested
indexes required by the new hierarchy.

These page nodes are clickable folder indexes and must remain visible:

| Index page                 | Folder whose index it owns |
| -------------------------- | -------------------------- |
| P001 `/`                   | page-tree root             |
| P002 `/start`              | Start with Oore            |
| P007 `/build`              | Build and distribute       |
| P016 `/build/sign/android` | Android signing            |
| P025 `/team`               | Team and access            |
| P029 `/team/access`        | Access                     |
| P030 `/team/access/oidc`   | OIDC                       |
| P037 `/operate`            | Operate Oore               |
| P038 `/operate/deploy`     | Deployment                 |
| P055 `/understand`         | Understand Oore            |
| P064 `/reference`          | Reference                  |
| P069 `/reference/cli`      | CLI                        |
| P081 `/reference/api`      | API                        |

All other bold nested folders in the tree remain visible, non-clickable folder
nodes. They are not flattened into their parent and do not masquerade as
authored landing pages.

## `meta.json` and Fumadocs ordering contract

These rules are sufficient for implementation without prescribing code:

1. The root `meta.json` orders exactly `index`, `start`, `build`, `team`,
   `operate`, `understand`, and `reference`. `index` is the root landing; the
   following six entries are the only top-level content groups.
2. Every folder uses a nested `meta.json` with an explicit `pages` array in the
   exact order shown above. Because Fumadocs excludes unlisted items when
   `pages` is present, every authored page or child folder must be named once;
   do not rely on alphabetical rest ordering.
3. Every clickable index listed in the preceding table is a real `index.md` or
   `index.mdx` at that folder path and is selected with the folder's
   `pagesIndex`. It is not duplicated as a link node.
4. Do not set `root: true` on Start, Build, Team, Operate, Understand,
   Reference, or any descendant. A Fumadocs root folder hides the other roots
   from sidebar and navigation context, which would fragment the required
   single hierarchy.
5. Do not use `...folder` extraction. Extraction lifts children out of their
   visible folder and would flatten the user-facing hierarchy and its
   breadcrumbs.
6. Do not place the same page URL or page item twice. Fumadocs resolves the
   active tree item by pathname and explicitly rejects duplicate URLs.
7. The authored Astro content source and OpenAPI virtual source feed one
   loader. The root metadata references the API branch only through Reference;
   generated tag and operation nodes come from the OpenAPI loader/plugin, not
   handwritten metadata for 130 pages.
8. The docs layout consumes `source.getPageTree()` directly. No authored
   navbar, mobile list, folder-root list, route manifest, or previous/next map
   may repeat the hierarchy.
9. Contributor documentation is not added to this loader or its `meta.json`
   files. Internal operations have no public placeholder node.
10. Implementation acceptance must compare sidebar, breadcrumbs,
    previous/next, and mobile navigation for the same nested page and prove
    they agree with this one ordered tree.

These rules follow the version-matched Fumadocs page conventions: folder
indexes are real index items, `pages` is exclusive ordering, `root: true`
changes navigation visibility, `...folder` extracts children, and duplicate
URLs are forbidden.

## Split and merge rationale

The 81-page destination tree is intentionally not a one-file rename of the
72 retained source pages.

| Source(s)                | Resulting page(s)                                                                | Why the boundary is real                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S028                     | P023 Android install; P024 iOS install                                           | Android downloads an APK; iOS uses signing, device eligibility, a manifest, and a reusable scoped capability. Preconditions, failure modes, and verification differ.                            |
| S085                     | P048 create/verify; P049 restore                                                 | Backup creation can run against a live instance. Restore replaces state under stopped-service and rollback preconditions. Combining them would mix safe routine work with destructive recovery. |
| S080 with S005/S032/S047 | P029 access landing; P036 Trusted Proxy; P038 deployment landing; P041 static UI | Access mode, proxy trust, deployment choice, and client hosting are separate operator jobs with different support levels and trust boundaries.                                                  |
| S004 with S065           | P004 beginner install; P080 installer reference                                  | The first install needs one default path. Roles, variables, automation, and advanced installer inputs are exact lookup material.                                                                |
| S006 with S014           | P006 first-build tutorial; P010 UI-pipeline task                                 | The tutorial needs only the verified **Quick Debug APK** route. General UI pipeline authoring remains a separate known task.                                                                    |
| S013 with S055           | P009 repository-pipeline task; P069 CLI index; P076 exact command reference      | Motivation, task steps, command discovery, and exact command behavior are three different page types.                                                                                           |
| S049                     | P063 concept; generated runner operations                                        | Trust and lifecycle are a mental model. Protocol methods, payloads, and statuses come from generated OpenAPI, not copied prose.                                                                 |
| S086 with S087           | P051 reset; P052 troubleshooting                                                 | A destructive reset has backup and confirmation preconditions. General troubleshooting stays symptom-led and non-destructive.                                                                   |
| S088                     | P050 release-channel task only                                                   | Public channel choice survives. Onboarding, auth, demo, reset, internal workflow, and release-machine material do not become extra pages.                                                       |

The four known duplicate journeys collapse exactly once:

- GitHub connection: S007 merges into P013.
- Android signing: S008 merges into P016.
- Invitations: S009 merges into P026.
- Issue reporting: S091 merges into P054.

The remaining merges are the API index collision (S066 into P081) and
backup-first reset material (S086 into P051).

## Conservative content gates

All rewrites use the public terms **Local Only**, **External Access**,
**Sources**, and **Direct macOS runner**. Exact literals such as
`runtime_mode: "remote"` or legacy API nouns appear only where reference
accuracy requires them.

The tree does not invent answers around the six truth-table blockers:

1. OIDC examples always supply the exact frontend callback URI ending in
   `/auth/callback`; they do not claim omission works.
2. Signing prose may state that repository child processes do not receive
   signing secrets and that signing runs after repository build commands; it
   does not claim material is fetched only after every repository-controlled
   stage.
3. iOS signing may state that the runner account must be logged in and that
   Oore uses and attempts to clean up a temporary job keychain; it does not
   promise the default keychain or search list is never changed.
4. Public installation and repair use the installer/updater boundary. No page
   teaches a user-owned Oore executable through `sudo` or raw privileged
   service installation.
5. Manual backup covers the default managed database/key layout. A custom
   database plus custom key path remains outside the task.
6. Deployment claims stop at the accepted T1–T17 support rows. Named
   infrastructure is illustrative, and Oore's own infrastructure and release
   operations remain private.

Hosted UI appears after External Access and is always described as a UI-only
browser client. It never hosts or proxies an Oore backend, runner, build,
credential store, or artifact store.

## Exact-once source accounting

Each source path occurs exactly once between the accounting markers. The
destination column names one primary tree node, one merge target, one generated
redirect target, or no public destination. Split fragments never change the
source's one final category.

<!-- SOURCE_ACCOUNTING_BEGIN -->

| Source ID | Authored source path                                       | Final disposition  | Primary named destination                                                                                 | Internal |
| --------- | ---------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- | -------- |
| S001      | `apps/docs/docs/index.mdx`                                 | Retain/rewrite     | P001 Oore documentation (`/`)                                                                             | No       |
| S002      | `apps/docs/docs/getting-started/index.md`                  | Retain/rewrite     | P002 Start with Oore (`/start`)                                                                           | No       |
| S003      | `apps/docs/docs/getting-started/prerequisites.md`          | Retain/rewrite     | P003 Check that your Mac is ready (`/start/prerequisites`)                                                | No       |
| S004      | `apps/docs/docs/getting-started/install.md`                | Retain/rewrite     | P004 Install Oore on one Mac (`/start/install`)                                                           | Mixed    |
| S005      | `apps/docs/docs/getting-started/first-instance.md`         | Retain/rewrite     | P005 Open Oore for the first time (`/start/first-run`); remove maintainer-only link/material              | Mixed    |
| S006      | `apps/docs/docs/getting-started/first-build.md`            | Retain/rewrite     | P006 Build your first debug APK (`/start/first-build`)                                                    | Mixed    |
| S007      | `apps/docs/docs/getting-started/connect-github.md`         | Merge              | P013 Connect GitHub (`/build/sources/github`)                                                             | No       |
| S008      | `apps/docs/docs/getting-started/first-signed-build.md`     | Merge              | P016 Add Android signing (`/build/sign/android`)                                                          | No       |
| S009      | `apps/docs/docs/getting-started/invite-your-team.md`       | Merge              | P026 Invite a team member (`/team/invite`)                                                                | No       |
| S010      | `apps/docs/docs/getting-started/hosted-ui-onboarding.md`   | Retain/rewrite     | P040 Connect the hosted UI (`/operate/access/hosted-ui`)                                                  | No       |
| S011      | `apps/docs/docs/guides/index.md`                           | Retain/rewrite     | P007 Build and distribute (`/build`)                                                                      | No       |
| S012      | `apps/docs/docs/guides/projects/create-project.md`         | Retain/rewrite     | P008 Create a project (`/build/projects/create`)                                                          | No       |
| S013      | `apps/docs/docs/guides/projects/pipeline-config.md`        | Retain/rewrite     | P009 Configure a repository pipeline (`/build/pipelines/oore-yaml`)                                       | No       |
| S014      | `apps/docs/docs/guides/projects/pipeline-ui-fallback.md`   | Retain/rewrite     | P010 Configure a pipeline in the UI (`/build/pipelines/use-the-ui`)                                       | No       |
| S015      | `apps/docs/docs/guides/projects/trigger-builds.md`         | Retain/rewrite     | P011 Trigger a build (`/build/run/trigger`)                                                               | No       |
| S016      | `apps/docs/docs/guides/projects/cancel-builds.md`          | Retain/rewrite     | P012 Cancel a build (`/build/run/cancel`)                                                                 | No       |
| S017      | `apps/docs/docs/guides/integrations/github-app.md`         | Retain/rewrite     | P013 Connect GitHub (`/build/sources/github`)                                                             | No       |
| S018      | `apps/docs/docs/guides/integrations/gitlab.md`             | Retain/rewrite     | P014 Connect GitLab (`/build/sources/gitlab`)                                                             | Mixed    |
| S019      | `apps/docs/docs/guides/integrations/webhooks.md`           | Retain/rewrite     | P015 Troubleshoot source webhooks (`/build/sources/webhooks/troubleshoot`)                                | No       |
| S020      | `apps/docs/docs/guides/signing/android-keystore.md`        | Retain/rewrite     | P016 Add Android signing (`/build/sign/android`)                                                          | No       |
| S021      | `apps/docs/docs/guides/signing/android-gradle.md`          | Retain/rewrite     | P017 Configure Gradle for Android signing (`/build/sign/android/gradle`)                                  | No       |
| S022      | `apps/docs/docs/guides/signing/ios-certificates.md`        | Retain/rewrite     | P018 Add iOS certificates and provisioning profiles (`/build/sign/ios/certificates`)                      | No       |
| S023      | `apps/docs/docs/guides/signing/ios-manual-signing.md`      | Retain/rewrite     | P019 Configure manual iOS signing (`/build/sign/ios/manual`)                                              | No       |
| S024      | `apps/docs/docs/guides/signing/ios-api-signing.md`         | Retain/rewrite     | P020 Configure App Store Connect signing (`/build/sign/ios/app-store-connect`)                            | No       |
| S025      | `apps/docs/docs/guides/signing/ios-device-registration.md` | Retain/rewrite     | P021 Register an iOS test device (`/build/distribute/ios-devices`)                                        | No       |
| S026      | `apps/docs/docs/guides/artifacts/configure-storage.md`     | Retain/rewrite     | P045 Configure artifact storage (`/operate/storage/artifacts`)                                            | No       |
| S027      | `apps/docs/docs/guides/artifacts/download-artifacts.md`    | Retain/rewrite     | P022 Download a build artifact (`/build/distribute/download`)                                             | No       |
| S028      | `apps/docs/docs/guides/artifacts/install-mobile-builds.md` | Retain/rewrite     | P023 Install an Android build (`/build/distribute/install/android`); split iOS task P024                  | No       |
| S029      | `apps/docs/docs/guides/users/invite-users.md`              | Retain/rewrite     | P026 Invite a team member (`/team/invite`)                                                                | No       |
| S030      | `apps/docs/docs/guides/users/manage-roles.md`              | Retain/rewrite     | P027 Manage roles and project access (`/team/roles`)                                                      | No       |
| S031      | `apps/docs/docs/guides/users/disable-users.md`             | Retain/rewrite     | P028 Disable or restore a user (`/team/disable-users`)                                                    | No       |
| S032      | `apps/docs/docs/guides/oidc/index.md`                      | Retain/rewrite     | P030 Configure External Access (OIDC) (`/team/access/oidc`)                                               | No       |
| S033      | `apps/docs/docs/guides/oidc/google.md`                     | Retain/rewrite     | P031 Configure Google OIDC (`/team/access/oidc/google`)                                                   | No       |
| S034      | `apps/docs/docs/guides/oidc/azure-ad.md`                   | Retain/rewrite     | P032 Configure Microsoft Entra ID OIDC (`/team/access/oidc/entra`)                                        | No       |
| S035      | `apps/docs/docs/guides/oidc/okta.md`                       | Retain/rewrite     | P033 Configure Okta OIDC (`/team/access/oidc/okta`)                                                       | No       |
| S036      | `apps/docs/docs/guides/oidc/auth0.md`                      | Retain/rewrite     | P034 Configure Auth0 OIDC (`/team/access/oidc/auth0`)                                                     | No       |
| S037      | `apps/docs/docs/guides/oidc/keycloak.md`                   | Retain/rewrite     | P035 Configure Keycloak OIDC (`/team/access/oidc/keycloak`)                                               | No       |
| S038      | `apps/docs/docs/guides/runners/external-runner.md`         | Retain/rewrite     | P042 Add a Direct macOS runner (`/operate/runners/direct`)                                                | Mixed    |
| S039      | `apps/docs/docs/guides/runners/embedded-runner.md`         | Redirect           | P063 How Oore trusts Direct macOS runners (`/understand/runner-trust`)                                    | Mixed    |
| S040      | `apps/docs/docs/guides/multi-instance/add-instance.md`     | Retain/rewrite     | P043 Add another Oore instance (`/operate/instances/add`)                                                 | Mixed    |
| S041      | `apps/docs/docs/guides/multi-instance/switch-instances.md` | Retain/rewrite     | P044 Switch Oore instances (`/operate/instances/switch`)                                                  | Mixed    |
| S042      | `apps/docs/docs/concepts/architecture.md`                  | Retain/rewrite     | P056 How Oore is structured (`/understand/architecture`)                                                  | Mixed    |
| S043      | `apps/docs/docs/concepts/build-execution.md`               | Retain/rewrite     | P057 How a build moves from queue to artifact (`/understand/build-lifecycle`)                             | No       |
| S044      | `apps/docs/docs/concepts/file-first-config.md`             | Retain/rewrite     | P058 How Oore chooses pipeline configuration (`/understand/pipeline-configuration`)                       | No       |
| S045      | `apps/docs/docs/concepts/signing-overview.md`              | Retain/rewrite     | P059 How signing works in Oore (`/understand/signing`)                                                    | No       |
| S046      | `apps/docs/docs/concepts/artifact-access.md`               | Retain/rewrite     | P060 How artifact delivery works (`/understand/artifact-delivery`)                                        | No       |
| S047      | `apps/docs/docs/concepts/security-model.md`                | Retain/rewrite     | P061 Oore's security model (`/understand/security`)                                                       | No       |
| S048      | `apps/docs/docs/concepts/multi-instance.md`                | Retain/rewrite     | P062 How multiple instances stay separate (`/understand/multiple-instances`)                              | Mixed    |
| S049      | `apps/docs/docs/concepts/runner-protocol.md`               | Retain/rewrite     | P063 How Oore trusts Direct macOS runners (`/understand/runner-trust`)                                    | No       |
| S050      | `apps/docs/docs/reference/index.md`                        | Retain/rewrite     | P064 Reference (`/reference`)                                                                             | No       |
| S051      | `apps/docs/docs/reference/error-codes.md`                  | Retain/rewrite     | P065 Error codes (`/reference/errors`)                                                                    | No       |
| S052      | `apps/docs/docs/reference/build-states.md`                 | Retain/rewrite     | P066 Build states (`/reference/build-states`)                                                             | No       |
| S053      | `apps/docs/docs/reference/setup-states.md`                 | Retain/rewrite     | P067 Setup states (`/reference/setup-states`)                                                             | No       |
| S054      | `apps/docs/docs/reference/rbac.md`                         | Retain/rewrite     | P068 Roles and permissions (`/reference/roles`)                                                           | No       |
| S055      | `apps/docs/docs/reference/cli/index.md`                    | Retain/rewrite     | P069 `oore` command reference (`/reference/cli`)                                                          | Mixed    |
| S056      | `apps/docs/docs/reference/cli/oore-config.md`              | Retain/rewrite     | P070 `oore config` (`/reference/cli/oore-config`)                                                         | Mixed    |
| S057      | `apps/docs/docs/reference/cli/oore-setup.md`               | Retain/rewrite     | P071 `oore setup` (`/reference/cli/oore-setup`)                                                           | No       |
| S058      | `apps/docs/docs/reference/cli/oore-recovery.md`            | Retain/rewrite     | P072 `oore recovery` (`/reference/cli/oore-recovery`)                                                     | No       |
| S059      | `apps/docs/docs/reference/cli/oore-doctor.md`              | Retain/rewrite     | P073 `oore doctor` (`/reference/cli/oore-doctor`)                                                         | No       |
| S060      | `apps/docs/docs/reference/cli/oore-status.md`              | Retain/rewrite     | P074 `oore status` (`/reference/cli/oore-status`)                                                         | No       |
| S061      | `apps/docs/docs/reference/cli/oore-login.md`               | Retain/rewrite     | P075 `oore login` (`/reference/cli/oore-login`)                                                           | Mixed    |
| S062      | `apps/docs/docs/reference/config/oore-yaml.md`             | Retain/rewrite     | P077 `.oore.yaml` (`/reference/config/oore-yaml`)                                                         | No       |
| S063      | `apps/docs/docs/reference/config/daemon-config.md`         | Retain/rewrite     | P078 Daemon configuration (`/reference/config/daemon`)                                                    | No       |
| S064      | `apps/docs/docs/reference/config/environment-variables.md` | Retain/rewrite     | P079 Environment variables (`/reference/config/environment`)                                              | Mixed    |
| S065      | `apps/docs/docs/reference/config/installer.md`             | Retain/rewrite     | P080 Installer configuration (`/reference/config/installer`)                                              | Mixed    |
| S066      | `apps/docs/docs/reference/api/index.md`                    | Merge              | P081 HTTP API (`/reference/api`)                                                                          | No       |
| S067      | `apps/docs/docs/reference/api/auth.md`                     | Redirect           | Generated **Authentication** category beneath P081; #204 chooses the stable direct route                  | No       |
| S068      | `apps/docs/docs/reference/api/builds.md`                   | Redirect           | Generated **Builds** category beneath P081; #204 chooses the stable direct route                          | No       |
| S069      | `apps/docs/docs/reference/api/users.md`                    | Redirect           | Generated **Users** category beneath P081; #204 chooses the stable direct route                           | No       |
| S070      | `apps/docs/docs/reference/api/projects.md`                 | Redirect           | Generated **Projects** category beneath P081; #204 chooses the stable direct route                        | No       |
| S071      | `apps/docs/docs/reference/api/artifacts.md`                | Redirect           | Generated **Artifacts** category beneath P081; #204 chooses the stable direct route                       | No       |
| S072      | `apps/docs/docs/reference/api/integrations.md`             | Redirect           | Generated **Sources** category beneath P081; #204 chooses the stable direct route                         | No       |
| S073      | `apps/docs/docs/reference/api/pipelines.md`                | Redirect           | Generated **Pipelines** category beneath P081; #204 chooses the stable direct route                       | No       |
| S074      | `apps/docs/docs/reference/api/setup.md`                    | Redirect           | Generated **Setup** category beneath P081; #204 chooses the stable direct route                           | No       |
| S075      | `apps/docs/docs/reference/api/logs.md`                     | Redirect           | Generated **Logs** category beneath P081; #204 chooses the stable direct route                            | No       |
| S076      | `apps/docs/docs/reference/api/settings.md`                 | Redirect           | Generated **Settings** category beneath P081; #204 chooses the stable direct route                        | No       |
| S077      | `apps/docs/docs/reference/api/runners.md`                  | Redirect           | Generated **Runners** category beneath P081; #204 chooses the stable direct route                         | No       |
| S078      | `apps/docs/docs/openapi/index.md`                          | Retain/rewrite     | P081 HTTP API (`/reference/api`)                                                                          | No       |
| S079      | `apps/docs/docs/operations/index.md`                       | Retain/rewrite     | P037 Operate Oore (`/operate`); remove maintainer-only link/material                                      | Mixed    |
| S080      | `apps/docs/docs/operations/deployment.md`                  | Retain/rewrite     | P038 Choose a supported deployment (`/operate/deploy`)                                                    | Mixed    |
| S081      | `apps/docs/docs/operations/split-roles.md`                 | Retain/rewrite     | P039 Split the frontend and backend (`/operate/deploy/split-roles`); remove maintainer-only link/material | Mixed    |
| S082      | `apps/docs/docs/operations/mac-studio-netbird-warpgate.md` | Remove as internal | No public page and no redirect to a private destination                                                   | Yes      |
| S083      | `apps/docs/docs/operations/monitoring.md`                  | Retain/rewrite     | P046 Monitor Oore (`/operate/maintain/monitor`)                                                           | No       |
| S084      | `apps/docs/docs/operations/upgrade.md`                     | Retain/rewrite     | P047 Upgrade Oore (`/operate/maintain/upgrade`)                                                           | Mixed    |
| S085      | `apps/docs/docs/operations/backup-restore.md`              | Retain/rewrite     | P048 Create and verify a backup (`/operate/maintain/backups/create`); split restore P049                  | No       |
| S086      | `apps/docs/docs/operations/clean-reinstall.md`             | Merge              | P051 Reset an Oore installation (`/operate/recover/reset`)                                                | Mixed    |
| S087      | `apps/docs/docs/operations/troubleshooting.md`             | Retain/rewrite     | P052 Troubleshoot Oore (`/operate/troubleshoot`)                                                          | Mixed    |
| S088      | `apps/docs/docs/operations/release-channels.md`            | Retain/rewrite     | P050 Choose a release channel (`/operate/releases`)                                                       | Mixed    |
| S089      | `apps/docs/docs/operations/known-limitations.md`           | Retain/rewrite     | P053 Review known limitations (`/operate/known-limitations`)                                              | Mixed    |
| S090      | `apps/docs/docs/operations/report-an-issue.md`             | Retain/rewrite     | P054 Report an issue (`/operate/support/report-an-issue`)                                                 | No       |
| S091      | `apps/docs/docs/operations/alpha-feedback.md`              | Merge              | P054 Report an issue (`/operate/support/report-an-issue`)                                                 | Mixed    |
| S092      | `apps/docs/docs/operations/release-automation-mac-mini.md` | Remove as internal | No public page and no redirect to a private destination                                                   | Yes      |

<!-- SOURCE_ACCOUNTING_END -->

## Existing redirect intent retained for #204

The five current explicit redirects remain requirements, but this prototype
does not decide their hosting syntax. Each must go directly to its final
destination without a chain:

| Existing source URL                        | Proposed final destination         |
| ------------------------------------------ | ---------------------------------- |
| `/getting-started/public-alpha`            | `/operate/releases`                |
| `/getting-started/known-limitations`       | `/operate/known-limitations`       |
| `/getting-started/issue-report-checklist`  | `/operate/support/report-an-issue` |
| `/getting-started/clean-reinstall`         | `/operate/recover/reset`           |
| `/getting-started/alpha-feedback-playbook` | `/operate/support/report-an-issue` |

## Mechanical acceptance

The prototype is acceptable only when a mechanical check proves all of the
following:

- the accounting section has 92 rows and 92 unique `apps/docs/docs/**`
  Markdown/MDX paths
- section arithmetic is `1 + 9 + 31 + 8 + 28 + 1 + 14 = 92`
- disposition totals are 72 retained/rewritten, 6 merged, 12 redirected, and 2
  removed
- internal totals are 66 No, 24 Mixed, and 2 Yes
- the canonical tree has 81 unique `P###` rows and 81 unique authored slugs
- the root entry plus group totals are
  `1 + 5 + 18 + 12 + 18 + 9 + 18 = 81`
- every retained primary destination `P###` exists exactly once in the tree
- all six top groups and all 13 clickable folder indexes are visible
- all 12 `reference/api/**` sources are merge/redirect-only
- the generated subtree is 102 paths, 130 unique operation IDs, and 21 used
  tags, with 19 declared and two drift tags
- generated operations appear only under Reference in the visible tree
- the two internal-only authored Operations sources have no public destination
- no page title or slug is duplicated
- no private infrastructure name, private link, credential, or release-machine
  detail enters public guidance
- public terminology uses Local Only, External Access, Sources, and Direct
  macOS runner
- no `root: true`, `...folder` extraction, competing navbar hierarchy, or
  wildcard OpenAPI authored page set is proposed
- Markdown has no trailing whitespace and `git diff --check` passes

## Resolution

Implement the populated tree above as one nested Fumadocs page tree. Preserve
real indexes, keep every human-visible page in exactly one branch, generate API
operations only below Reference, and use the exact source accounting as the
rewrite queue. URL redirect mechanics, including any 130-operation path move,
remain #204 work.
