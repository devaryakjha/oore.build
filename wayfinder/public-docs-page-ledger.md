# Public documentation disposition ledger

This ledger is the complete page-level input to the Oore public documentation
rebuild. It applies the standing decisions in
[Wayfinder: rebuild Oore's public documentation around user journeys](https://github.com/oore-ci/oore.build/issues/195)
without pre-empting the tickets that still own factual reconciliation, the
final tree, the public voice, or canonical URLs.

## Reconciliation

- Authored Markdown and MDX pages: **92**
- Authored pages currently represented in the declared Fumadocs tree: **80**
- Legacy authored API pointer pages omitted from that tree: **12**
- Generated OpenAPI surface: **102 paths, 130 operations, 21 operation tags
  (19 declared at the document root)**
- Existing explicit redirects: **5**

The proposed paths below are provisional inputs to
[Decide the public URL and redirect contract](https://github.com/oore-ci/oore.build/issues/204).
They express the agreed information architecture; they do not authorize a
breaking URL change.

## Dependency key

- **Truth** — [Reconcile public documentation with Oore's source of truth](https://github.com/oore-ci/oore.build/issues/198)
- **Deploy** — [Decide Oore's supported public deployment contract](https://github.com/oore-ci/oore.build/issues/197)
- **Tree** — [Prototype the canonical Fumadocs documentation tree](https://github.com/oore-ci/oore.build/issues/205)
- **Voice** — [Prototype Oore's public documentation voice](https://github.com/oore-ci/oore.build/issues/206)
- **URL** — [Decide the public URL and redirect contract](https://github.com/oore-ci/oore.build/issues/204)
- **Astro** — [Verify the official Fumadocs-on-Astro 7 architecture](https://github.com/oore-ci/oore.build/issues/196), resolved

“Internal” answers whether the current page contains Oore-maintainer-only
material, even when the public user job itself should survive.

## Home — 1 page

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/index.mdx` · `/` | Choose the right path · all readers | Product UI, installer, public product promise | Rewrite | Home · `/` | Truth, Tree, Voice | No | Route readers into the local-first start, build/distribute, team/access, operate, understand, and reference journeys. |

## Getting started — 9 pages

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/getting-started/index.md` · `/getting-started` | Understand Oore and start · owner | Product UI, installer, platform contract | Rewrite | Start with Oore · `/start` | Truth, Tree, Voice, URL | No | Replace the obsolete remote-first sequence with the agreed one-Mac path to a debug APK. |
| `apps/docs/docs/getting-started/prerequisites.md` · `/getting-started/prerequisites` | Check readiness · owner | Installer acceptance, runner/toolchain checks | Keep and rewrite | Start with Oore · `/start/prerequisites` | Truth, Voice, URL | No | Keep only requirements needed before the default install; defer signing and remote-access prerequisites. |
| `apps/docs/docs/getting-started/install.md` · `/getting-started/install` | Install Oore locally · owner | Installer script, release artifacts, service definitions | Split and rewrite | Start with Oore · `/start/install` | Truth, Deploy, Voice, URL | Mixed | Preserve the one-command path here; move automation, roles, repair, upgrades, variables, and topology detail to focused pages. |
| `apps/docs/docs/getting-started/first-instance.md` · `/getting-started/first-instance` | Open and initialize a local instance · owner | Login UI, setup status contract, daemon setup behavior | Rewrite | Start with Oore · `/start/first-run` | Truth, Deploy, Voice, URL | Mixed | Current bootstrap-token wizard is not the default Local Only experience; teach automatic local owner initialization and remove the internal infrastructure-recipe link. |
| `apps/docs/docs/getting-started/first-build.md` · `/getting-started/first-build` | Produce a first debug APK · owner/developer | Project UI, pipeline templates, build/artifact contract | Rewrite | Start with Oore · `/start/first-build` | Truth, Voice, URL | Mixed | Use a local repository and the Quick Debug APK template; move hand-authored pipeline detail to build guides/reference. |
| `apps/docs/docs/getting-started/connect-github.md` · `/getting-started/connect-github` | Add GitHub automation · owner/admin | GitHub integration UI and daemon contract | Merge and redirect | Build and distribute · `/build/sources/github` | Truth, Tree, Voice, URL | No | Duplicates the fuller GitHub App guide and currently conflicts on callback behavior. |
| `apps/docs/docs/getting-started/first-signed-build.md` · `/getting-started/first-signed-build` | Sign an Android build · owner/developer | Signing UI, build grants, runner signing contract | Merge and redirect | Build and distribute · `/build/sign/android` | Truth, Tree, Voice, URL | No | The page promises Android or iOS but only teaches Android; signing is a post-first-success journey. |
| `apps/docs/docs/getting-started/invite-your-team.md` · `/getting-started/invite-your-team` | Invite collaborators · owner/admin | User administration UI, RBAC contract | Merge and redirect | Team and access · `/team/invite` | Truth, Tree, Voice, URL | No | Duplicates the user invitation guide; onboarding should link to one canonical task after first success. |
| `apps/docs/docs/getting-started/hosted-ui-onboarding.md` · `/getting-started/hosted-ui-onboarding` | Connect a reachable instance to the hosted UI · owner/operator | Hosted client, instance store, remote-access contract | Move and rewrite | Operate Oore · `/operate/access/hosted-ui` | Truth, Deploy, Voice, URL | No | Hosted UI is an optional client for HTTPS-reachable instances, not a universal onboarding stage. |

## Guides — 31 pages

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/guides/index.md` · `/guides` | Find a task · owner/developer/admin | Approved journey model | Rewrite and redirect as needed | Build and distribute · `/build` | Tree, Voice, URL | No | Replace the generic flattened guide index with the build/distribution journey landing page. |
| `apps/docs/docs/guides/projects/create-project.md` · `/guides/projects/create-project` | Add a project · owner/developer | Project/source UI and API contract | Keep and rewrite | Build and distribute · `/build/projects/create` | Truth, Tree, Voice, URL | No | Separate local-repository and connected-source paths while keeping one observable project-created result. |
| `apps/docs/docs/guides/projects/pipeline-config.md` · `/guides/projects/pipeline-config` | Define a repository pipeline · developer | Pipeline parser/schema and UI | Keep and rewrite | Build and distribute · `/build/pipelines/oore-yaml` | Truth, Voice, URL | No | Keep the task focused; move exhaustive schema material to Reference and remove contradictory examples. |
| `apps/docs/docs/guides/projects/pipeline-ui-fallback.md` · `/guides/projects/pipeline-ui-fallback` | Configure a pipeline in the UI · developer | Pipeline editor UI and API | Keep and rewrite | Build and distribute · `/build/pipelines/use-the-ui` | Truth, Voice, URL | No | Present the UI as a supported authoring path rather than an unexplained fallback. |
| `apps/docs/docs/guides/projects/trigger-builds.md` · `/guides/projects/trigger-builds` | Start a build · developer | Build UI, webhook handler, build API | Keep and rewrite | Build and distribute · `/build/run/trigger` | Truth, Voice, URL | No | Separate manual, webhook, and API triggers and link API detail rather than duplicating it. |
| `apps/docs/docs/guides/projects/cancel-builds.md` · `/guides/projects/cancel-builds` | Stop a queued or running build · developer | Build UI and cancellation contract | Keep and rewrite | Build and distribute · `/build/run/cancel` | Truth, Voice, URL | No | Preserve the focused task with permissions, state constraints, and an observable cancelled result. |
| `apps/docs/docs/guides/integrations/github-app.md` · `/guides/integrations/github-app` | Connect GitHub · owner/admin | GitHub integration UI, callback and webhook contract | Keep, absorb duplicate, rewrite | Build and distribute · `/build/sources/github` | Truth, Voice, URL | No | Becomes the single GitHub task and must use the verified callback flow. |
| `apps/docs/docs/guides/integrations/gitlab.md` · `/guides/integrations/gitlab` | Connect GitLab · owner/admin | GitLab integration UI and webhook contract | Keep and rewrite | Build and distribute · `/build/sources/gitlab` | Truth, Voice, URL | Mixed | Remove unexplained Oore deployment assumptions and teach only provider-specific setup. |
| `apps/docs/docs/guides/integrations/webhooks.md` · `/guides/integrations/webhooks` | Diagnose source webhooks · owner/developer | Integration webhook handlers and delivery UI | Move and rewrite | Build and distribute · `/build/sources/webhooks/troubleshoot` | Truth, Voice, URL | No | It is troubleshooting, not a general configuration guide; remove payload/API duplication. |
| `apps/docs/docs/guides/signing/android-keystore.md` · `/guides/signing/android-keystore` | Add Android signing material · owner/developer | Signing settings UI and signing-store contract | Keep, absorb first-signed-build, rewrite | Build and distribute · `/build/sign/android` | Truth, Voice, URL | No | One canonical Android signing task should cover keystore upload, pipeline selection, and verification. |
| `apps/docs/docs/guides/signing/android-gradle.md` · `/guides/signing/android-gradle` | Configure Gradle to consume signing inputs · developer | Runner signing environment and build contract | Keep and rewrite | Build and distribute · `/build/sign/android/gradle` | Truth, Voice, URL | No | Reconcile the current signing-secret contradiction and state the repository-process boundary precisely. |
| `apps/docs/docs/guides/signing/ios-certificates.md` · `/guides/signing/ios-certificates` | Add iOS certificates and profiles · owner/developer | Signing settings UI and signing-store contract | Keep and rewrite | Build and distribute · `/build/sign/ios/certificates` | Truth, Voice, URL | No | Keep acquisition outside Oore and make upload/selection/verification the Oore task. |
| `apps/docs/docs/guides/signing/ios-manual-signing.md` · `/guides/signing/ios-manual-signing` | Configure manual iOS signing · developer | Pipeline/signing UI and runner signing contract | Keep and rewrite | Build and distribute · `/build/sign/ios/manual` | Truth, Voice, URL | No | Retain a distinct manual-signing path with exact prerequisites and output verification. |
| `apps/docs/docs/guides/signing/ios-api-signing.md` · `/guides/signing/ios-api-signing` | Configure App Store Connect API signing · owner/developer | Signing UI and App Store Connect integration contract | Keep and rewrite | Build and distribute · `/build/sign/ios/app-store-connect` | Truth, Voice, URL | No | Retain the automatic path and remove duplicated endpoint/internal implementation material. |
| `apps/docs/docs/guides/signing/ios-device-registration.md` · `/guides/signing/ios-device-registration` | Register test devices · owner/QA | Device registration UI and signing contract | Keep and rewrite | Build and distribute · `/build/distribute/ios-devices` | Truth, Voice, URL | No | This is a distribution prerequisite; lead with the installability outcome and exact device state. |
| `apps/docs/docs/guides/artifacts/configure-storage.md` · `/guides/artifacts/configure-storage` | Choose artifact storage · owner/operator | Artifact settings UI and storage contract | Keep and rewrite | Operate Oore · `/operate/storage/artifacts` | Truth, Deploy, Voice, URL | No | Reconcile whether local storage is automatic and separate default behavior from optional object storage. |
| `apps/docs/docs/guides/artifacts/download-artifacts.md` · `/guides/artifacts/download-artifacts` | Download a build output · developer/QA | Artifact UI and signed-download contract | Keep and rewrite | Build and distribute · `/build/distribute/download` | Truth, Voice, URL | No | Keep one user task and link to artifact-access explanation and generated API. |
| `apps/docs/docs/guides/artifacts/install-mobile-builds.md` · `/guides/artifacts/install-mobile-builds` | Install Android or iOS test builds · QA/developer | QA releases UI, artifact metadata, signing contract | Keep and rewrite | Build and distribute · `/build/distribute/install` | Truth, Voice, URL | No | Split platform prerequisites progressively and end with an installed-build check. |
| `apps/docs/docs/guides/users/invite-users.md` · `/guides/users/invite-users` | Invite a team member · owner/admin | User UI, invitation and email contract | Keep, absorb duplicate, rewrite | Team and access · `/team/invite` | Truth, Voice, URL | No | Becomes the canonical invitation task; exact delivery behavior must come from the product. |
| `apps/docs/docs/guides/users/manage-roles.md` · `/guides/users/manage-roles` | Change instance and project access · owner/admin | User/project membership UI and RBAC policy | Keep and rewrite | Team and access · `/team/roles` | Truth, Voice, URL | No | Distinguish instance roles from project membership and link the exhaustive matrix to Reference. |
| `apps/docs/docs/guides/users/disable-users.md` · `/guides/users/disable-users` | Suspend or restore access · owner/admin | User administration UI and session/RBAC contract | Keep and rewrite | Team and access · `/team/disable-users` | Truth, Voice, URL | No | State the difference between disabling, removing membership, and deleting data. |
| `apps/docs/docs/guides/oidc/index.md` · `/guides/oidc` | Enable Remote OIDC · owner/operator | External-access UI and OIDC contract | Keep and rewrite | Team and access · `/team/access/oidc` | Truth, Deploy, Voice, URL | No | General setup owns shared concepts; provider pages contain provider-only navigation. |
| `apps/docs/docs/guides/oidc/google.md` · `/guides/oidc/google` | Configure Google OIDC · owner/operator | Runtime-generated callback values and Google configuration | Keep and rewrite | Team and access · `/team/access/oidc/google` | Truth, Deploy, Voice, URL | No | Use the instance-provided callback URI and keep only Google-specific steps. |
| `apps/docs/docs/guides/oidc/azure-ad.md` · `/guides/oidc/azure-ad` | Configure Microsoft Entra ID OIDC · owner/operator | Runtime-generated callback values and Entra configuration | Keep and rewrite | Team and access · `/team/access/oidc/entra` | Truth, Deploy, Voice, URL | No | Standardize the current product name while preserving a redirect from the Azure AD slug. |
| `apps/docs/docs/guides/oidc/okta.md` · `/guides/oidc/okta` | Configure Okta OIDC · owner/operator | Runtime-generated callback values and Okta configuration | Keep and rewrite | Team and access · `/team/access/oidc/okta` | Truth, Deploy, Voice, URL | No | Keep only provider-specific steps and an observable sign-in verification. |
| `apps/docs/docs/guides/oidc/auth0.md` · `/guides/oidc/auth0` | Configure Auth0 OIDC · owner/operator | Runtime-generated callback values and Auth0 configuration | Keep and rewrite | Team and access · `/team/access/oidc/auth0` | Truth, Deploy, Voice, URL | No | Keep only provider-specific steps and an observable sign-in verification. |
| `apps/docs/docs/guides/oidc/keycloak.md` · `/guides/oidc/keycloak` | Configure Keycloak OIDC · owner/operator | Runtime-generated callback values and Keycloak configuration | Keep and rewrite | Team and access · `/team/access/oidc/keycloak` | Truth, Deploy, Voice, URL | No | Keep only provider-specific steps and an observable sign-in verification. |
| `apps/docs/docs/guides/runners/external-runner.md` · `/guides/runners/external-runner` | Enrol and operate a Direct macOS runner · owner/operator | Installer, runner CLI, daemon runner policy | Keep and rewrite | Operate Oore · `/operate/runners/direct` | Truth, Deploy, Voice, URL | Mixed | Separate normal enrolment/health from one-time alpha migrations and protocol reference. |
| `apps/docs/docs/guides/runners/embedded-runner.md` · `/guides/runners/embedded-runner` | Understand why embedded execution is absent · operator | Current runner architecture and trust model | Remove authored task; redirect | Understand Oore · `/understand/runner-trust` | Truth, Tree, URL | Mixed | A removed/unavailable feature page is product archaeology; preserve only the durable trust decision. |
| `apps/docs/docs/guides/multi-instance/add-instance.md` · `/guides/multi-instance/add-instance` | Connect another instance to the web app · owner/operator | Instance switcher UI and connection-store contract | Keep and rewrite | Operate Oore · `/operate/instances/add` | Truth, Deploy, Voice, URL | Mixed | Teach the user-visible connection task without browser-storage or query-cache implementation detail. |
| `apps/docs/docs/guides/multi-instance/switch-instances.md` · `/guides/multi-instance/switch-instances` | Change active instance · owner/developer/QA | Instance switcher UI and auth/session behavior | Keep and rewrite | Operate Oore · `/operate/instances/switch` | Truth, Voice, URL | Mixed | Describe visible isolation and reauthentication, not internal cache partitioning. |

## Concepts — 8 pages

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/concepts/architecture.md` · `/concepts/architecture` | Understand the product boundary · owner/operator/integrator | Platform contract and deployed components | Keep and rewrite | Understand Oore · `/understand/architecture` | Truth, Deploy, Voice, URL | Mixed | Explain daemon, CLI, web app, runner, and hosted UI without internal deployment history. |
| `apps/docs/docs/concepts/build-execution.md` · `/concepts/build-execution` | Understand a build from queue to artifact · developer/operator | Build state machine, runner and artifact contracts | Keep and rewrite | Understand Oore · `/understand/build-lifecycle` | Truth, Voice, URL | No | Remove endpoint inventories and explain the observable lifecycle and trust boundary. |
| `apps/docs/docs/concepts/file-first-config.md` · `/concepts/file-first-config` | Understand repository-owned pipelines · developer | Pipeline parser/schema and resolution behavior | Keep and rewrite | Understand Oore · `/understand/pipeline-configuration` | Truth, Voice, URL | No | Explain why file-first configuration exists; leave task steps and full schema elsewhere. |
| `apps/docs/docs/concepts/signing-overview.md` · `/concepts/signing-overview` | Understand signing choices and trust · owner/developer | Signing grants, store, runner and pipeline contracts | Keep and rewrite | Understand Oore · `/understand/signing` | Truth, Voice, URL | No | Consolidate security concepts and link platform tasks instead of repeating them. |
| `apps/docs/docs/concepts/artifact-access.md` · `/concepts/artifact-access` | Understand artifact access and expiry · owner/QA/integrator | Artifact authorization and signed-link contract | Keep and rewrite | Understand Oore · `/understand/artifact-delivery` | Truth, Voice, URL | No | Explain the access model; leave downloads, installs, and endpoint detail to task/reference pages. |
| `apps/docs/docs/concepts/security-model.md` · `/concepts/security-model` | Understand auth and execution trust · owner/operator | Auth modes, RBAC, proxy and runner policies | Keep and rewrite | Understand Oore · `/understand/security` | Truth, Deploy, Voice, URL | No | Becomes the canonical explanation for Local Only, Remote modes, identity trust, and Direct execution. |
| `apps/docs/docs/concepts/multi-instance.md` · `/concepts/multi-instance` | Understand instance isolation · owner/operator | Web connection and session model | Keep and rewrite | Understand Oore · `/understand/multiple-instances` | Truth, Deploy, Voice, URL | Mixed | Remove localStorage, sessionStorage, cache, and framework detail; retain user-visible isolation. |
| `apps/docs/docs/concepts/runner-protocol.md` · `/concepts/runner-protocol` | Understand runner trust and lifecycle · operator/integrator | Runner/daemon contract and generated API | Split and move | Understand Oore + Reference · `/understand/runner-trust` | Truth, Tree, Voice, URL | No | Keep trust/lifecycle explanation as a concept and send protocol operations to generated API reference. |

## Reference — 28 pages

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/reference/index.md` · `/reference` | Find exact product facts · developer/operator/integrator | CLI, schemas, contracts, generated OpenAPI | Rewrite | Reference · `/reference` | Truth, Tree, Voice | No | Become the single reference landing, including generated API rather than a peer OpenAPI root. |
| `apps/docs/docs/reference/error-codes.md` · `/reference/error-codes` | Interpret machine errors · developer/integrator | Error enum and OpenAPI contract | Keep and validate/generate | Reference · `/reference/errors` | Truth, URL | No | Exact values must be source-backed and mechanically checked rather than manually drifting. |
| `apps/docs/docs/reference/build-states.md` · `/reference/build-states` | Interpret build state · developer/operator/integrator | Build state enum and transitions | Keep and validate/generate | Reference · `/reference/build-states` | Truth, URL | No | Preserve the exact state machine with links to the lifecycle concept. |
| `apps/docs/docs/reference/setup-states.md` · `/reference/setup-states` | Interpret setup readiness · owner/integrator | Public setup status and daemon state machine | Keep and validate/generate | Reference · `/reference/setup-states` | Truth, URL | No | Exact states belong in reference; onboarding should not duplicate them. |
| `apps/docs/docs/reference/rbac.md` · `/reference/rbac` | Look up permissions · owner/admin/developer | RBAC policy and project membership contract | Keep and validate/generate | Reference · `/reference/roles` | Truth, URL | No | Separate instance roles and project membership and keep exact permission names source-backed. |
| `apps/docs/docs/reference/cli/index.md` · `/reference/cli` | Find an operator command · owner/operator | CLI command definitions and `--help` output | Rewrite and validate/generate | Reference · `/reference/cli` | Truth, Voice | Mixed | Current claim of complete coverage is false and includes malformed/stale material. |
| `apps/docs/docs/reference/cli/oore-config.md` · `/reference/cli/oore-config` | Look up `oore config` · operator | CLI command definition | Keep and validate/generate | Reference · `/reference/cli/oore-config` | Truth | Mixed | Remove alpha-tranche prose and match actual keys, flags, output, and errors. |
| `apps/docs/docs/reference/cli/oore-setup.md` · `/reference/cli/oore-setup` | Look up `oore setup` · owner/operator | CLI command and setup contract | Keep and validate/generate | Reference · `/reference/cli/oore-setup` | Truth, Deploy | No | Resolve the current four-step/five-step and legacy/current contradictions. |
| `apps/docs/docs/reference/cli/oore-recovery.md` · `/reference/cli/oore-recovery` | Mint a recovery link · owner/operator | CLI command and recovery-token contract | Keep and validate/generate | Reference · `/reference/cli/oore-recovery` | Truth | No | Preserve exact security, locality, expiry, and single-use behavior. |
| `apps/docs/docs/reference/cli/oore-doctor.md` · `/reference/cli/oore-doctor` | Run diagnostics · owner/operator | CLI command and diagnostic checks | Keep and validate/generate | Reference · `/reference/cli/oore-doctor` | Truth | No | Match actual checks and exit behavior; task interpretation can live in troubleshooting. |
| `apps/docs/docs/reference/cli/oore-status.md` · `/reference/cli/oore-status` | Inspect instance status · owner/operator | CLI command and status API | Keep and validate/generate | Reference · `/reference/cli/oore-status` | Truth | No | Match actual auth requirements, fields, and exit behavior. |
| `apps/docs/docs/reference/cli/oore-login.md` · `/reference/cli/oore-login` | Authenticate the CLI · owner/operator | CLI command and Local/Remote auth contract | Keep and validate/generate | Reference · `/reference/cli/oore-login` | Truth, Deploy | Mixed | Remove alpha-mode language and describe current token import and Local Only behavior. |
| `apps/docs/docs/reference/config/oore-yaml.md` · `/reference/config/oore-yaml` | Look up pipeline schema · developer | Parser/schema and examples accepted by the product | Keep and validate/generate | Reference · `/reference/config/oore-yaml` | Truth | No | Must be canonical and mechanically agree with the parser, including `extra_args`. |
| `apps/docs/docs/reference/config/daemon-config.md` · `/reference/config/daemon-config` | Look up daemon settings · operator | Daemon config parser and defaults | Keep and validate/generate | Reference · `/reference/config/daemon` | Truth, Deploy, URL | No | Resolve CORS/default drift and separate supported settings from implementation detail. |
| `apps/docs/docs/reference/config/environment-variables.md` · `/reference/config/environment-variables` | Look up environment variables · operator/developer | Executable config, installer and runner contracts | Keep and validate/generate | Reference · `/reference/config/environment` | Truth, Deploy, URL | Mixed | Reconcile CORS and signing-secret claims and remove variables that are not public contracts. |
| `apps/docs/docs/reference/config/installer.md` · `/reference/config/installer` | Automate or customize installation · operator | Installer script and acceptance tests | Keep and validate/generate | Reference · `/reference/config/installer` | Truth, Deploy | Mixed | Holds roles, version/channel selection, and automation controls split out of beginner install. |
| `apps/docs/docs/reference/api/index.md` · `/reference/api` | Find HTTP API reference · integrator | Generated OpenAPI | Merge into canonical API landing; remove authored pointer | Reference · `/reference/api` | Truth, Tree, URL, Astro | No | Merge any useful orientation into the moved OpenAPI landing; do not retain a second searchable page at the same destination. |
| `apps/docs/docs/reference/api/auth.md` · `/reference/api/auth` | Find auth operations · integrator | Generated OpenAPI auth operations | Redirect, remove authored pointer | Reference · `/reference/api/auth` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/builds.md` · `/reference/api/builds` | Find build operations · integrator | Generated OpenAPI build operations | Redirect, remove authored pointer | Reference · `/reference/api/builds` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/users.md` · `/reference/api/users` | Find user operations · integrator | Generated OpenAPI user operations | Redirect, remove authored pointer | Reference · `/reference/api/users` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/projects.md` · `/reference/api/projects` | Find project operations · integrator | Generated OpenAPI project operations | Redirect, remove authored pointer | Reference · `/reference/api/projects` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/artifacts.md` · `/reference/api/artifacts` | Find artifact operations · integrator | Generated OpenAPI artifact operations | Redirect, remove authored pointer | Reference · `/reference/api/artifacts` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/integrations.md` · `/reference/api/integrations` | Find integration operations · integrator | Generated OpenAPI integration operations | Redirect, remove authored pointer | Reference · `/reference/api/integrations` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/pipelines.md` · `/reference/api/pipelines` | Find pipeline/signing operations · integrator | Generated OpenAPI pipeline operations | Redirect, remove authored pointer | Reference · `/reference/api/pipelines` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/setup.md` · `/reference/api/setup` | Find setup operations · integrator | Generated OpenAPI setup operations | Redirect, remove authored pointer | Reference · `/reference/api/setup` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/logs.md` · `/reference/api/logs` | Find log operations · integrator | Generated OpenAPI log operations | Redirect, remove authored pointer | Reference · `/reference/api/logs` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/settings.md` · `/reference/api/settings` | Find settings operations · integrator | Generated OpenAPI settings operations | Redirect, remove authored pointer | Reference · `/reference/api/settings` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |
| `apps/docs/docs/reference/api/runners.md` · `/reference/api/runners` | Find runner operations · integrator | Generated OpenAPI runner operations | Redirect, remove authored pointer | Reference · `/reference/api/runners` | Truth, URL, Astro | No | Preserve the useful entry URL without keeping a searchable duplicate page. |

## OpenAPI landing — 1 page

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/openapi/index.md` · `/openapi` | Enter or download the generated HTTP reference · integrator | Generated OpenAPI and Fumadocs OpenAPI source | Move and rewrite as the sole authored API landing | Reference · `/reference/api` | Truth, Tree, URL, Astro | No | Generated API is Reference content, not a separate navigation root; retain download and operation discovery without a duplicate authored pointer. |

## Operations — 14 pages

| Current page and URL | User job · audience | Canonical factual source | Disposition | Proposed home and URL | Depends on | Internal | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/docs/docs/operations/index.md` · `/operations` | Find an operator task · owner/operator | Supported deployment and lifecycle contracts | Rewrite | Operate Oore · `/operate` | Truth, Deploy, Tree, Voice, URL | Mixed | Organize by deploy, access, runners/instances, storage, maintain, recover, and support; remove the internal infrastructure-recipe link. |
| `apps/docs/docs/operations/deployment.md` · `/operations/deployment` | Deploy a supported instance · owner/operator | Installer, service definitions, platform contract | Split and rewrite | Operate Oore · `/operate/deploy` | Truth, Deploy, Voice, URL | Mixed | Replace unsafe/stale examples with platform-neutral supported shapes and explicit trust checks. |
| `apps/docs/docs/operations/split-roles.md` · `/operations/split-roles` | Separate frontend and backend roles · operator | Installer roles, hosted/static UI and daemon network contract | Keep and rewrite | Operate Oore · `/operate/deploy/split-roles` | Truth, Deploy, Voice, URL | Mixed | Retain only if the deployment contract confirms it as supported; state macOS backend and UI-only boundaries and remove the internal infrastructure-recipe link. |
| `apps/docs/docs/operations/mac-studio-netbird-warpgate.md` · `/operations/mac-studio-netbird-warpgate` | Reproduce Oore's named infrastructure recipe · maintainer | Private infrastructure governance | Remove from public; move privately | Private operations · no public canonical page | Deploy, URL | Yes | Named Oore infrastructure is the primary material explicitly excluded from the public site. |
| `apps/docs/docs/operations/monitoring.md` · `/operations/monitoring` | Monitor instance health · operator | Health/metrics endpoints and service behavior | Keep and rewrite | Operate Oore · `/operate/maintain/monitor` | Truth, Deploy, Voice, URL | No | Teach supported signals and observable alerts without Oore-internal monitoring topology. |
| `apps/docs/docs/operations/upgrade.md` · `/operations/upgrade` | Upgrade safely · owner/operator | CLI/installer update behavior and release artifacts | Keep and rewrite | Operate Oore · `/operate/maintain/upgrade` | Truth, Deploy, Voice, URL | Mixed | Keep evergreen drain, backup, upgrade, verify, and rollback behavior; remove one-time alpha migrations. |
| `apps/docs/docs/operations/backup-restore.md` · `/operations/backup-restore` | Back up and restore an instance · owner/operator | CLI/daemon backup implementation and data model | Keep and rewrite | Operate Oore · `/operate/maintain/backup-restore` | Truth, Voice, URL | No | Use source-backed commands, integrity checks, restore preconditions, and a verified recovery result. |
| `apps/docs/docs/operations/clean-reinstall.md` · `/operations/clean-reinstall` | Reset or recover an installation · owner/operator | Uninstaller, installer, data/backup behavior | Merge and redirect | Operate Oore · `/operate/recover/reset` | Truth, Voice, URL | Mixed | Turn the alpha cleanup page into a backup-first recovery task and remove author-facing notes. |
| `apps/docs/docs/operations/troubleshooting.md` · `/operations/troubleshooting` | Diagnose common failures · owner/operator/developer | Product error surfaces, CLI diagnostics, health endpoints | Split and rewrite | Operate Oore · `/operate/troubleshoot` | Truth, Deploy, Voice, URL | Mixed | Organize by observable symptom; move exhaustive exact values to Reference and remove stale behavior. |
| `apps/docs/docs/operations/release-channels.md` · `/operations/release-channels` | Choose stable, beta, or alpha · owner/operator | Release workflow, installer/channel behavior | Split and rewrite | Operate Oore · `/operate/releases` | Truth, Voice, URL | Mixed | Keep public channel semantics and install/update commands; remove onboarding, auth, demo, reset, and internal automation. |
| `apps/docs/docs/operations/known-limitations.md` · `/operations/known-limitations` | Assess current product constraints · evaluator/operator | Maintained release/issues source | Keep only with an owner; rewrite | Operate Oore · `/operate/known-limitations` | Truth, Voice, URL | Mixed | Version-pinned prose will rot unless ownership/source is explicit; do not expose internal roadmap language. |
| `apps/docs/docs/operations/report-an-issue.md` · `/operations/report-an-issue` | File a reproducible report · all users | GitHub issue templates and public support contract | Keep, absorb duplicate, rewrite | Operate Oore · `/operate/support/report-an-issue` | Truth, Voice, URL | No | One concise public checklist should defer exact required fields to the canonical issue template. |
| `apps/docs/docs/operations/alpha-feedback.md` · `/operations/alpha-feedback` | Give alpha feedback · tester | GitHub issue templates and public support contract | Merge and redirect | Operate Oore · `/operate/support/report-an-issue` | Truth, Voice, URL | Mixed | Duplicates reporting guidance, contains malformed/stale commands, and exposes lifecycle language. |
| `apps/docs/docs/operations/release-automation-mac-mini.md` · `/operations/release-automation-mac-mini` | Operate Oore's release pipeline · maintainer | Private release governance and repository workflows | Remove from public; move to contributor/private docs | No public canonical page | URL | Yes | Repository secrets, workflow/project names, promotion checks, and Oore's Mac runner are not user documentation. |

## Generated OpenAPI surface

`apps/docs/public/openapi.json` is the canonical machine-readable source for
**102 paths, 130 operations, and 21 distinct operation tags**. Nineteen of
those tags are declared in the document-level tag index; `System` and
`Scoped Download Tokens` are used by operations but omitted there. The
generated operation pages are not additional authored-page rows.

Disposition:

- Keep generation from the canonical OpenAPI document.
- Make the generated landing and operations part of Reference in the single
  Fumadocs tree.
- Index generated operations together with authored pages in static search.
- Let **URL** decide whether operation routes remain
  `/openapi/operations/<operationId>` or move behind redirects to
  `/reference/api/operations/<operationId>`.
- Remove the 12 authored `reference/api/**` pointer pages after their useful
  entry URLs have explicit redirects or generated equivalents.

## Existing redirects — 5

| Current redirect | Current target | Provisional disposition |
| --- | --- | --- |
| `/getting-started/public-alpha` | `/operations/release-channels` | Retarget to the approved public release-channel page. |
| `/getting-started/known-limitations` | `/operations/known-limitations` | Retarget to the approved maintained limitations page. |
| `/getting-started/issue-report-checklist` | `/operations/report-an-issue` | Retarget to the canonical report-an-issue task. |
| `/getting-started/clean-reinstall` | `/operations/clean-reinstall` | Chain-free redirect to the final recovery/reset task. |
| `/getting-started/alpha-feedback-playbook` | `/operations/alpha-feedback` | Retarget directly to the merged report-an-issue task. |

The URL contract must ensure old routes redirect directly to final canonical
targets rather than creating redirect chains.

## Disposition conclusions

- The two clearly internal authored pages leave the public corpus:
  `operations/mac-studio-netbird-warpgate.md` and
  `operations/release-automation-mac-mini.md`.
- The 12 authored API pointer pages leave the searchable content corpus after
  redirects/generated entry points exist.
- Duplicate onboarding pages merge into canonical task pages for GitHub,
  signing, invitations, and issue reporting.
- Surviving pages marked **Mixed** keep their public user job but lose
  maintainer infrastructure, framework internals, lifecycle jargon, and
  one-time migration history.
- No factual rewrite can be treated as final until **Truth** resolves the
  conflicting product claims called out in this ledger.
