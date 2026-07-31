# Public documentation voice prototype

Status: prototype resolution for
[#206](https://github.com/oore-ci/oore.build/issues/206), at baseline
`66e56785394960f280b7c37244ed72b1dccca4bc`.

This artifact tests Oore's approved public voice against five real documentation
surfaces. It is an editorial standard and review prototype, not a final page
tree, URL contract, corpus rewrite, or deployment decision.

The primary reader is the technical owner or operator of a Flutter team with a
Mac. The default journey starts in Local Only on one Mac and ends with a
successful debug APK.

## Editorial decision

The approved voice works across landing, tutorial, task, concept, and reference
content when the page type controls the structure.

Oore public documentation uses calm, direct operator English:

- Address the reader as **you**.
- Use active voice and sentence case.
- Give each page one user job.
- Put the default path before alternatives.
- Copy exact UI labels, commands, fields, states, and output.
- End task guidance with a result the reader can observe.
- Troubleshoot the named task, not the whole product.
- Move optional detail behind links or later sections.
- Give the reader one useful next step.
- Exclude Oore's internal implementation, lifecycle, framework, and
  infrastructure language unless an exact public reference value requires it.

Short does not mean vague. A page can omit implementation detail only after it
states the user-visible boundary precisely.

## Page types and templates

Every authored page must declare one type. A page that needs two templates needs
to become two pages.

### Landing template

User job: choose the right next page.

1. One sentence that says who Oore is for and what outcome it produces.
2. One default-path section with a single primary action.
3. A small set of expansion paths grouped by user outcome.
4. One short boundary note only when it changes the reader's choice.

A landing page routes. It does not teach a workflow, reproduce the navigation
tree, or summarize every feature.

### Tutorial template

User job: learn by completing one first success.

```yaml
---
title: <Outcome in imperative form>
description: <What the reader will finish>
status: implemented | preview | placeholder
---
```

1. State the completed outcome in the opening paragraph.
2. Add **What you need** with only the prerequisites needed now.
3. Use numbered, verb-led steps along the default path.
4. Show expected output or visible state at the point it matters.
5. Add **Verify the result** with one end-to-end success check.
6. Add **Troubleshooting** with the two or three likely blockers for this
   tutorial.
7. End with **Next step** and one natural expansion journey.

Do not add API alternatives, full state tables, or advanced configuration to a
first-success tutorial.

### Task template

User job: complete one known operation.

```yaml
---
title: <Imperative task>
description: <Result and scope>
status: implemented | preview | placeholder
---
```

1. State what changes and what remains unchanged.
2. Add **What you need**, including role, machine, and scope boundaries.
3. Use numbered steps with one action per step.
4. Put a warning immediately before a destructive or security-sensitive action.
5. Add **Verify the result** with an observable product state or command output.
6. Add symptom-led **Troubleshooting** for this task only.
7. End with one useful **Next step**.

Separate create, restore, repair, migrate, and diagnose operations when each has
its own preconditions or failure modes.

### Concept template

User job: understand why Oore behaves a certain way.

```yaml
---
title: <How or why question in sentence case>
description: <The model the reader will understand>
status: implemented | preview | placeholder
---
```

1. Answer the question in the first paragraph.
2. Explain one mental model in user-visible terms.
3. State the boundaries and consequences of that model.
4. Use a small example only when it makes the model clearer.
5. Link to one task and one reference entry for action and exact values.

A concept page does not contain setup steps, repair commands, API inventories,
store fields, schema dumps, or source-code tours.

### Reference template

User job: look up an exact fact.

```yaml
---
title: <Exact command, field, state, or endpoint>
description: <What this entry defines>
status: implemented | preview | placeholder
---
```

1. Start with the exact identifier or synopsis.
2. List accepted inputs, types, required values, and defaults.
3. Show deterministic success output or response shape.
4. State exit behavior, errors, and preconditions that are part of the contract.
5. Include one minimal valid example.
6. Link to the task or concept that supplies context.

CLI, API, config, state, role, and error reference must be generated from or
checked against executable sources. Do not call a hand-maintained list
exhaustive unless a mechanical check proves it.

## Terminology

| Use in public prose                 | Use only for exact literals or narrow context              | Do not use as the public product term |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| **Oore**                            | **Oore CI** when reproducing a branded title               | informal product renames              |
| **Local Only**                      | `runtime_mode: "local"` in payloads or logs                | local mode                            |
| **External Access**                 | `runtime_mode: "remote"` in payloads or logs               | Remote mode                           |
| **External Access (OIDC)**          | `remote_auth_mode: "oidc"`                                 | Remote OIDC                           |
| **External Access (Trusted Proxy)** | `remote_auth_mode: "trusted_proxy"`                        | Remote Trusted Proxy                  |
| **Sources**                         | integration, repository, and installation in API reference | integrations as the top-level UI area |
| **Direct macOS runner**             | external runner in an exact legacy value                   | embedded or hybrid runner             |
| **`oore`**                          | setup, operator, and administration flows                  | daemon lifecycle commands             |
| **`oored`**                         | daemon and runtime lifecycle                               | operator and setup flows              |

Additional rules:

- Reproduce UI labels in bold: **New project**, **Quick Debug APK**,
  **Run build**.
- Put commands, paths, fields, enum values, and machine states in code:
  `oore pipeline validate`, `.oore.yaml`, `succeeded`.
- Say “loopback” when it is the security boundary. “On the same Mac” is not an
  exact substitute.
- Distinguish instance roles from project roles. Do not shorten both to “role”
  when the distinction affects access.
- Use an exact error code only for the operation that proves it. Do not replace
  `permission_denied`, `insufficient_role`, or privacy-preserving `not_found`
  with a generic “forbidden”.

## Headings and callouts

### Headings

- Use sentence case.
- Make tutorial and task titles outcomes: “Build your first debug APK”, not
  “First build”.
- Make concept titles questions or models: “How Oore chooses pipeline
  configuration”, not “Configuration internals”.
- Make reference titles exact identifiers: “`oore pipeline validate`”.
- Use **What you need**, **Verify the result**, **Troubleshooting**, and
  **Next step** consistently.
- Use numbered H2 step headings only when order matters.
- Do not skip heading levels or use headings as visual decoration.

### Callouts

- Use a **Note** for optional context that does not block the task.
- Use **Important** for a scope boundary or prerequisite that can invalidate the
  result.
- Use **Warning** immediately before a destructive, security-sensitive, or
  irreversible action.
- Use a placeholder banner only for planned behavior that is not implemented.
- Give every callout a sentence-case title and a concrete reader action.
- Do not put routine instructions, success messages, or whole sections in
  callouts.

Good:

> **Important — Default data layout only**
>
> This backup task covers Oore's default managed data location. If you
> configured both a custom database path and a custom encryption-key path, do
> not use the manual backup example.

Bad:

> **Note**
>
> Backup behavior may vary. Check your setup.

The first version identifies the exact unsupported scope. The second transfers
the ambiguity to the reader.

## Code and output

- Use `bash` fences for shell input, `yaml` for configuration, `json` for exact
  payloads, and `text` for terminal output.
- Do not include a shell prompt. It prevents clean copy and paste.
- Put one command in a block unless the commands must run as one transaction.
- Use `<angle-bracket-placeholders>` and define each placeholder immediately
  below the block.
- Keep real commands complete. Do not imply that every `oore` command accepts
  `--daemon-url`.
- Never place real credentials, tokens, private hosts, or user-specific paths in
  examples.
- Show output only when it gives the reader a recognition point. Preserve exact
  capitalization and punctuation; use a labeled placeholder for variable data.
- Validate every `.oore.yaml` example with `oore pipeline validate`.
- Verify CLI syntax against current public `--help`.
- Verify HTTP examples against runtime handlers and a fresh OpenAPI export. If
  generated OpenAPI disagrees with runtime, block the reference entry instead
  of hand-writing a replacement contract.

Example:

```bash
oore pipeline validate .oore.yaml
```

```text
.oore.yaml is valid
```

## Verification, troubleshooting, and next steps

### Verification

Verification answers “How do I know this worked?” with something the reader can
observe:

- a UI state such as `succeeded`
- an exact toast such as `Pipeline created`
- a file under **Artifacts**
- a command that exits successfully and prints a known line

Avoid “You are done” or “The service should work” without a recognition point.

### Troubleshooting

Use the pattern:

1. Observable symptom.
2. Most likely cause within this task.
3. One corrective action.
4. A diagnostic or reference link only if the action is not enough.

Troubleshooting does not repeat the whole task, list every product error, or ask
the reader to inspect Oore source code.

### Next step

Name the next job, not the next section:

- Good: “Move this working pipeline into `.oore.yaml`.”
- Bad: “Read more.”
- Bad: a list of every related page.

## Writing around unresolved product details

The six open truth-table conflicts are product decisions, not editorial choices.
Writers state the proven boundary and stop before the unresolved promise.

| Unresolved detail                                                | Precise public wording available now                                                                                                                                                      | Claim to withhold                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Whether OIDC `redirect_uri` is required                          | “Copy the callback URI shown by Oore. Supply it explicitly and keep the `/auth/callback` suffix.”                                                                                         | Omitting `redirect_uri` is supported                                                       |
| When decrypted signing material may be released                  | “Repository child processes do not receive signing files, passwords, or Oore signing capability tokens. The Direct macOS runner performs signing after repository build commands finish.” | Signing material is fetched only after every repository-controlled stage                   |
| Whether iOS signing may change the runner user's keychain domain | “Keep the runner account signed in while an iOS build runs. Oore uses a temporary job keychain and attempts cleanup after the job.”                                                       | Oore never changes the default keychain or keychain search list                            |
| Safe low-level system-service installation                       | “Use the Oore installer to install or repair managed services.”                                                                                                                           | `sudo oored install-service --system` is a supported public recipe                         |
| Custom database and key pairing in manual backup                 | “This task covers the default managed data location. A custom database plus custom key path is outside this task.”                                                                        | `--state-file` automatically selects its matching custom encryption key                    |
| Supported External Access deployment topology                    | “This guide covers one Mac in Local Only.”                                                                                                                                                | A reverse proxy, split host, tunnel, or hosted-client topology is recommended or supported |

Do not hide these gaps behind “depending on your setup”. Either narrow the page
to proven behavior, mark the relevant material as preview, or hold the page
until the owning product decision closes.

## Prototype 1: docs landing section

The prototype headings are nested inside this review artifact. A shipped page
would promote its title to H1. Link destinations are intentionally omitted
because the tree and URL tickets own them.

### Build your first Flutter app with Oore

Run Oore on one Mac, sign in with Local Only, and produce a debug APK from a
local Git repository. The default install includes the daemon, operator CLI,
local web client, and a managed Direct macOS runner.

#### Start on one Mac

Your first Local Only sign-in creates the local owner without a password. Then
create a project from a repository on that Mac and use **Quick Debug APK** for
the shortest path to a working build.

**Primary action:** Build your first debug APK

#### After your first build

- Sign and distribute a build.
- Connect GitHub or GitLab under **Sources**.
- Add your team and configure External Access.
- Back up, update, and troubleshoot Oore.
- Understand pipeline, runner, signing, and artifact behavior.
- Look up commands, configuration, states, roles, and API operations.

> **Note — Hosted UI**
>
> `ci.oore.build` is an optional browser client for a backend that is already
> reachable over HTTPS. It does not host an Oore instance and is not part of the
> one-Mac Local Only path.

## Prototype 2: tutorial — build your first debug APK

Status: `implemented`

### Build your first debug APK

Create a Local Only project from a Flutter repository on your Mac, run the
**Quick Debug APK** pipeline, and download the resulting APK.

#### What you need

- Oore installed with the default complete install on one Mac.
- A Flutter project that is already a local Git repository.
- An Android SDK available to the Direct macOS runner account.
- No `.oore.yaml` or `.oore.yml` in the repository for this template-first
  tutorial.
- One runner shown as online under **Settings > Runners**.

#### 1. Sign in locally

Open `http://127.0.0.1:4173`.

On **Sign in**, leave **Email (optional)** empty or enter the owner email, then
select **Sign in locally**. On a fresh instance, this first loopback sign-in
initializes the Local Only owner automatically.

#### 2. Create the project

1. Open **Projects**.
2. Select **New project**.
3. Enter a **Name**.
4. In **Path**, enter the absolute path to the local Git repository.
5. Add **Default branch (optional)** only when Oore should not use the
   repository default.
6. Select **Create project**.

> **Important — Repository trust**
>
> Creating or relinking a project trusts that repository's commands to run with
> the Direct macOS runner account's permissions. Use a repository you would run
> on this Mac yourself.

#### 3. Choose the debug pipeline

1. Open the new project.
2. Under **Pipelines**, select **Set up a build**.
3. Under **Choose a starting point**, select **Quick Debug APK**.
4. Select **Create**.

The template runs `flutter build apk --debug`, does not require signing, and
collects `build/app/outputs/flutter-apk/*.apk`.

#### 4. Run the build

1. Select **Run build**.
2. Keep the `Debug APK` pipeline and the intended branch selected.
3. Select **Run build** in the dialog.

Open the build to follow its progress.

#### Verify the result

The build ends in `succeeded`. Under **Artifacts**, find the `.apk` and select
**Download**.

You have completed the tutorial when the downloaded file is a non-empty `.apk`.
You can then install it on an Android test device.

#### Troubleshooting

**The build stays queued with a paused-runner message**

Open **Settings > Runners** and turn on **Allow approved repositories**. This
allows new claims; it does not create a second repository approval step.

**Oore found a repository workflow instead of the starter templates**

The repository already contains a selected Oore workflow. Validate it with
`oore pipeline validate`, or use a repository without an Oore workflow for this
tutorial. Oore does not silently replace an invalid selected file with UI
configuration.

**The project form rejects the path**

Use an absolute path to a Git repository on the backend Mac. Folder browsing is
available only from localhost.

#### Next step

Move the working debug pipeline into `.oore.yaml` so the build definition changes
with the repository.

## Prototype 3: task — create and verify a backup

Status: `implemented`

### Create and verify a backup

Create an owner-readable archive of Oore's default managed state, then verify
its manifest, checksums, encryption-key length, and SQLite integrity before you
store it.

Creating the backup can run while `oored` is live. This task does not restore or
restart services.

#### What you need

- Shell access on the Mac that runs `oored`.
- The default managed Oore data location.
- A mounted, encrypted destination outside the Oore data directory.

> **Important — Default data layout only**
>
> This task covers Oore's default managed database and encryption-key location.
> If you configured both a custom database path and a custom encryption-key
> path, do not add `--state-file` to this example. The manual command does not
> yet bind that custom database to its exact key path.

#### 1. Create the archive

Choose a destination that is not inside Oore's data directory:

```bash
oore backup create --output /Volumes/Backups/oore-backup.tar.gz
```

Expected output:

```text
Created backup: /Volumes/Backups/oore-backup.tar.gz
```

The archive contains a consistent SQLite snapshot, the encryption key, and a
checksum manifest. Treat it as a secret because it contains the key needed to
decrypt stored credentials.

#### 2. Verify the archive

```bash
oore backup verify --input /Volumes/Backups/oore-backup.tar.gz
```

Expected output:

```text
Backup verified: /Volumes/Backups/oore-backup.tar.gz (created <Unix timestamp>)
```

`<Unix timestamp>` is the variable creation time recorded in the manifest.

#### Verify the result

Keep the archive only after `oore backup verify` exits successfully and prints
`Backup verified`.

Copy the verified archive to encrypted storage off the daemon host. Back up
artifact payloads separately: this archive does not include local artifact
files or objects stored in S3 or R2.

#### Troubleshooting

**Create cannot read the database or encryption key**

Do not guess a `--state-file` value. Confirm that this is a default managed
installation. A custom database plus custom key path is outside this task.

**Verify reports a manifest, checksum, key-length, or SQLite error**

Do not use the archive for recovery. Create a new archive from the source
instance and verify it again before copying it off-host.

#### Next step

Rehearse a stopped-daemon restore on a non-production copy before you rely on
the archive for recovery.

## Prototype 4: concept — how Oore chooses pipeline configuration

Status: `implemented`

### How Oore chooses pipeline configuration

Oore gives a checked-in workflow priority so the build definition can travel
with the commit. UI configuration remains a supported starting point when the
repository does not select a workflow file.

#### The selection model

For each build, the Direct macOS runner reads configuration from the pinned
repository checkout:

1. If the pipeline has an explicit config path, Oore checks only that path.
2. Without an explicit path, Oore checks `.oore.yaml`, then `.oore.yml`.
3. Oore uses the pipeline configuration saved in the UI only when the selected
   repository file does not exist.

The selected file wins when it exists. If it is invalid, the build fails
instead of silently using different UI settings.

#### Why the file wins

A repository workflow is reviewed and versioned with the code it builds. A
build pinned to an older commit reads the workflow from that same checkout, so a
later edit does not rewrite the older build's instructions.

The UI path stays useful for a first build and for teams that do not want a
repository workflow yet. It is an alternative source when the selected file is
absent, not a recovery path for an invalid file.

#### Flutter version is a separate choice

A checked-in `.fvmrc` overrides the Flutter version saved in repository YAML or
the UI. This lets a repository keep its Flutter toolchain choice beside the
application.

#### What this means for you

- Changing UI commands does not override an existing selected repository file.
- A typo or unknown field in that file fails visibly.
- Validating the file before pushing prevents a configuration failure on the
  runner.
- You can start with **Quick Debug APK** in the UI and move to `.oore.yaml`
  after the first successful build.

#### Next step

Use the `oore pipeline validate` reference entry to check a repository workflow
with the same schema Oore uses for builds.

## Prototype 5: reference — `oore pipeline validate`

Status: `implemented`

### `oore pipeline validate`

Validate repository pipeline YAML with the runner's current schema.

#### Synopsis

```text
oore pipeline validate [PATH]
```

#### Arguments

| Argument | Required | Default      | Description                                    |
| -------- | -------- | ------------ | ---------------------------------------------- |
| `PATH`   | No       | `.oore.yaml` | Repository pipeline file to read and validate. |

The command reads the file locally. It does not accept `--daemon-url`.

#### Success

The command exits `0` and prints the path followed by `is valid`.

```bash
oore pipeline validate .oore.yaml
```

```text
.oore.yaml is valid
```

An explicit path is preserved in the output:

```bash
oore pipeline validate ci/mobile.oore.yaml
```

```text
ci/mobile.oore.yaml is valid
```

#### Failure

The command exits non-zero when it cannot read the file or when the file does
not match the current schema. The error identifies the read or validation
failure; the command does not modify the file and does not fall back to UI
configuration.

#### Related task

Read “How Oore chooses pipeline configuration” before deciding whether a
repository workflow or UI configuration should own a pipeline.

## Current-corpus comparison

| Prototype                          | Current corresponding page or pages                                                                       | Confusion removed                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs landing                       | `apps/docs/docs/index.mdx`; `apps/docs/docs/getting-started/index.md`                                     | Gives the landing one routing job; makes one Mac, Local Only, and a debug APK the default; stops treating hosted UI, External Access, and source integrations as prerequisites; keeps generated API under the Reference outcome instead of presenting a competing documentation root.                                                                |
| First debug APK tutorial           | `apps/docs/docs/getting-started/first-build.md`; `apps/docs/docs/guides/projects/pipeline-ui-fallback.md` | Removes the GitHub/GitLab prerequisite, hand-written release YAML, webhook/API branches, incomplete state table, SSE detail, and roadmap language; replaces **Accept new builds**, **Settings > Preferences**, **Trigger Build**, and **Start Build** with current UI labels; uses the verified **Quick Debug APK** template and a local repository. |
| Backup task                        | `apps/docs/docs/operations/backup-restore.md`                                                             | Splits create-and-verify from restore; adds recognizable success output; stops promising that `--state-file` selects a matching custom key; removes topology-specific service restart steps and the inaccurate atomic-pair claim; states that artifact payloads are excluded.                                                                        |
| Pipeline configuration concept     | `apps/docs/docs/concepts/file-first-config.md`                                                            | Replaces daemon snapshot fields and trigger/API internals with the user-visible precedence model; adds explicit-path and `.oore.yml` precedence; states that invalid selected files fail and that the runner reads the pinned checkout; keeps task steps and the full schema elsewhere.                                                              |
| `oore pipeline validate` reference | `apps/docs/docs/reference/cli/index.md`; `apps/docs/docs/guides/projects/pipeline-config.md`              | Replaces a one-line mention with exact synopsis, default, deterministic output, and failure behavior; avoids the false claim that every command accepts `--daemon-url`; keeps motivation and schema detail outside the command entry.                                                                                                                |

## Anti-patterns to remove from the corpus

- A first-success page that requires GitHub, GitLab, signing, hosted UI, or
  External Access before a local debug build.
- Stale UI labels such as **Accept new builds**, **Settings > Preferences**,
  **Trigger Build**, or **Start Build**.
- “Remote OIDC” and “Remote Trusted Proxy” in public prose.
- A tutorial that branches into UI, YAML, webhook, and API paths before the
  reader has one success.
- A task that mixes create, restore, migration, repair, and diagnosis.
- A concept page that lists endpoint paths, state-store fields, snapshot
  internals, framework names, service-repair commands, or protocol values.
- A reference page that claims complete CLI, error, role, or OpenAPI coverage
  without a mechanical source check.
- Hand-written YAML that has not passed `oore pipeline validate`.
- `sudo oored install-service --system` as public installation guidance.
- Custom backup examples that assume a matching encryption key.
- Signing promises that cross the release-timing or iOS-keychain blockers.
- Deployment recipes that pre-empt the supported-topology decision.
- Oore's own infrastructure, release automation, secrets, lifecycle phases, or
  one-time migration history in user documentation.
- “See the source code for details”, bare URLs, dead links, and instructions to
  upload an external credential without explaining how to obtain it.
- A failed request described as an empty state, or a successful operation with
  no observable verification.

## Prototype acceptance check

| Requirement                               | Landing                                 | Tutorial                                              | Task                                            | Concept                                   | Reference                                                    |
| ----------------------------------------- | --------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| One user job                              | Choose the next journey                 | Produce a first debug APK                             | Create and verify one backup                    | Understand config selection               | Look up one command                                          |
| Default path first                        | One Mac and Local Only                  | Local repository and template                         | Default managed data layout                     | Repository file, then UI when absent      | Default `.oore.yaml` path                                    |
| Exact labels or commands where applicable | **Quick Debug APK**, **Sources**        | Current project, pipeline, build, and artifact labels | Exact create/verify commands and output         | Exact file names and precedence           | Exact synopsis, argument, default, output, and exit behavior |
| Observable verification                   | Primary action promises the outcome     | `succeeded` plus downloaded APK                       | `Backup verified`                               | Observable invalid-file failure explained | Exit `0` plus `<path> is valid`                              |
| Focused troubleshooting                   | Not applicable to a routing section     | Paused runner, selected workflow, invalid path        | Missing state/key and failed verification       | Not applicable to explanation             | Failure contract, not task diagnosis                         |
| Progressive disclosure                    | Expansion journeys follow first success | Signing, sources, YAML, API, and states deferred      | Restore and custom layouts deferred             | Task and schema deferred                  | Motivation and schema deferred                               |
| Useful next step                          | Build the first debug APK               | Move the working pipeline into YAML                   | Rehearse restore safely                         | Validate the workflow                     | Read the selection concept                                   |
| Blocker-safe                              | No topology recommendation              | No signing or External Access promise                 | Custom database/key pairing explicitly excluded | No blocked product claim                  | No blocker dependency                                        |

## Evidence boundary

The product facts in these prototypes were reconciled against the public source
and the source-backed resolution of
[#198](https://github.com/oore-ci/oore.build/issues/198), including local commit
`ca90c65a6fefbd5cf1df460a083da46d52167fcf`. Page comparisons use the complete
ledger resolved in
[#199](https://github.com/oore-ci/oore.build/issues/199). Public/private and
source-verification constraints follow the sanitized resolution of
[#200](https://github.com/oore-ci/oore.build/issues/200).

This prototype intentionally does not decide page hierarchy, canonical URLs,
architecture migration details, deployment support, or the final rewrite
batches.
