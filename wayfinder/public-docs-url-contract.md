# Public documentation URL and redirect contract

Status: decision resolution for
[#204](https://github.com/oore-ci/oore.build/issues/204), at baseline
`66e56785394960f280b7c37244ed72b1dccca4bc`.

This artifact defines the public URL surface for the Astro and Fumadocs
documentation rebuild. It fixes canonical URLs, generated API category routes,
compatibility redirects, metadata and indexing behavior, direct static
requests, and real not-found behavior. It does not implement Astro, rewrite
public prose, change product behavior, deploy, or authorize a private
destination for removed material.

The accepted inputs are:

- [Official Fumadocs-on-Astro 7 architecture](https://github.com/oore-ci/oore.build/blob/962859b5df489f405701f5e9d3fda3ef9f7cbe0d/research/fumadocs-astro-7-architecture.md)
- [Public documentation disposition ledger](https://github.com/oore-ci/oore.build/blob/f9a9699d767012b8ed409c6622f1d2254cc8e37a/wayfinder/public-docs-page-ledger.md)
- [Public documentation truth table](https://github.com/oore-ci/oore.build/blob/ca90c65a6fefbd5cf1df460a083da46d52167fcf/wayfinder/public-docs-truth-table.md)
- [Public deployment contract](https://github.com/oore-ci/oore.build/blob/27fd4e86dcff9d1e073032d035d60669a8d2ab9c/wayfinder/public-deployment-contract.md)
- [Public documentation voice prototype](https://github.com/oore-ci/oore.build/blob/694e6311b9de4c04a7aa10b8639e58b9dfedb499/wayfinder/public-docs-voice-prototype.md)
- [Canonical public documentation tree](https://github.com/oore-ci/oore.build/blob/2d6e449864aca20de51ab7adc414076c15e83e55/wayfinder/canonical-docs-tree.md)

## Decision

The public documentation origin is `https://docs.oore.build`.

Canonical page paths are slashless except `/`. A canonical page returns its
own static HTML with HTTP `200`; a compatibility URL returns one direct
permanent `301`; a removed or unknown URL returns the real static
`404.html` with HTTP `404`.

The final page surface is derived from the parity-corrected OpenAPI document.
Let `N` be the number of unique, non-empty `operationId` values after the
exported method/path set exactly matches the production runtime method/path
set. Acceptance requires 117 paths, 145 operations, and `N = 145`. The checked
baseline document has only 102 paths and 130 operations; those 130 operation
URLs are a mandatory preserved subset. The corrected export adds exactly 15
generated operation URLs without renaming any preserved URL.

| Page class                   |             Canonical pages | URL rule                               |
| ---------------------------- | --------------------------: | -------------------------------------- |
| Authored                     |                          81 | Exact registry below                   |
| Generated API categories     |                          11 | `/reference/api/categories/<category>` |
| Generated OpenAPI operations |          `N` (required 145) | `/openapi/operations/<operationId>`    |
| **Total indexable pages**    | **`92 + N` (required 237)** | All slashless except `/`               |

The 92 current authored sources resolve exactly once:

| Accepted disposition | Sources |
| -------------------- | ------: |
| Retain or rewrite    |      72 |
| Merge                |       6 |
| Redirect             |      12 |
| Remove as internal   |       2 |
| **Total**            |  **92** |

Their URL responses after the rebuild are a separate, equally exhaustive
partition:

| Terminal response | Current source URLs |
| ----------------- | ------------------: |
| Canonical `200`   |                  14 |
| Direct `301`      |                  76 |
| Real `404`        |                   2 |
| **Total**         |              **92** |

`/reference/api` is the sole authored API landing. Both `/openapi` and
`/openapi/` redirect directly to it. Every generated operation URL remains at
`/openapi/operations/<operationId>` even though the one Fumadocs page tree
shows operations beneath **Reference → HTTP API**.

## Canonical authored destination registry

These are the 81 authored pages. Each path is unique, returns `200` on a fresh
direct request, self-canonicalizes to the absolute URL on
`https://docs.oore.build`, and is eligible for sitemap and static search
inclusion.

<!-- AUTHORED_CANONICALS_BEGIN -->

```text
P001 | /
P002 | /start
P003 | /start/prerequisites
P004 | /start/install
P005 | /start/first-run
P006 | /start/first-build
P007 | /build
P008 | /build/projects/create
P009 | /build/pipelines/oore-yaml
P010 | /build/pipelines/use-the-ui
P011 | /build/run/trigger
P012 | /build/run/cancel
P013 | /build/sources/github
P014 | /build/sources/gitlab
P015 | /build/sources/webhooks/troubleshoot
P016 | /build/sign/android
P017 | /build/sign/android/gradle
P018 | /build/sign/ios/certificates
P019 | /build/sign/ios/manual
P020 | /build/sign/ios/app-store-connect
P021 | /build/distribute/ios-devices
P022 | /build/distribute/download
P023 | /build/distribute/install/android
P024 | /build/distribute/install/ios
P025 | /team
P026 | /team/invite
P027 | /team/roles
P028 | /team/disable-users
P029 | /team/access
P030 | /team/access/oidc
P031 | /team/access/oidc/google
P032 | /team/access/oidc/entra
P033 | /team/access/oidc/okta
P034 | /team/access/oidc/auth0
P035 | /team/access/oidc/keycloak
P036 | /team/access/trusted-proxy
P037 | /operate
P038 | /operate/deploy
P039 | /operate/deploy/split-roles
P040 | /operate/access/hosted-ui
P041 | /operate/access/self-hosted-ui
P042 | /operate/runners/direct
P043 | /operate/instances/add
P044 | /operate/instances/switch
P045 | /operate/storage/artifacts
P046 | /operate/maintain/monitor
P047 | /operate/maintain/upgrade
P048 | /operate/maintain/backups/create
P049 | /operate/maintain/backups/restore
P050 | /operate/releases
P051 | /operate/recover/reset
P052 | /operate/troubleshoot
P053 | /operate/known-limitations
P054 | /operate/support/report-an-issue
P055 | /understand
P056 | /understand/architecture
P057 | /understand/build-lifecycle
P058 | /understand/pipeline-configuration
P059 | /understand/signing
P060 | /understand/artifact-delivery
P061 | /understand/security
P062 | /understand/multiple-instances
P063 | /understand/runner-trust
P064 | /reference
P065 | /reference/errors
P066 | /reference/build-states
P067 | /reference/setup-states
P068 | /reference/roles
P069 | /reference/cli
P070 | /reference/cli/oore-config
P071 | /reference/cli/oore-setup
P072 | /reference/cli/oore-recovery
P073 | /reference/cli/oore-doctor
P074 | /reference/cli/oore-status
P075 | /reference/cli/oore-login
P076 | /reference/cli/oore-pipeline-validate
P077 | /reference/config/oore-yaml
P078 | /reference/config/daemon
P079 | /reference/config/environment
P080 | /reference/config/installer
P081 | /reference/api
```

<!-- AUTHORED_CANONICALS_END -->

The group arithmetic is
`1 + 5 + 18 + 12 + 18 + 9 + 18 = 81`. For checksum reproduction, sort
the 81 UTF-8 path strings bytewise, join them with `\n`, and include one
final `\n`. The SHA-256 of that exact byte sequence is
`bab4afe4cb279a7b039be317951ca475848903f377782299b3db71ffd67b6395`.

## Exact source-to-terminal matrix

Each current authored URL occurs exactly once below. `301` always means one
direct response to the named terminal; it never means “follow another
compatibility URL.” A slashful form of a `301` source has the same terminal.
A slashful form of a canonical `200` path redirects directly to its slashless
form under the finite slash rules below. Both forms of each `404` source remain
real `404`s.

<!-- SOURCE_TERMINALS_BEGIN -->

```text
ID   | Current authored URL                                      | Accepted disposition | Response | Terminal
S001 | /                                                         | Retain/rewrite       | 200      | /
S002 | /getting-started                                          | Retain/rewrite       | 301      | /start
S003 | /getting-started/prerequisites                            | Retain/rewrite       | 301      | /start/prerequisites
S004 | /getting-started/install                                  | Retain/rewrite       | 301      | /start/install
S005 | /getting-started/first-instance                           | Retain/rewrite       | 301      | /start/first-run
S006 | /getting-started/first-build                              | Retain/rewrite       | 301      | /start/first-build
S007 | /getting-started/connect-github                           | Merge                | 301      | /build/sources/github
S008 | /getting-started/first-signed-build                       | Merge                | 301      | /build/sign/android
S009 | /getting-started/invite-your-team                         | Merge                | 301      | /team/invite
S010 | /getting-started/hosted-ui-onboarding                     | Retain/rewrite       | 301      | /operate/access/hosted-ui
S011 | /guides                                                   | Retain/rewrite       | 301      | /build
S012 | /guides/projects/create-project                           | Retain/rewrite       | 301      | /build/projects/create
S013 | /guides/projects/pipeline-config                          | Retain/rewrite       | 301      | /build/pipelines/oore-yaml
S014 | /guides/projects/pipeline-ui-fallback                     | Retain/rewrite       | 301      | /build/pipelines/use-the-ui
S015 | /guides/projects/trigger-builds                           | Retain/rewrite       | 301      | /build/run/trigger
S016 | /guides/projects/cancel-builds                            | Retain/rewrite       | 301      | /build/run/cancel
S017 | /guides/integrations/github-app                           | Retain/rewrite       | 301      | /build/sources/github
S018 | /guides/integrations/gitlab                               | Retain/rewrite       | 301      | /build/sources/gitlab
S019 | /guides/integrations/webhooks                             | Retain/rewrite       | 301      | /build/sources/webhooks/troubleshoot
S020 | /guides/signing/android-keystore                          | Retain/rewrite       | 301      | /build/sign/android
S021 | /guides/signing/android-gradle                            | Retain/rewrite       | 301      | /build/sign/android/gradle
S022 | /guides/signing/ios-certificates                          | Retain/rewrite       | 301      | /build/sign/ios/certificates
S023 | /guides/signing/ios-manual-signing                       | Retain/rewrite       | 301      | /build/sign/ios/manual
S024 | /guides/signing/ios-api-signing                          | Retain/rewrite       | 301      | /build/sign/ios/app-store-connect
S025 | /guides/signing/ios-device-registration                  | Retain/rewrite       | 301      | /build/distribute/ios-devices
S026 | /guides/artifacts/configure-storage                      | Retain/rewrite       | 301      | /operate/storage/artifacts
S027 | /guides/artifacts/download-artifacts                     | Retain/rewrite       | 301      | /build/distribute/download
S028 | /guides/artifacts/install-mobile-builds                  | Retain/rewrite       | 301      | /build/distribute/install/android
S029 | /guides/users/invite-users                               | Retain/rewrite       | 301      | /team/invite
S030 | /guides/users/manage-roles                               | Retain/rewrite       | 301      | /team/roles
S031 | /guides/users/disable-users                              | Retain/rewrite       | 301      | /team/disable-users
S032 | /guides/oidc                                             | Retain/rewrite       | 301      | /team/access/oidc
S033 | /guides/oidc/google                                      | Retain/rewrite       | 301      | /team/access/oidc/google
S034 | /guides/oidc/azure-ad                                    | Retain/rewrite       | 301      | /team/access/oidc/entra
S035 | /guides/oidc/okta                                        | Retain/rewrite       | 301      | /team/access/oidc/okta
S036 | /guides/oidc/auth0                                       | Retain/rewrite       | 301      | /team/access/oidc/auth0
S037 | /guides/oidc/keycloak                                    | Retain/rewrite       | 301      | /team/access/oidc/keycloak
S038 | /guides/runners/external-runner                          | Retain/rewrite       | 301      | /operate/runners/direct
S039 | /guides/runners/embedded-runner                          | Redirect             | 301      | /understand/runner-trust
S040 | /guides/multi-instance/add-instance                      | Retain/rewrite       | 301      | /operate/instances/add
S041 | /guides/multi-instance/switch-instances                  | Retain/rewrite       | 301      | /operate/instances/switch
S042 | /concepts/architecture                                   | Retain/rewrite       | 301      | /understand/architecture
S043 | /concepts/build-execution                                | Retain/rewrite       | 301      | /understand/build-lifecycle
S044 | /concepts/file-first-config                              | Retain/rewrite       | 301      | /understand/pipeline-configuration
S045 | /concepts/signing-overview                               | Retain/rewrite       | 301      | /understand/signing
S046 | /concepts/artifact-access                                | Retain/rewrite       | 301      | /understand/artifact-delivery
S047 | /concepts/security-model                                 | Retain/rewrite       | 301      | /understand/security
S048 | /concepts/multi-instance                                 | Retain/rewrite       | 301      | /understand/multiple-instances
S049 | /concepts/runner-protocol                                | Retain/rewrite       | 301      | /understand/runner-trust
S050 | /reference                                               | Retain/rewrite       | 200      | /reference
S051 | /reference/error-codes                                   | Retain/rewrite       | 301      | /reference/errors
S052 | /reference/build-states                                  | Retain/rewrite       | 200      | /reference/build-states
S053 | /reference/setup-states                                  | Retain/rewrite       | 200      | /reference/setup-states
S054 | /reference/rbac                                          | Retain/rewrite       | 301      | /reference/roles
S055 | /reference/cli                                           | Retain/rewrite       | 200      | /reference/cli
S056 | /reference/cli/oore-config                               | Retain/rewrite       | 200      | /reference/cli/oore-config
S057 | /reference/cli/oore-setup                                | Retain/rewrite       | 200      | /reference/cli/oore-setup
S058 | /reference/cli/oore-recovery                             | Retain/rewrite       | 200      | /reference/cli/oore-recovery
S059 | /reference/cli/oore-doctor                               | Retain/rewrite       | 200      | /reference/cli/oore-doctor
S060 | /reference/cli/oore-status                               | Retain/rewrite       | 200      | /reference/cli/oore-status
S061 | /reference/cli/oore-login                                | Retain/rewrite       | 200      | /reference/cli/oore-login
S062 | /reference/config/oore-yaml                              | Retain/rewrite       | 200      | /reference/config/oore-yaml
S063 | /reference/config/daemon-config                          | Retain/rewrite       | 301      | /reference/config/daemon
S064 | /reference/config/environment-variables                  | Retain/rewrite       | 301      | /reference/config/environment
S065 | /reference/config/installer                              | Retain/rewrite       | 200      | /reference/config/installer
S066 | /reference/api                                           | Merge                | 200      | /reference/api
S067 | /reference/api/auth                                      | Redirect             | 301      | /reference/api/categories/authentication
S068 | /reference/api/builds                                    | Redirect             | 301      | /reference/api/categories/builds
S069 | /reference/api/users                                     | Redirect             | 301      | /reference/api/categories/users
S070 | /reference/api/projects                                  | Redirect             | 301      | /reference/api/categories/projects
S071 | /reference/api/artifacts                                 | Redirect             | 301      | /reference/api/categories/artifacts
S072 | /reference/api/integrations                              | Redirect             | 301      | /reference/api/categories/sources
S073 | /reference/api/pipelines                                 | Redirect             | 301      | /reference/api/categories/pipelines
S074 | /reference/api/setup                                     | Redirect             | 301      | /reference/api/categories/setup
S075 | /reference/api/logs                                      | Redirect             | 301      | /reference/api/categories/logs
S076 | /reference/api/settings                                  | Redirect             | 301      | /reference/api/categories/settings
S077 | /reference/api/runners                                   | Redirect             | 301      | /reference/api/categories/runners
S078 | /openapi                                                 | Retain/rewrite       | 301      | /reference/api
S079 | /operations                                              | Retain/rewrite       | 301      | /operate
S080 | /operations/deployment                                   | Retain/rewrite       | 301      | /operate/deploy
S081 | /operations/split-roles                                  | Retain/rewrite       | 301      | /operate/deploy/split-roles
S082 | /operations/mac-studio-netbird-warpgate                  | Remove as internal   | 404      | -
S083 | /operations/monitoring                                   | Retain/rewrite       | 301      | /operate/maintain/monitor
S084 | /operations/upgrade                                      | Retain/rewrite       | 301      | /operate/maintain/upgrade
S085 | /operations/backup-restore                               | Retain/rewrite       | 301      | /operate/maintain/backups/create
S086 | /operations/clean-reinstall                              | Merge                | 301      | /operate/recover/reset
S087 | /operations/troubleshooting                              | Retain/rewrite       | 301      | /operate/troubleshoot
S088 | /operations/release-channels                             | Retain/rewrite       | 301      | /operate/releases
S089 | /operations/known-limitations                            | Retain/rewrite       | 301      | /operate/known-limitations
S090 | /operations/report-an-issue                              | Retain/rewrite       | 301      | /operate/support/report-an-issue
S091 | /operations/alpha-feedback                               | Merge                | 301      | /operate/support/report-an-issue
S092 | /operations/release-automation-mac-mini                  | Remove as internal   | 404      | -
```

<!-- SOURCE_TERMINALS_END -->

The two split-source primary choices are deliberate:

- S028 redirects to the Android install task; its distinct iOS fragment creates
  P024.
- S085 redirects to backup creation; its distinct restore fragment creates
  P049.

S066 is also deliberate: its content merges into the S078-owned API landing,
but its URL is already the final `/reference/api` canonical. It returns `200`
and must never self-redirect.

Both `/guides/runners/embedded-runner` and `/concepts/runner-protocol`
redirect directly to `/understand/runner-trust`.

Using the same bytewise sort, newline join, and final-newline serialization,
the sorted set of 92 current source URLs has SHA-256
`108ec83e07430ba3d0d8564477d335c57bfcc4cea5938e0adcdc7cca95a914c1`.

## Generated API category contract

All 12 legacy API pointer sources have a terminal below. The API index content
merges into the sole authored landing at its already-canonical URL. The other
11 pointers redirect to stable generated pages in a new, non-colliding
namespace. Reusing `/reference/api/auth`, `/reference/api/builds`, or another
pointer spelling as its own target would create a self-redirect and is
forbidden.

| Legacy API pointer source     | Terminal                                    | OpenAPI tags                                                               | Baseline operations | Required after parity |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- | ------------------: | --------------------: |
| `/reference/api`              | `/reference/api` (`200`)                    | Sole authored API landing; pointer content merges into it                  |                   — |                     — |
| `/reference/api/auth`         | `/reference/api/categories/authentication`  | `Auth`, `API Tokens`                                                       |                   8 |                     8 |
| `/reference/api/builds`       | `/reference/api/categories/builds`          | `Builds`                                                                   |                   6 |                     6 |
| `/reference/api/users`        | `/reference/api/categories/users`           | `Users`                                                                    |                   6 |                     6 |
| `/reference/api/projects`     | `/reference/api/categories/projects`        | `Projects`, `Project Members`                                              |                  10 |                    10 |
| `/reference/api/artifacts`    | `/reference/api/categories/artifacts`       | `Artifacts`, `Scoped Download Tokens`                                      |                  13 |                    19 |
| `/reference/api/integrations` | `/reference/api/categories/sources`         | `Integrations`, `Webhooks`                                                 |                  18 |                    22 |
| `/reference/api/pipelines`    | `/reference/api/categories/pipelines`       | `Pipelines`, `Pipeline Signing`                                            |                  14 |                    16 |
| `/reference/api/setup`        | `/reference/api/categories/setup`           | `Health`, `Setup`                                                          |                  13 |                    14 |
| `/reference/api/logs`         | `/reference/api/categories/logs`            | `Build Logs`, `Audit Logs`                                                 |                   5 |                     5 |
| `/reference/api/settings`     | `/reference/api/categories/settings`        | `Instance Settings`, `Retention Policy`, `Notification Channels`, `System` |                  27 |                    29 |
| `/reference/api/runners`      | `/reference/api/categories/runners`         | `Runners`                                                                  |                  10 |                    10 |
| **Total**                     | **1 authored landing + 11 generated pages** | **21 used tags after recomputation**                                       |             **130** |               **145** |

The baseline column is audit evidence for the checked 130-operation subset.
The parity column is the required result of applying the 15 normative tag
assignments in the parity appendix below. Implementation must compute both the
used-tag set and category membership from the corrected OpenAPI document and
compare the result to this table; it must not copy these counts into a
hand-maintained operation list.

The category mapping owns tag names, not operation IDs. At build time,
membership is derived from each operation's OpenAPI tags. The build must fail
if a used tag maps to zero or more than one category, an operation maps to zero
or more than one category, a category is empty, or an operation lacks a stable
`operationId`.

This deliberately includes `System` and `Scoped Download Tokens`, which are
used by operations but absent from the current root tag declaration. An
undeclared used tag is not permission to omit its operations.

The implementation uses only Fumadocs' official, version-matched seams:

1. Keep one `fumadocs-openapi@11.2.2` virtual source in default
   `per: 'operation'` mode at `openapi/operations`. Do not use
   `groupBy: 'tag'` on this source because that changes operation paths.
2. Add a second virtual source at `reference/api/categories` using the
   officially supported `per: 'custom'` page builder. Its
   `builder.extract().operations` input is filtered by the tag mapping above
   and emitted as 11 aggregate generated pages.
3. Compose both virtual sources with the Astro authored source in the one
   Fumadocs loader and page tree. Do not write generated-operation MDX files,
   hand-maintain operation lists, create an API proxy, or add a second
   navigation tree.

Fumadocs also supports `per: 'tag'`, but that mode alone is insufficient here:
it creates one page for each root-declared tag, would omit the two undeclared
used tags, and cannot express the accepted 21-tag-to-11-category rollup.

## OpenAPI parity appendix

The production Axum router has 15 method/path pairs that the checked exporter
omits. The method/path inventory comes from the accepted truth table and is
confirmed by the production route registrations in `crates/oored/src/lib.rs`
plus the merged metrics route in `crates/oored/src/observability.rs`. The
handler column names the runtime behavior that the exporter stub must
document.

The following IDs, URLs, tags, and category assignments are normative for
closing that drift. They are additions to the immutable 130-operation subset,
not redirects or replacements.

| Method and runtime path                                     | Required new `operationId`        | New canonical documentation URL                       | Tag → category                       | Runtime handler             |
| ----------------------------------------------------------- | --------------------------------- | ----------------------------------------------------- | ------------------------------------ | --------------------------- |
| `GET /readyz`                                               | `readyz`                          | `/openapi/operations/readyz`                          | `Health` → Setup                     | `readyz`                    |
| `GET /metrics`                                              | `metrics`                         | `/openapi/operations/metrics`                         | `System` → Settings                  | `metrics_handler`           |
| `POST /v1/telemetry/web-performance`                        | `record_web_performance`          | `/openapi/operations/record_web_performance`          | `System` → Settings                  | `record_web_performance`    |
| `GET /v1/integrations/github/create`                        | `github_create_page`              | `/openapi/operations/github_create_page`              | `Integrations` → Sources             | `github_create_page`        |
| `GET /v1/integrations/github/callback`                      | `github_callback`                 | `/openapi/operations/github_callback`                 | `Integrations` → Sources             | `github_callback`           |
| `GET /v1/integrations/github/installed`                     | `github_installed`                | `/openapi/operations/github_installed`                | `Integrations` → Sources             | `github_installed`          |
| `GET /v1/integrations/gitlab/callback`                      | `gitlab_callback`                 | `/openapi/operations/gitlab_callback`                 | `Integrations` → Sources             | `gitlab_callback`           |
| `GET /v1/runners/{runner_id}/jobs/{job_id}/android-signing` | `get_job_android_signing`         | `/openapi/operations/get_job_android_signing`         | `Pipeline Signing` → Pipelines       | `get_job_android_signing`   |
| `GET /v1/runners/{runner_id}/jobs/{job_id}/ios-signing`     | `get_job_ios_signing`             | `/openapi/operations/get_job_ios_signing`             | `Pipeline Signing` → Pipelines       | `get_job_ios_signing`       |
| `PUT /v1/artifacts/local-upload/{token}`                    | `upload_local_artifact`           | `/openapi/operations/upload_local_artifact`           | `Artifacts` → Artifacts              | `upload_local_artifact`     |
| `GET /v1/artifacts/download/{token}`                        | `download_local_artifact`         | `/openapi/operations/download_local_artifact`         | `Artifacts` → Artifacts              | `download_local_artifact`   |
| `GET /v1/artifacts/local-download/{token}`                  | `download_local_artifact_legacy`  | `/openapi/operations/download_local_artifact_legacy`  | `Artifacts` → Artifacts              | `download_local_artifact`   |
| `GET /v1/artifacts/dl/{token}`                              | `download_via_scoped_token_v1`    | `/openapi/operations/download_via_scoped_token_v1`    | `Scoped Download Tokens` → Artifacts | `download_via_scoped_token` |
| `GET /v1/artifacts/install/ios/{token}/manifest.plist`      | `get_ios_install_manifest_v1`     | `/openapi/operations/get_ios_install_manifest_v1`     | `Artifacts` → Artifacts              | `ios_install_manifest`      |
| `GET /install/download/{token}`                             | `download_local_artifact_install` | `/openapi/operations/download_local_artifact_install` | `Artifacts` → Artifacts              | `download_local_artifact`   |

For parity-inventory checksum reproduction, serialize each method/path pair as
`METHOD`, one ASCII space, and `PATH`; sort the 15 UTF-8 strings bytewise; join
with `\n`; and include one final `\n`. The SHA-256 is
`13d993f28411251017b5237c8175a5afbb5d3f6f6768c70230b7d1960ee470c4`.

The naming rule follows the current exporter: use a concise snake-case
verb–resource ID that normally matches the runtime handler. Where a shared
handler would collide with another operation, use the stable route role:
`_legacy` for the source-labeled legacy route, `_v1` for the `/v1/` alternate
to an existing immutable `/install/` operation, and `_install` for the
`/install/` delivery route. `metrics` follows the public resource spelling
rather than leaking the private `_handler` suffix. The exact table, not a
fresh naming guess, is authoritative for issue #201.

Every new stub must describe the current handler behavior, authentication,
media type, and tested response statuses from source. It must supply a
source-backed summary and description when the source supports them; the
metadata scan below still recomputes gaps from the corrected document rather
than assuming that all 15 additions are complete.

After export, normalize the runtime and OpenAPI method/path sets and require an
exact match: 117 paths, 145 operations, no runtime-only pair, and no
exporter-only pair at this accepted snapshot. Require 145 non-empty, unique,
single-segment operation IDs. The final generated URL set is the immutable 130
URLs below union the 15 URLs in this appendix; the set difference must be
exactly these 15 additions.

## Preserved generated operation subset

The checked baseline OpenAPI document contains 102 paths and 130 operations.
Every baseline operation has one non-empty unique `operationId`, so the exact
mandatory preserved URL subset is the following.

<!-- OPENAPI_OPERATION_URLS_BEGIN -->

```text
/openapi/operations/abort_artifact
/openapi/operations/add_project_member
/openapi/operations/append_build_logs
/openapi/operations/browse_local_git_directories
/openapi/operations/cancel_build
/openapi/operations/claim_job
/openapi/operations/complete_artifact
/openapi/operations/complete_setup
/openapi/operations/configure_external_access_oidc
/openapi/operations/configure_oidc
/openapi/operations/create_api_token
/openapi/operations/create_artifact
/openapi/operations/create_artifact_install_link
/openapi/operations/create_build
/openapi/operations/create_local_git_integration
/openapi/operations/create_notification_channel
/openapi/operations/create_pipeline
/openapi/operations/create_project
/openapi/operations/create_scoped_download_token
/openapi/operations/create_stream_token
/openapi/operations/delete_integration
/openapi/operations/delete_local_git_integration
/openapi/operations/delete_notification_channel
/openapi/operations/delete_pipeline
/openapi/operations/delete_project
/openapi/operations/delete_project_retention
/openapi/operations/delete_user
/openapi/operations/discover_repository_workflows
/openapi/operations/download_via_scoped_token
/openapi/operations/frontend_pair
/openapi/operations/generate_download_link
/openapi/operations/get_artifact_storage_settings
/openapi/operations/get_build
/openapi/operations/get_build_logs
/openapi/operations/get_external_access_network_settings
/openapi/operations/get_external_access_oidc
/openapi/operations/get_external_access_preflight
/openapi/operations/get_external_access_trusted_proxy_settings
/openapi/operations/get_instance_preferences
/openapi/operations/get_integration
/openapi/operations/get_ios_install_manifest
/openapi/operations/get_job_status
/openapi/operations/get_me
/openapi/operations/get_notification_channel
/openapi/operations/get_pipeline
/openapi/operations/get_pipeline_android_signing
/openapi/operations/get_pipeline_ios_signing
/openapi/operations/get_project
/openapi/operations/get_project_retention
/openapi/operations/get_retention_last_cleanup
/openapi/operations/get_retention_policy
/openapi/operations/get_runner
/openapi/operations/get_runtime_update_status
/openapi/operations/get_setup_status
/openapi/operations/get_setup_summary
/openapi/operations/github_complete
/openapi/operations/github_start
/openapi/operations/github_webhook
/openapi/operations/gitlab_authorize
/openapi/operations/gitlab_checkout_discovery
/openapi/operations/gitlab_checkout_upload_pack
/openapi/operations/gitlab_start
/openapi/operations/gitlab_webhook
/openapi/operations/healthz
/openapi/operations/invite_user
/openapi/operations/list_api_tokens
/openapi/operations/list_artifacts
/openapi/operations/list_audit_logs
/openapi/operations/list_build_artifacts
/openapi/operations/list_builds
/openapi/operations/list_installations
/openapi/operations/list_integrations
/openapi/operations/list_local_git_integrations
/openapi/operations/list_notification_channels
/openapi/operations/list_notification_deliveries
/openapi/operations/list_pipeline_ios_devices
/openapi/operations/list_pipelines
/openapi/operations/list_project_artifacts
/openapi/operations/list_project_member_candidates
/openapi/operations/list_project_members
/openapi/operations/list_projects
/openapi/operations/list_repositories
/openapi/operations/list_runners
/openapi/operations/list_scoped_download_tokens
/openapi/operations/list_users
/openapi/operations/local_login
/openapi/operations/logout
/openapi/operations/oidc_callback
/openapi/operations/oidc_start
/openapi/operations/preview_build_changelog
/openapi/operations/re_enable_user
/openapi/operations/register_pipeline_ios_device
/openapi/operations/register_runner
/openapi/operations/remove_project_member
/openapi/operations/repository_avatar
/openapi/operations/rerun_build
/openapi/operations/revoke_api_token
/openapi/operations/revoke_scoped_download_token
/openapi/operations/rotate_gitlab_repository_webhook_secret
/openapi/operations/runner_heartbeat
/openapi/operations/setup_local_owner_create
/openapi/operations/setup_oidc_start
/openapi/operations/setup_oidc_verify
/openapi/operations/setup_owner_claim_trusted_proxy
/openapi/operations/setup_preferences
/openapi/operations/setup_trusted_proxy_configure
/openapi/operations/start_runtime_update
/openapi/operations/stream_build_logs
/openapi/operations/sync_installations
/openapi/operations/sync_pipeline_ios_signing
/openapi/operations/test_notification_channel
/openapi/operations/test_oidc_connection
/openapi/operations/trusted_proxy_login
/openapi/operations/update_artifact_storage_settings
/openapi/operations/update_external_access_network_settings
/openapi/operations/update_external_access_trusted_proxy_settings
/openapi/operations/update_instance_preferences
/openapi/operations/update_job_status
/openapi/operations/update_notification_channel
/openapi/operations/update_pipeline
/openapi/operations/update_pipeline_android_signing
/openapi/operations/update_pipeline_ios_signing
/openapi/operations/update_project
/openapi/operations/update_project_member
/openapi/operations/update_project_retention
/openapi/operations/update_retention_policy
/openapi/operations/update_runner
/openapi/operations/update_user_role
/openapi/operations/validate_pipeline
/openapi/operations/verify_bootstrap_token
```

<!-- OPENAPI_OPERATION_URLS_END -->

Using the same bytewise sort, newline join, and final-newline serialization,
the baseline 130-URL subset SHA-256 is
`6737bf96a63d0692eb3506d3faa6d32468b978b017b03bdd67ac2133341a4801`.
The checked baseline OpenAPI file SHA-256 is
`3a094854fe88d2ee4c29952463865255d380ca90ae886cee11b2448b2586d1c7`.
Both hashes are audit anchors for preservation; neither is the expected hash
of the parity-corrected 145-operation document.

Every final operation URL—the 130 listed URLs and the 15 parity additions:

- returns its generated page with `200` on a fresh direct `GET` or `HEAD`
- has one absolute self-canonical URL using the exact slashless path
- shows the exact `operationId`, HTTP method, and API path
- appears below Reference in the one Fumadocs page tree
- appears once in the sitemap and once in static search

There is no redirect from a final slashless operation URL. Its exact slashful
variant redirects directly to that URL. An unknown operation ID,
including a slashful unknown ID, returns the real `404`; no operation wildcard
may turn unknown IDs into redirects or `200`s.

## Generated operation metadata fallback

The checked pre-parity 130-operation document has incomplete metadata:

- 49 of 130 operations have no description.
- 2 of 130 operations have no summary:
  `abort_artifact` and `complete_artifact`.
- Those same two operations lack both summary and description.

The following 49-ID list is baseline audit evidence for the preserved subset,
not a frozen final count:

```text
abort_artifact
add_project_member
browse_local_git_directories
complete_artifact
create_local_git_integration
create_pipeline
create_project
delete_integration
delete_local_git_integration
delete_pipeline
delete_project
delete_project_retention
get_artifact_storage_settings
get_build
get_external_access_trusted_proxy_settings
get_instance_preferences
get_integration
get_pipeline
get_pipeline_android_signing
get_pipeline_ios_signing
get_project
get_project_retention
get_retention_last_cleanup
get_retention_policy
gitlab_authorize
gitlab_checkout_upload_pack
list_artifacts
list_build_artifacts
list_installations
list_local_git_integrations
list_pipeline_ios_devices
list_pipelines
list_project_artifacts
list_project_member_candidates
list_project_members
list_projects
list_repositories
list_runners
preview_build_changelog
remove_project_member
repository_avatar
rotate_gitlab_repository_webhook_secret
update_external_access_trusted_proxy_settings
update_pipeline
update_project
update_project_member
update_project_retention
update_retention_policy
update_runner
```

The 15 parity additions have no exporter metadata in the baseline because they
are absent from it. Recompute the missing-summary and missing-description
counts from the corrected 145-operation document. Do not assume that the
baseline `49/130` and `2/130` ratios remain the final totals.

All final generated page and social metadata use only source-backed fallbacks:

1. Title and H1: operation `summary`; otherwise Fumadocs' deterministic
   operation-ID display name. The raw `operationId` remains visible.
2. Description, Open Graph description, and Twitter description: operation
   `description`; otherwise `summary`; otherwise the exact `METHOD /path`.
3. Method and path are always visible.
4. Do not borrow prose from a neighboring operation, infer behavior from an
   identifier, or invent a description.

Category titles use the fixed category names above. Category descriptions use
declared tag descriptions where they exist. For undeclared or undescribed tags,
show the exact tag name and operation facts or omit optional prose; do not
invent category behavior. Static search indexes category titles and
source-backed tag descriptions, not a second copy of every aggregated
operation body.

## Required internal-link rewrites

The four fragment-bearing pointer links must become direct operation links:

| Current link                                      | Terminal link                                          |
| ------------------------------------------------- | ------------------------------------------------------ |
| `/reference/api/settings#update-artifact-storage` | `/openapi/operations/update_artifact_storage_settings` |
| `/reference/api/pipelines#update-ios-signing`     | `/openapi/operations/update_pipeline_ios_signing`      |
| `/reference/api/pipelines#update-android-signing` | `/openapi/operations/update_pipeline_android_signing`  |
| `/reference/api/pipelines#list-ios-devices`       | `/openapi/operations/list_pipeline_ios_devices`        |

All four destination IDs exist in the immutable 130-operation subset. A
content rewrite must not preserve these fragments on a redirecting pointer
page.

## Historic aliases

The five already-published aliases remain direct terminal redirects:

| Historical source                          | Direct terminal                    |
| ------------------------------------------ | ---------------------------------- |
| `/getting-started/public-alpha`            | `/operate/releases`                |
| `/getting-started/known-limitations`       | `/operate/known-limitations`       |
| `/getting-started/issue-report-checklist`  | `/operate/support/report-an-issue` |
| `/getting-started/clean-reinstall`         | `/operate/recover/reset`           |
| `/getting-started/alpha-feedback-playbook` | `/operate/support/report-an-issue` |

Their slashful forms have the same direct terminals. None may retain its
current intermediate target.

## Finite slash and alias rules

The redirect manifest is an explicit finite expansion of the registries in
this artifact. It does not authorize a global slash normalizer or a wildcard
compatibility rule.

The final manifest contains `253 + N` direct `301` rules. Acceptance requires
`N = 145`, hence 398 rules:

| Exact redirect-source class                              |   Rules |
| -------------------------------------------------------- | ------: |
| Slashless current source URLs marked `301` in the matrix |      76 |
| Slashful forms of those 76 moved sources                 |      76 |
| Five slashless historic aliases                          |       5 |
| Five slashful historic aliases                           |       5 |
| Slashful forms of 237 canonical pages except `/`         |     236 |
| **Total**                                                | **398** |

The checked 130-operation baseline would expand to 383 rules. That is audit
evidence only. The 15 parity additions contribute 15 new canonical `200`
pages and their 15 direct slashful aliases; they add no authored-source,
historic-alias, or removal rules.

This expansion includes, without an intermediate platform normalization:

```text
/getting-started/ -> /start
/guides/          -> /build
/operations/      -> /operate
/guides/oidc/     -> /team/access/oidc
/openapi/         -> /reference/api
/reference/api/   -> /reference/api
```

It also includes every other moved route in the source matrix, every category
pointer, every historical alias, and every known canonical authored,
category, and operation slash variant. `/openapi` and `/openapi/` therefore
both go directly to `/reference/api`.

The two removed routes and their slashful forms are not redirect sources:

```text
/operations/mac-studio-netbird-warpgate
/operations/mac-studio-netbird-warpgate/
/operations/release-automation-mac-mini
/operations/release-automation-mac-mini/
```

All four requests return the real `404`.

## Redirect graph invariants and Cloudflare ordering

The emitted redirect graph must satisfy all of these invariants:

- Every source path occurs once.
- Source and target sets are disjoint.
- Every target is one of the 237 canonical pages and returns `200`.
- There is no self-redirect, chain, cycle, conflicting duplicate, or
  representative-operation redirect.
- A slashful legacy path goes directly to its final slashless target; it never
  first normalizes to a slashless legacy source.
- Unknown authored, category, and operation paths never match a redirect.

Cloudflare Pages applies the topmost duplicate source and gives redirects
precedence over static assets. Generate `_redirects` in this order:

1. exact slashful moved-source and historical-alias rules
2. exact slashless moved-source and historical-alias rules
3. exact slashful canonical-page rules

The generator must reject duplicate sources before emitting the file. These
398 static rules remain below Cloudflare Pages' 2,000-static-rule limit.
Do not add a dynamic redirect, a wildcard canonicalization, `/* / 200`, an SPA
rewrite, or a home-shell fallback.

## Direct static requests and real not-found behavior

The deployable `apps/docs/dist` artifact must support fresh requests without a
prior client navigation:

| Request class                           | Required behavior                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Any of the 237 canonical page URLs      | Static page, HTTP `200`, correct body and self-canonical                              |
| Any of the 398 compatibility URLs       | One HTTP `301` with the exact terminal `Location`                                     |
| `/api/search`                           | Static search response, HTTP `200`                                                    |
| `/openapi.json`                         | Parity-corrected generated API document with 117 paths and 145 operations, HTTP `200` |
| `/robots.txt`                           | Plain static file, HTTP `200`                                                         |
| `/sitemap.xml`                          | Canonical sitemap, HTTP `200`                                                         |
| Fonts, images, icons, and hashed assets | Real static files, HTTP `200`                                                         |
| Missing asset or unknown page           | Built `404.html` body, HTTP `404`                                                     |

The build includes a top-level `404.html`. Cloudflare must serve that page with
HTTP `404` for an unknown path instead of assuming an SPA. The 404 document:

- has `robots` metadata of at least `noindex`
- has no home-page or guessed canonical URL
- is absent from sitemap and static search
- does not render the docs home body as the not-found response

The same rules apply to both removed internal Operations URLs. They have no
public canonical replacement and do not redirect to `/operate`, a private
location, search, or the home page.

`_redirects` is consumed by the host rather than exposed as an indexable page.
`404.html`, `/api/search`, `/openapi.json`, `/robots.txt`, `/sitemap.xml`, and
ordinary assets are not documentation-page canonicals.

## Canonical metadata, sitemap, robots, and search

Every one of the 237 canonical HTML pages has exactly one absolute canonical:

```text
https://docs.oore.build<canonical-path>
```

The root is exactly `https://docs.oore.build/`. All other canonical URLs are
slashless. Open Graph URL and equivalent share metadata use the same URL.
Redirect responses do not serve indexable duplicate HTML.

The final `/sitemap.xml` contains exactly the 237 canonical page URLs:

- 81 authored pages
- 11 generated category pages
- 145 generated operation pages

It excludes every redirect source, slashful alias, historical alias, removed
or internal URL, unknown URL, 404 page, static endpoint, and asset.
`robots.txt` allows canonical public content and advertises exactly
`https://docs.oore.build/sitemap.xml`.

The checked pre-parity arithmetic would have produced 222 URLs; that is
baseline audit evidence, not the final sitemap contract.

Static search uses the same 237 canonical URLs as result destinations. It
excludes:

- all 398 redirect sources
- all 12 baseline authored API pointer documents as standalone search records
- both removed internal pages
- unknown and 404 pages
- `/api/search`, `/openapi.json`, `/robots.txt`, `/sitemap.xml`, `_redirects`,
  and ordinary assets

Category search records contain only their own title and source-backed tag
metadata. Operation records contain their own generated operation data. This
avoids category results duplicating the complete text of their operation
children.

## Implementation acceptance

Acceptance is behavior-focused. It must not depend on arbitrary component,
import, generated-file, or exact output-directory topology beyond the public
static artifact contract.

### Corpus and destination checks

- Parse 92 unique source rows and no unaccounted baseline Markdown or MDX
  source.
- Prove `72 + 6 + 12 + 2 = 92`.
- Prove `14 + 76 + 2 = 92`.
- Parse 81 unique authored IDs and 81 unique canonical paths.
- Prove the authored group arithmetic
  `1 + 5 + 18 + 12 + 18 + 9 + 18 = 81`.
- Prove both removed internal routes are absent from the page source and static
  route inventory.

### Generated API checks

- Reproduce the checked baseline at 102 paths, 130 operations, 130 non-empty
  unique operation IDs, the exact preserved URL subset, and both baseline
  hashes above.
- Normalize the corrected exporter and runtime method/path sets and prove they
  are identical at 117 paths and 145 operations, with no missing or extra
  pair.
- Parse 145 non-empty, unique, URL-safe single-segment operation IDs. Prove the
  final URL set is the preserved 130-URL subset plus exactly the 15 parity
  appendix URLs.
- Prove the 15 appendix method/path pairs, operation IDs, tags, categories, and
  canonical URLs occur one-to-one exactly as specified.
- Prove every final operation URL returns `200`, renders its exact method and
  API path, and has its own canonical.
- Derive the used-tag set and category counts from the corrected document.
  Prove every one of the 145 operations maps to exactly one of the 11
  categories, the derived total is 145, and the counts equal the parity
  column in the category table.
- Prove every category route returns `200` and its membership is derived from
  tags rather than an operation-ID list.
- Reproduce the historical `49/130` missing-description and `2/130`
  missing-summary risk, then recompute both final counts from the corrected
  document and verify non-empty source-backed fallback output on every final
  operation page.
- Prove the four replacement operation links exist and no old pointer fragment
  remains.

### Redirect and slash checks

- Derive `253 + N` from the registries and materialize exactly 398 unique
  explicit redirect sources for required `N = 145`.
- Prove every redirect has status `301`, one final `Location`, and a `200`
  target.
- Prove source and target sets are disjoint and the graph has no self edge,
  chain, cycle, duplicate source, or conflicting rule.
- Check both slash variants of all 76 moved current sources and five historical
  aliases.
- Check the slashful variant of every non-root canonical authored, category,
  and operation page.
- Check `/openapi` and `/openapi/` go directly to `/reference/api`.
- Check unknown operation and category paths do not match a wildcard.

### Static, indexing, and 404 checks

- Make fresh `GET` and `HEAD` requests to representative nested authored,
  category, and operation pages and then mechanically check the complete route
  inventory.
- Compare the sitemap URL set with the 237 canonical-page set exactly.
- Compare static-search result URLs with the same canonical set and confirm
  every excluded class is absent.
- Check canonical, Open Graph, and robots metadata on representative authored,
  category, operation, root, and 404 pages.
- Check unknown paths, unknown operation/category IDs, missing assets, and both
  removed internal paths return the built 404 body with HTTP `404`, `noindex`,
  and no home canonical.
- Check `/api/search`, `/openapi.json`, `/robots.txt`, `/sitemap.xml`, and
  representative public assets are direct static `200` responses.
- Prove there is no wildcard `200` rule, Pages Function, runtime docs server,
  or SPA/home-shell fallback.

### Repository hygiene

- Check public terminology uses **Local Only**, **External Access**,
  **Sources**, and **Direct macOS runner**.
- Check the artifact contains no credentials, private links, private
  destination, internal operational detail, duplicate URL, trailing
  whitespace, or accidental product-code change.
- Run focused matrix/OpenAPI/link checks, `git diff --check`, and the
  repository-mandated `make validate`.

## Resolution

Use `https://docs.oore.build` with slashless canonical paths. Keep all 130
published operation URLs exactly where they are and add the 15 authoritative
parity URLs for a final 145-operation surface. Generate 11 stable tag-derived
category landings beneath `/reference/api/categories`, and make
`/reference/api` the sole authored API landing. Emit the finite 398-rule direct
redirect set, serve all 237 canonical pages as real static deep links, and let
unknown and removed paths reach a real non-indexable `404.html`.
