# Contributing

Oore CI is in alpha. Contributions are welcome, but expect things to move fast and break.

## Getting Started

1. Fork and clone the repo
2. Install prerequisites: Rust (stable), Bun
3. Run `bun install` to set up JS dependencies
4. Run `make check` to verify everything compiles

## Development Workflow

- Create a branch from `master`
- Make your changes
- Run `make check` to lint and type-check
- Run `make test-web` and `make test-rust` for tests
- Open a PR against `master`

## Validation confidence tiers

Oore separates merge feedback from broader scheduled and release confidence.
The tier entry points currently wrap the existing full validation gate while
the test suite is being curated, so introducing them does not weaken required
checks:

- `make validate` remains the full pre-handoff command and current required
  validation gate.
- `make validate-pr` is the pull-request confidence entry point. During the
  migration it runs the same checks as `make validate`.
- `make validate-scheduled` is the entry point for broader scheduled
  confidence. During the migration it also runs the pull-request tier.
- `make validate-release` is the release-confidence entry point. During the
  migration it also runs the pull-request tier.

The tier aliases will be narrowed only after their surviving checks have been
classified. A green retry does not erase a flaky failure, and test count or
coverage percentage is not a validation goal.

## Release acceptance

`make release-smoke` is the stable local command for hermetic release
acceptance. The Release workflow runs the same command against the exact tag
before release builds or Pages deployments begin.

Hermetic acceptance is limited to behavior that can be proved without release
credentials or external services:

| Area                      | Hermetic evidence                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Release automation        | Alpha, beta, and stable triggers; exact-tag checkout; checksum, asset-upload, and release-index ordering contracts                               |
| Installer channels        | Stable, beta, and alpha manifest resolution with no network access                                                                               |
| Previous-version upgrade  | A representative `1.9.0` managed install hands a verified `2.1.0` staged release to the candidate updater without mutating the old install first |
| Rollback                  | Failed readiness, runner restart, and legacy service repair restore the prior release, data, runner marker, and service snapshot                 |
| Managed-service lifecycle | Boot-time daemon/runner service generation, ordering, handoff, health, and restart transaction tests                                             |
| Artifact delivery         | Local-storage upload/download bytes, scoped Android delivery, iOS manifest authorization, and the complete artifact API lifecycle                |

The command prints every live dependency as `NOT RUN`. It never treats a mock,
fixture, generated archive, browser assertion, simulator, or uncredentialed
runner as live proof.

Live acceptance is recorded separately for the release being reviewed:

| Live dependency           | Required evidence                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Credentialed macOS runner | The release ran on the intended macOS runner account with its real installed toolchains and release environment |
| Signing                   | A representative artifact was signed and verified with the intended release credentials                         |
| Source provider           | A real GitHub or GitLab repository event was received and its immutable revision was checked out                |
| Object storage            | A release artifact was uploaded to and downloaded from the configured S3-compatible service                     |
| Email                     | The configured provider delivered a real notification to the intended recipient                                 |
| External network          | The supported non-loopback or proxied path was reached from outside the host boundary                           |
| Assistive technology      | A reviewer used the relevant real assistive technology and recorded the observed result                         |
| Actual device             | A representative artifact was installed and opened on each affected physical platform                           |

A live item is `Passed` only when that environment and its credentials were
actually exercised. Otherwise record `Blocked`, `Not run`, or
`Not applicable — <reason>`. A hermetic pass remains valid evidence for the
hermetic matrix only.

## Manual UI acceptance

Automated checks establish only the behavior they assert. They do not establish
visual hierarchy, responsive composition, copy clarity, keyboard flow,
screen-reader experience, perceived polish, or successful installation on a
physical device. Record automated commands and CI results under **Testing** in
the pull request; record only human-observed results under **Manual UI
acceptance**.

### UI-changing pull requests

Complete the pull-request template's manual acceptance note for a user-facing UI
change. Keep it change-specific:

- Name only the roles and viewport classes actually reviewed.
- Name the changed interactions that were exercised.
- Summarize the qualitative behavior observed, including any relevant hierarchy,
  composition, copy, focus, and feedback.
- Link concise supporting evidence, such as screenshots or a recording, when it
  helps another reviewer understand the result.
- State material gaps as not reviewed. Do not convert a passing browser test,
  DOM assertion, or generated screenshot into a manual observation.

An exhaustive role, route, viewport, browser, and theme matrix is not required
for every pull request. Delete the section for a non-UI change; for a UI change,
select the contexts where the change and its likely regressions can genuinely be
observed.

### Release UI acceptance

For a release containing user-facing UI, the release reviewer records the
release identifier, date, reviewer, browser, viewport or device, role, and
observed outcome. Use `Observed`, `Blocked`, or `Not applicable — <reason>` for
each applicable item. Supporting screenshots and recordings are useful context,
but they do not replace the reviewer's observation.

Exercise the stable journey for every product role:

- **Owner:** Use the operator dashboard to understand current build and system
  state, open a representative project or build, and reach an owner-only
  administration action. Confirm that hierarchy, copy, and feedback make the
  next action clear.
- **Admin:** Complete a representative team or project administration task.
  Confirm that permitted settings are understandable and owner-only runtime
  controls are not presented as available.
- **Developer:** Open assigned work, inspect a representative build, and exercise
  an action allowed by the developer's project role. Confirm that restricted
  instance surfaces, including Sources and Runners, remain clearly read-only.
- **QA viewer:** Use the tester workspace to select an assigned app and release,
  understand its status and release information, and reach the appropriate
  install or download action. Confirm that operator controls stay absent and
  diagnostics remain secondary to release acceptance.

Review these cross-cutting qualities in the contexts where they can be observed:

- **Responsive composition:** Review every layout class where the critical
  journey changes composition, with at least one compact and one wide viewport.
  Check information priority, readable wrapping, local scrolling, overlays, and
  the absence of clipping or document-level overflow.
- **Keyboard and focus:** Complete the critical web journey without a pointer.
  Check logical focus order, visible focus, reachable controls, overlay focus
  containment, and focus restoration when an overlay closes.
- **Critical light and dark surfaces:** Review authentication, the relevant
  role landing surface, changed surfaces, and critical status, error, and
  destructive states in both themes. Check legibility and action, focus, and
  severity distinction rather than every route.
- **Assistive technology, where relevant:** Use the actual assistive technology
  for changed navigation, forms, dialogs, live status, or custom interactions.
  Check names, roles, states, announcements, landmarks, and reading order. Mark
  this not applicable with a reason when the release has no relevant interaction
  or semantic change.
- **Actual-device installation, where relevant:** When the release includes
  mobile artifacts or changes their delivery path, install and open a
  representative artifact on each affected physical platform. A mock, download
  response, DOM assertion, emulator, or simulator does not prove physical-device
  installation. Mark this not applicable with a reason when no install path is
  in scope.
- **Interaction quality:** Confirm that primary actions, loading and completion
  feedback, empty and error recovery, copy, and motion are understandable and
  do not obscure the task.

Record automated release validation separately from this checklist. A manual
observation does not replace deterministic validation, and automated validation
must not be reported as proof of subjective or live-device quality.

### Migration baseline

The before-state below was captured in
[the test-suite cost audit](https://github.com/oore-ci/oore.build/issues/158)
on 29 July 2026. These measurements support a later before/after comparison;
they are not quotas or coverage targets.

| Surface        | Before-state signal                                                             |
| -------------- | ------------------------------------------------------------------------------- |
| Frontend CI    | 4m 14s total; browser installation and execution used 200s (about 79%)          |
| Frontend tests | 232 Vitest cases; 78 Playwright entries scheduled, 26 active and 52 skipped     |
| Docs CI        | 39s total; tests used 1s and builds used 28s                                    |
| Rust CI        | 3m 38s total; workspace tests used 1m 38s, Clippy 32s, and a separate check 19s |
| Rust tests     | 266 tests active in the workspace gate; 222 daemon integration tests gated out  |

## Frontend checks

The frontend workspaces use the Oxc toolchain: Oxlint with type-aware rules on
TypeScript 7 and Oxfmt for formatting. Both are installed once at the monorepo
root. Use the root commands so nested workspace configuration is discovered:

```sh
bun run check
bun run format
bun run lint:fix
```

## What We're Looking For

- Bug fixes
- Test coverage improvements
- Documentation improvements
- Runner support for additional platforms

## Reporting Issues

Open an issue on GitHub. Include:

- What you expected vs what happened
- Steps to reproduce
- OS and toolchain versions (`rustc --version`, `bun --version`)

For help channels and non-bug paths, see [SUPPORT.md](SUPPORT.md).
Please also follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
