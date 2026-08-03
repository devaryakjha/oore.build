# Public deployment contract

Status: decision resolution for
[#197](https://github.com/oore-ci/oore.build/issues/197), at baseline
`66e56785394960f280b7c37244ed72b1dccca4bc`.

This is the deployment and access handoff for public-documentation writers. It
classifies the intentionally supported product shapes, fixes the installer and
privilege boundary, and maps every affected page from the
[public documentation disposition ledger](https://github.com/oore-ci/oore.build/blob/f9a9699d767012b8ed409c6622f1d2254cc8e37a/wayfinder/public-docs-page-ledger.md)
to a contract row. Factual behavior comes from the
[public documentation truth table](https://github.com/oore-ci/oore.build/blob/ca90c65a6fefbd5cf1df460a083da46d52167fcf/wayfinder/public-docs-truth-table.md).

This contract does not rewrite public prose, choose final URLs or navigation,
change product behavior, publish Oore's infrastructure, or define a new
deployment product.

## Support levels

| Level            | Public meaning                                                                                                                  | Writer treatment                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default**      | The first recommended, end-to-end product journey.                                                                              | Lead with it and verify its observable result before offering expansion paths.                                                              |
| **Supported**    | An intentional product path covered by current behavior.                                                                        | Give a focused task with prerequisites, trust boundary, verification, and troubleshooting.                                                  |
| **Advanced**     | An intentional supported path that makes the operator responsible for additional network, identity, or delivery infrastructure. | Put it after the default path, state every operator-owned boundary, and avoid implying that Oore configures the surrounding infrastructure. |
| **Illustrative** | An interoperability example, not an end-to-end support promise.                                                                 | Label it as an example after the generic contract. Do not make it the canonical journey or compatibility guarantee.                         |
| **Unsupported**  | A disabled, absent, unsafe, or non-product path.                                                                                | State the boundary or redirect to the supported path. Do not publish a task recipe.                                                         |
| **Private**      | Oore-maintainer or release-operations material outside the public product contract.                                             | Remove it from the public corpus. Never link public readers to a private destination.                                                       |

**Default**, **Supported**, and **Advanced** are all intentional product
contracts. The distinction controls documentation order and operator
responsibility, not whether a path is real.

## Required-topology index

Each concrete requested shape is classified by exactly one row.

| Requested shape                                         | Contract row | Support level |
| ------------------------------------------------------- | ------------ | ------------- |
| One Mac, Local Only, ending in a debug APK              | **T1**       | Default       |
| External Access with OIDC                               | **T2**       | Supported     |
| External Access with Trusted Proxy                      | **T3**       | Advanced      |
| Hosted browser client at `ci.oore.build`                | **T4**       | Supported     |
| Self-hosted static UI                                   | **T5**       | Supported     |
| Split frontend/backend using the product frontend proxy | **T6**       | Advanced      |
| Direct macOS runner on the backend Mac                  | **T7**       | Default       |
| Direct macOS runner on another Mac                      | **T8**       | Supported     |
| Multiple backend instances in one browser client        | **T9**       | Supported     |
| Backend-local artifact storage                          | **T10**      | Default       |
| S3 or R2 artifact storage                               | **T11**      | Supported     |
| Externally reachable artifact downloads                 | **T12**      | Supported     |
| Externally reachable Android or iOS install flow        | **T13**      | Advanced      |
| Embedded or hybrid build execution                      | **T14**      | Unsupported   |
| Named third-party deployment examples                   | **T15**      | Illustrative  |
| Oore's own deployment and release operations            | **T16**      | Private       |
| Raw privileged daemon service installation              | **T17**      | Unsupported   |

## Deployment and access rows

### T1 — One-Mac Local Only build path

- **Support level:** Default.
- **Prerequisites:** One customer-owned Mac, the stable installer, a local Git
  repository, and the Flutter/Android tools required by that repository.
- **Runs where:** The backend daemon, operator CLI, local web launcher and
  assets, managed Direct macOS runner, and automatic local artifact storage all
  run on that Mac.
- **Trust and auth boundary:** Local Only login is passwordless and accepted
  only over effective loopback. First local login may create the owner and take
  a fresh instance directly to `ready`. Repository code runs with the managed
  runner account's host permissions.
- **Public docs may promise:** The ordinary interactive macOS install selects
  the complete `all` role; the local client opens the instance; the operator can
  create a project from a local repository, choose **Quick Debug APK**, run it
  on the managed local runner, and download the resulting APK.
- **Public docs must not promise:** OIDC, a proxy, a hosted client, provider
  integration, signing, object storage, a bootstrap-token wizard, or public
  reachability as a prerequisite for first success.
- **Public evidence:** `scripts/install.sh`; `scripts/install-acceptance.sh`;
  `crates/oored/src/auth.rs`;
  `apps/web/src/routes/projects/-create-project-dialog.tsx`;
  `apps/web/src/routes/projects/$projectId/pipelines/new.tsx`.

### T2 — External Access with OIDC

- **Support level:** Supported.
- **Prerequisites:** A ready macOS backend, explicit External Access
  enablement, a non-loopback browser-reachable HTTPS URL, the actual frontend
  origin in the allowed-origin set, valid OIDC provider configuration, and an
  explicit redirect URI ending in `/auth/callback`.
- **Runs where:** The backend remains on a customer-owned Mac. The frontend may
  be the installed client, a self-hosted client, or the hosted client. The
  identity provider remains outside Oore.
- **Trust and auth boundary:** Oore performs OIDC discovery and authorization
  with PKCE, exchanges the frontend callback result at the backend, issues the
  Oore session, and enforces Oore RBAC. Provider credentials stay at the
  backend. External Access has no ordinary loopback authentication bypass.
- **Public docs may promise:** Standards-based OIDC sign-in for non-loopback
  users, provider-specific configuration pages, session revocation on mode
  changes, and host-authorized recovery as a separate break-glass flow.
- **Public docs must not promise:** Anonymous External Access, local passwords,
  a server-side hosted Oore instance, or that omitting `redirect_uri` works.
  Until the fallback is corrected, every example must provide the exact
  frontend callback URI.
- **Public evidence:** `crates/oored/src/auth.rs`;
  `crates/oored/src/instance_settings.rs`; `crates/oored/src/lib.rs`;
  `apps/web/src/lib/oidc-callback.ts`.

### T3 — External Access with Trusted Proxy

- **Support level:** Advanced.
- **Prerequisites:** A ready macOS backend, explicit External Access
  enablement, a protected non-loopback path, an upstream authentication proxy,
  an allowlisted immediate peer CIDR, a configured identity header, and a
  shared proof. When the product frontend proxy creates another hop, the
  upstream-to-frontend and frontend-to-backend proofs must be distinct.
- **Runs where:** The backend remains on a customer-owned Mac. The
  authentication proxy and optional frontend host may run elsewhere. Runner
  placement is independently governed by T7 or T8.
- **Trust and auth boundary:** The upstream proxy authenticates the person.
  Oore accepts identity only when the immediate peer, configured header, and
  shared proof all pass, then issues an Oore session and enforces Oore RBAC.
- **Public docs may promise:** A generic Trusted Proxy contract, the exact
  implemented proxy presets, direct backend-owned initialization, and
  deterministic failure when the trust checks do not pass.
- **Public docs must not promise:** That a forwarded email header is
  authentication by itself, that one proof may be reused across hops, that
  upstream groups become Oore roles, or that Oore configures or certifies the
  operator's proxy, tunnel, VPN, mesh, TLS, or firewall.
- **Public evidence:** `crates/oored/src/auth.rs`;
  `crates/oored/src/instance_settings.rs`; `crates/oore/src/main.rs`;
  `apps/web/tools/oore-web.js`.

### T4 — Hosted browser client at `ci.oore.build`

- **Support level:** Supported.
- **Prerequisites:** A backend that the browser can reach over HTTPS in
  External Access and an explicit allowed origin for the hosted client. The
  hosted origin is not a daemon CORS default.
- **Runs where:** Only static UI assets are hosted by Oore. The browser talks
  directly to the selected customer backend. The backend, runners, builds,
  credentials, and artifact storage remain customer-operated.
- **Trust and auth boundary:** Authentication and authorization belong to the
  selected backend. Instance registrations and authenticated sessions are
  deliberately persisted in namespaced browser storage; setup state uses
  session-scoped browser storage. Sensitive setup and signing inputs travel
  from the browser directly to the selected backend.
- **Public docs may promise:** An optional UI-only browser client for one or
  more HTTPS-reachable instances and no hosted server-side backend, build,
  credential, or artifact service.
- **Public docs must not promise:** A hosted Oore instance, API proxy, runner,
  build service, artifact store, secret store, automatic CORS entry, or access
  to an HTTP loopback backend from the HTTPS page.
- **Public evidence:** `apps/web/src/stores/instance-store.ts`;
  `apps/web/src/stores/auth-store.ts`; `apps/web/src/lib/connectivity.ts`;
  static web deployment configuration.

### T5 — Self-hosted static UI

- **Support level:** Supported.
- **Prerequisites:** Built public web assets on a static host and a
  browser-reachable backend. Cross-origin browser access requires HTTPS
  External Access and the exact static-site origin in backend CORS settings.
- **Runs where:** Static UI assets may be served by any capable static host.
  The backend and each Direct runner still run on macOS. In this row the
  browser calls the backend directly; the static host does not proxy APIs.
- **Trust and auth boundary:** The static host supplies code to the browser;
  the selected backend owns authentication, authorization, setup, and data.
  TLS, DNS, cache policy, and static-host availability remain operator-owned.
- **Public docs may promise:** A separately hosted static client that uses the
  same backend contracts as the installed and hosted clients.
- **Public docs must not promise:** That static hosting creates an API proxy,
  removes CORS, changes the backend's auth mode, or permits an HTTPS page to
  call an unprotected HTTP backend.
- **Public evidence:** static frontend build output;
  `apps/web/src/lib/connectivity.ts`;
  `crates/oored/src/instance_settings.rs`.

### T6 — Split frontend/backend with the product frontend proxy

- **Support level:** Advanced.
- **Prerequisites:** The supported `backend` installer role on macOS, the
  supported `frontend` role on macOS or Linux, protected browser ingress, and a
  protected frontend-to-backend path. Trusted Proxy deployments also require
  frontend pairing and distinct proofs for the two identity hops.
- **Runs where:** The daemon, CLI, and managed Direct runner run on the backend
  Mac. The frontend service and static assets run on the frontend host. The
  product frontend proxy serves the UI and proxies its supported API, health,
  readiness, and install paths to the backend.
- **Trust and auth boundary:** Same-origin browser traffic terminates at the
  frontend host; backend auth and RBAC remain authoritative. The operator owns
  TLS, network reachability, peer restrictions, and protection of any HTTP hop.
- **Public docs may promise:** Supported split installer roles, same-origin
  proxying without browser CORS, or direct cross-origin browser access with
  explicit CORS, plus concrete health checks for both roles.
- **Public docs must not promise:** That Oore configures a VPN, mesh, tunnel,
  reverse proxy, load balancer, TLS certificate, DNS, firewall, or Linux
  backend. A frontend-only host does not run builds.
- **Public evidence:** `scripts/install.sh`;
  `apps/web/tools/oore-web.js`; `crates/oored/src/instance_settings.rs`.

### T7 — Managed Direct macOS runner on the backend Mac

- **Support level:** Default.
- **Prerequisites:** The `all` or `backend` installer role on macOS and the
  repository's required build toolchains.
- **Runs where:** The Direct runner is a service separate from `oored` on the
  same Mac. The supported installer enrolls both managed services to start at
  boot under the selected non-root installation account.
- **Trust and auth boundary:** Creating a project or changing its source is the
  Owner/Admin repository execution decision. Repository commands run directly
  with the runner account's permissions. Oore does not provide hostile-code,
  same-account process, or same-account credential isolation.
- **Public docs may promise:** Automatic managed-local enrollment, boot
  lifecycle, health and operational pause controls, drain behavior, and
  installer/updater recovery of the managed runner.
- **Public docs must not promise:** Embedded execution, a security sandbox,
  untrusted-repository isolation, or that an operational pause is a second
  repository approval control.
- **Public evidence:** `scripts/install.sh`; `crates/oore/src/main.rs`;
  `crates/oored/src/runners.rs`; `crates/oore-runner/src/lib.rs`.

### T8 — Direct macOS runner on another Mac

- **Support level:** Supported.
- **Prerequisites:** Another Mac with the required build toolchains, a
  non-loopback path to the backend, verified current runner CLI commands, and
  manual registration by an operator with runner-write permission. Remote
  runner traffic must use protected transport.
- **Runs where:** `oored` remains on the backend Mac. The separately registered
  Direct runner executes on the other Mac and retains its own runner
  registration and service lifecycle.
- **Trust and auth boundary:** Registration returns the runner token once.
  Protocol compatibility, runner identity, source eligibility, and job
  assignment are enforced by the backend. Repository code has the permissions
  of the remote runner's macOS account.
- **Public docs may promise:** Manual external registration, a separate
  Direct-runner Mac, normal heartbeat/claim behavior, and the same trusted-code
  execution contract as T7.
- **Public docs must not promise:** A runner-only installer role, Linux
  execution, automatic cross-host update orchestration, embedded/hybrid mode,
  or hostile-code isolation.
- **Public evidence:** `crates/oore/src/main.rs`;
  `crates/oored/src/runners.rs`; `crates/oore-runner/src/lib.rs`;
  `crates/oore-contract/src/lib.rs`.

### T9 — Multiple backend instances in one browser client

- **Support level:** Supported.
- **Prerequisites:** A browser client that can reach each backend and valid
  authentication for each instance independently.
- **Runs where:** One browser holds the client-side instance registry and
  instance-scoped sessions. Each backend and its runners remain independent
  customer-operated deployments.
- **Trust and auth boundary:** Auth state and query state are namespaced by
  instance. Switching changes the active API authority. Editing a backend
  origin clears that instance's auth and cache.
- **Public docs may promise:** Adding another backend connection, switching the
  active instance, clearly showing the active instance, and reauthenticating
  independently per backend.
- **Public docs must not promise:** Add-time readiness validation, instance
  removal, session-scoped persistence for ordinary auth, or shared identity,
  data, runner, or artifact state across backends until product behavior adds
  those capabilities.
- **Public evidence:** `apps/web/src/stores/instance-store.ts`;
  `apps/web/src/stores/auth-store.ts`;
  `apps/web/src/lib/instance-context.ts`;
  `apps/web/src/components/AddInstanceDialog.tsx`.

### T10 — Backend-local artifact storage

- **Support level:** Default.
- **Prerequisites:** None beyond a working backend and writable managed data
  root. Local artifact storage is selected automatically when no supported
  object-storage configuration exists.
- **Runs where:** Artifact bytes remain on backend-managed local storage.
  Authorized local uploads and downloads pass through backend token routes.
- **Trust and auth boundary:** The backend authorizes project artifact access
  before issuing scoped upload or download capabilities. Local upload tokens
  are single-use; local request-size limits apply only to this provider.
- **Public docs may promise:** Automatic local storage as a valid supported
  path for the default deployment and short-lived authorized download links.
- **Public docs must not promise:** That object storage is required for
  production, that local storage is merely a demo, or that backups
  automatically include local artifact payloads.
- **Public evidence:** `crates/oored/src/storage.rs`;
  `crates/oored/src/artifacts.rs`; artifact-storage integration tests.

### T11 — S3 or R2 artifact storage

- **Support level:** Supported.
- **Prerequisites:** Complete supported object-storage settings and
  operator-managed credentials, bucket policy, endpoint, retention, and
  availability. Explicit invalid or disabled configuration fails closed.
- **Runs where:** The backend stores configuration and authorizes operations.
  Runners and authorized users receive time-bound presigned object-store URLs;
  artifact bytes do not need to pass through the backend.
- **Trust and auth boundary:** Oore RBAC precedes capability creation. The
  external storage provider enforces each presigned request. Storage
  credentials remain backend-owned.
- **Public docs may promise:** The current S3-compatible and R2 provider
  contracts, exact settings fields, presigned upload/download behavior, and
  local-storage fallback only when no explicit provider is configured.
- **Public docs must not promise:** Provider SLAs, automatic bucket creation,
  a separate R2 account-ID request field, or that local-only size and
  single-use upload constraints apply to presigned object-store uploads.
- **Public evidence:** `crates/oore-contract/src/lib.rs`;
  `crates/oored/src/storage.rs`; `crates/oored/src/instance_settings.rs`.

### T12 — Externally reachable artifact downloads

- **Support level:** Supported.
- **Prerequisites:** An unexpired artifact, project `ReadArtifacts` permission,
  and a browser/device path to the selected delivery endpoint. A public
  internet endpoint is not required.
- **Runs where:** Local-storage downloads use a signed backend route. S3/R2
  downloads use the provider's presigned URL.
- **Trust and auth boundary:** The backend checks project authorization before
  returning `download_url` and `expires_at`. Ordinary download links expire
  after 15 minutes; an expired artifact cannot mint a new link.
- **Public docs may promise:** Authorized ephemeral downloads over the actual
  reachable backend, frontend proxy, or object-store path.
- **Public docs must not promise:** Anonymous artifact browsing, “any
  authenticated user” access, permanent URLs, a universally required External
  Access public URL, or credentials embedded in a download URL.
- **Public evidence:** `crates/oored/src/artifacts.rs`;
  `crates/oore-contract/src/lib.rs`; project-RBAC tests.

### T13 — Externally reachable Android or iOS install flow

- **Support level:** Advanced.
- **Prerequisites:** `ReadArtifacts` permission; a device-reachable artifact
  delivery URL or public instance URL; an APK for Android or complete
  install-ready signed IPA metadata for iOS. iOS OTA delivery requires HTTPS
  and a proxy path that lets token-authenticated `/install/` requests reach
  Oore without an interactive sign-in redirect.
- **Runs where:** The authenticated browser requests an install capability.
  Android fetches the tokenized APK. iOS fetches a generated manifest and then
  the IPA, possibly through the frontend proxy or object storage.
- **Trust and auth boundary:** Oore authorizes the request before issuing an
  artifact-scoped capability. Install capability lifetime is at most one hour
  and never exceeds artifact expiry. The iOS token is reusable within that
  scope because the platform performs multiple requests.
- **Public docs may promise:** Platform-specific Android and iOS installation
  instructions, exact signing/metadata prerequisites, and use of a dedicated
  delivery origin when the main UI origin is unsuitable.
- **Public docs must not promise:** AAB, arbitrary or unsigned IPA
  installation, TestFlight/App Store/enterprise/MDM distribution, automatic
  device registration, anonymous catalogs, or that every interactive proxy
  works with a system installer.
- **Public evidence:** `crates/oored/src/artifact_install.rs`;
  `crates/oore-contract/src/lib.rs`; artifact-install tests.

### T14 — Embedded or hybrid build execution

- **Support level:** Unsupported.
- **Prerequisites:** Not applicable. Both modes fail closed.
- **Runs where:** Nowhere in the supported V1 product. `oored` remains the
  control plane and a separate Direct macOS runner owns execution.
- **Trust and auth boundary:** The Direct-runner trusted-repository model in T7
  and T8 is the only current boundary.
- **Public docs may promise:** Only that build execution requires a Direct
  macOS runner and that the durable runner-trust explanation remains
  available.
- **Public docs must not promise:** Embedded/hybrid enablement, migration
  steps, hidden flags, or equivalent containment.
- **Public evidence:** `crates/oored/src/embedded_runner.rs`; runner-mode
  fail-closed tests.

### T15 — Named third-party deployment examples

- **Support level:** Illustrative.
- **Prerequisites:** The generic contract row for the underlying topology must
  already be satisfied and verified.
- **Runs where:** Operator-owned infrastructure outside Oore.
- **Trust and auth boundary:** Each example must restate the generic transport,
  peer, header, proof, origin, and reachability boundary it demonstrates.
- **Public docs may promise:** Small, clearly labelled examples involving a
  reverse proxy, encrypted private network, tunnel, or load balancer after the
  platform-neutral path is complete.
- **Public docs must not promise:** End-to-end certification, recommendation,
  maintenance, or compatibility for NetBird, HAProxy, nginx, Caddy, Cloudflare
  Tunnel/`cloudflared`, ngrok, a hardware model, or a cloud host. Warpgate's
  implemented Trusted Proxy preset and optional install-ticket behavior may be
  documented under T3 and T13; that does not make a complete
  Warpgate/NetBird/proxy topology supported. S3/R2 storage under T11 and
  standards-based OIDC provider setup under T2 are explicit product
  capabilities, not deployment-example endorsements.
- **Public evidence:** Product-generic installer, auth, network, frontend-proxy,
  and artifact contracts; no named infrastructure recipe is authoritative.

### T16 — Oore's own deployment and release operations

- **Support level:** Private.
- **Prerequisites:** Not applicable to public readers.
- **Runs where:** Oore-maintainer infrastructure and release systems outside
  the customer product boundary.
- **Trust and auth boundary:** Internal identities, infrastructure, secrets,
  addresses, service topology, release machinery, and operational controls
  remain outside public product documentation.
- **Public docs may promise:** Generic reusable product behavior extracted into
  T1–T13 and public release-channel semantics sourced from repository
  automation. Sanitized source-owned contribution mechanics may live in
  repository contributor guidance when they are genuinely contributor-facing.
- **Public docs must not promise:** A reproducible copy of Oore's environment,
  access to private material, or any customer support contract inferred from
  internal operations.
- **Page treatment:** Remove
  `apps/docs/docs/operations/mac-studio-netbird-warpgate.md` and
  `apps/docs/docs/operations/release-automation-mac-mini.md` from the public
  corpus. Do not create a public canonical replacement or redirect to a
  private location. Preserve only generic product facts in their proper public
  tasks.

### T17 — Supported installer and privilege boundary

- **Support level:** Unsupported for raw privileged daemon installation; the
  release installer and managed updater are the supported product boundary.
- **Prerequisites:** A supported macOS backend role and an operator who can
  approve the installer's narrowly scoped administrator operations.
- **Runs where:** The installer manages daemon and runner service definitions
  using fixed operating-system tools. The resulting services run as the
  selected non-root installation account.
- **Trust and auth boundary:** Administrator authority is limited to the
  installer-managed operating-system service operations. A user-owned Oore
  executable must not cross the root boundary.
- **Public docs may promise:** Initial install, reinstall/repair, service
  lifecycle, and managed update through the stable installer/updater. Runner
  task/reference material may document the verified non-root
  `oore runner install-service` enrollment/repair seam.
- **Public docs must not promise:** `sudo oored install-service --system` as an
  advanced recipe, running the whole installer or a user-owned Oore binary as
  root, hand-authoring system service files, or raw privileged service
  installation as a supported fallback.
- **Public evidence:** `scripts/install.sh`;
  `scripts/install-acceptance.sh`; `crates/oored/src/main.rs`;
  `crates/oore/src/main.rs`.

## Platform-neutral writing rule

Use capability language for everything the operator supplies: static hosting,
DNS, TLS, reverse proxying, private networking, tunnels, load balancing,
firewalls, object-storage policy, and identity-provider administration.

The real V1 platform constraints are narrow:

- `oored` runs on macOS.
- Every Direct runner runs on macOS.
- The supported frontend-only installer role runs on macOS or Linux.
- Plain static UI assets may be served by any capable static host.
- A browser, runner, or device needs reachability only to the endpoint it
  actually uses; “externally reachable” does not mean public internet.
- Mac Studio, Mac mini, a particular cloud, or a named network product is never
  a product prerequisite.

## Page-level writer map

This coverage set is the 27 ledger rows explicitly dependent on **Deploy**,
plus the default first-build path, the remaining runner/multi-instance/artifact
surfaces, affected generated-reference pointers, both internal operations
pages, and pages that currently carry a named deployment example. Each page
appears once below; a page may consume more than one contract row.

| Current authored page                                      | Contract row(s)          | Required content action                                                                                        |
| ---------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `apps/docs/docs/getting-started/index.md`                  | T1                       | Lead with the one-Mac path to a debug APK.                                                                     |
| `apps/docs/docs/getting-started/prerequisites.md`          | T1                       | Keep only prerequisites for the default build; defer expansion-path requirements.                              |
| `apps/docs/docs/getting-started/install.md`                | T1, T6, T17              | Keep the default installer task; move role automation to reference and delete raw privileged recipes.          |
| `apps/docs/docs/getting-started/first-instance.md`         | T1, T2, T3, T15          | Teach automatic Local Only initialization first; separate External Access and remove the internal recipe link. |
| `apps/docs/docs/getting-started/first-build.md`            | T1, T7                   | Use a local repository and **Quick Debug APK**; do not require a provider or signed release.                   |
| `apps/docs/docs/getting-started/hosted-ui-onboarding.md`   | T4, T9, T15              | Move after External Access; correct HTTPS, direct-browser, CORS, and browser-persistence claims.               |
| `apps/docs/docs/guides/integrations/webhooks.md`           | T15                      | Keep provider webhook behavior; label or remove named tunnel examples.                                         |
| `apps/docs/docs/guides/artifacts/configure-storage.md`     | T10, T11                 | Lead with automatic local storage; present S3/R2 as optional supported providers.                              |
| `apps/docs/docs/guides/artifacts/download-artifacts.md`    | T12                      | Use project authorization, `download_url`, provider-specific delivery, and expiry.                             |
| `apps/docs/docs/guides/artifacts/install-mobile-builds.md` | T13, T15                 | Split Android/iOS prerequisites and describe the device-reachable delivery boundary.                           |
| `apps/docs/docs/guides/oidc/index.md`                      | T2                       | Own shared OIDC prerequisites and the explicit callback URI.                                                   |
| `apps/docs/docs/guides/oidc/google.md`                     | T2                       | Keep only provider-specific configuration and verification.                                                    |
| `apps/docs/docs/guides/oidc/azure-ad.md`                   | T2                       | Keep only provider-specific configuration and verification.                                                    |
| `apps/docs/docs/guides/oidc/okta.md`                       | T2                       | Keep only provider-specific configuration and verification.                                                    |
| `apps/docs/docs/guides/oidc/auth0.md`                      | T2                       | Keep only provider-specific configuration and verification.                                                    |
| `apps/docs/docs/guides/oidc/keycloak.md`                   | T2                       | Keep only provider-specific configuration and verification.                                                    |
| `apps/docs/docs/guides/runners/external-runner.md`         | T7, T8                   | Teach managed-local and manually registered Direct runners; remove migration history.                          |
| `apps/docs/docs/guides/runners/embedded-runner.md`         | T14                      | Remove the authored task and redirect to the Direct-runner trust explanation.                                  |
| `apps/docs/docs/guides/multi-instance/add-instance.md`     | T9                       | Teach the visible add task without readiness-validation or removal claims.                                     |
| `apps/docs/docs/guides/multi-instance/switch-instances.md` | T9                       | Teach switching, active-instance clarity, and per-instance reauthentication.                                   |
| `apps/docs/docs/concepts/architecture.md`                  | T1, T4–T8                | Explain the backend, clients, frontend proxy, and runner placements without deployment history.                |
| `apps/docs/docs/concepts/build-execution.md`               | T7, T8, T14              | Explain separate Direct execution and the trusted-code boundary.                                               |
| `apps/docs/docs/concepts/artifact-access.md`               | T10–T13                  | Explain authorization, storage, expiry, download, and install boundaries.                                      |
| `apps/docs/docs/concepts/security-model.md`                | T1–T3, T7, T8            | Become the canonical Local Only, External Access, proxy, and Direct-execution trust explanation.               |
| `apps/docs/docs/concepts/multi-instance.md`                | T9                       | Retain user-visible isolation; remove browser-library implementation detail and unsupported removal.           |
| `apps/docs/docs/concepts/runner-protocol.md`               | T7, T8, T14              | Keep trust/lifecycle concepts and move operation detail to generated reference.                                |
| `apps/docs/docs/reference/cli/index.md`                    | T7, T8, T17              | Generate the current public command surface and remove the raw privileged install task.                        |
| `apps/docs/docs/reference/cli/oore-setup.md`               | T1–T3                    | Describe the mode-aware setup surface instead of one universal wizard.                                         |
| `apps/docs/docs/reference/cli/oore-recovery.md`            | T2, T3                   | Keep host-authorized recovery separate from ordinary External Access sign-in.                                  |
| `apps/docs/docs/reference/cli/oore-login.md`               | T1–T3                    | Keep loopback Local Only and External Access token-import boundaries exact.                                    |
| `apps/docs/docs/reference/config/daemon-config.md`         | T2–T6                    | Correct allowed-origin defaults and separate backend settings from operator infrastructure.                    |
| `apps/docs/docs/reference/config/environment-variables.md` | T2, T3, T6, T13          | Retain only verified public configuration and scope named adapters precisely.                                  |
| `apps/docs/docs/reference/config/installer.md`             | T1, T6–T8, T17           | Own supported roles and automation; keep raw privilege mechanics out.                                          |
| `apps/docs/docs/reference/api/auth.md`                     | T1–T3                    | Redirect to generated auth operations governed by the access rows.                                             |
| `apps/docs/docs/reference/api/artifacts.md`                | T10–T13                  | Redirect to generated artifact operations governed by storage and delivery rows.                               |
| `apps/docs/docs/reference/api/setup.md`                    | T1–T3                    | Redirect to generated setup operations; journey prose remains mode-specific.                                   |
| `apps/docs/docs/reference/api/settings.md`                 | T2–T6, T10, T11          | Redirect to generated network/storage settings with current schemas.                                           |
| `apps/docs/docs/reference/api/runners.md`                  | T7, T8, T14              | Redirect to generated runner operations and retain Direct-only vocabulary.                                     |
| `apps/docs/docs/operations/index.md`                       | T1–T17                   | Route public readers only to supported product tasks; remove private recipes.                                  |
| `apps/docs/docs/operations/deployment.md`                  | T1–T13, T15, T17         | Split into default and expansion shapes; use generic trust checks and no unsafe service recipe.                |
| `apps/docs/docs/operations/split-roles.md`                 | T3, T5, T6, T8, T13, T15 | Keep as an advanced supported task; remove the internal recipe link and named topology dependence.             |
| `apps/docs/docs/operations/mac-studio-netbird-warpgate.md` | T16                      | Remove from the public corpus with no public canonical page.                                                   |
| `apps/docs/docs/operations/monitoring.md`                  | T2–T6, T15               | Keep public health/metrics signals without prescribing Oore's infrastructure.                                  |
| `apps/docs/docs/operations/upgrade.md`                     | T1, T6–T8, T17           | Keep managed upgrade behavior; remove one-time topology migrations and raw service repair.                     |
| `apps/docs/docs/operations/troubleshooting.md`             | T1–T15, T17              | Organize by observable failure and generic boundary; remove unsafe and named canonical recipes.                |
| `apps/docs/docs/operations/release-channels.md`            | T15                      | Keep channel semantics; remove remote onboarding and named temporary-tunnel guidance.                          |
| `apps/docs/docs/operations/report-an-issue.md`             | T15                      | Remove the dependency on a named tunnel troubleshooting example.                                               |
| `apps/docs/docs/operations/release-automation-mac-mini.md` | T16                      | Remove from the public corpus; retain only separately governed public channel semantics.                       |

## Named-infrastructure disposition

Apply these distinctions consistently:

- A complete Oore-owned deployment or release-machine recipe is **Private**
  under T16, even if every component is publicly available.
- A third-party proxy, network, tunnel, load-balancer, hardware, or cloud-host
  recipe is **Illustrative** under T15. It cannot define the product contract.
- A named product adapter is supported only to the extent implemented by Oore:
  the Warpgate preset/ticket behavior belongs to T3/T13, S3 and R2 belong to
  T11, and OIDC provider pages belong to T2. None certifies the provider's
  surrounding infrastructure or availability.
- Generic guidance must state the required outcome and verification before any
  optional named example.

## Conservative public rules for product drift

The public contract is safe without a product change:

- Multi-instance documentation may teach add and switch, but not add-time
  readiness validation or removal until those behaviors exist.
- OIDC documentation must always supply the exact frontend callback URI until
  the optional fallback agrees with callback validation.
- Public installation and repair use the installer/updater boundary. The
  existence of a low-level root command is not permission to document it.
- The supported Direct-runner model does not inherit historical sandbox,
  embedded, or hybrid promises.

These gaps do not change a topology classification, so this decision does not
create a product follow-up issue. A future product change may widen the public
promise only after its code, tests, generated reference, and governed product
contract agree.

## Writer acceptance checklist

Before accepting a deployment, access, runner, multi-instance, or artifact
page:

- Its shape resolves to exactly one support row in the required-topology index.
- The default journey remains one Mac, Local Only, local repository, managed
  Direct runner, local storage, and **Quick Debug APK**.
- Every non-loopback user path is explicit External Access with OIDC or Trusted
  Proxy.
- Every client is described as a client; no UI is mistaken for a backend,
  runner, API proxy, credential store, or artifact store.
- Backend and Direct-runner macOS requirements are explicit without inventing a
  hardware or infrastructure requirement.
- The trust boundary names the actual browser, proxy, peer, header, proof,
  runner account, storage provider, or scoped artifact capability involved.
- Named infrastructure is illustrative unless it is a narrowly implemented
  product adapter, and internal Oore operations never enter public prose.
- No public page teaches a user-owned Oore executable through `sudo` or raw
  privileged service installation.
- The page ends with an observable verification step and keeps its separate
  ledger disposition and URL dependency.
