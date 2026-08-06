# AGENTS.md

This file guides future coding sessions for `oore.build`.

## Agent skills

### Issue tracker

GitHub Issues is the canonical tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default Matt Pocock skill label vocabulary. See
`docs/agents/triage-labels.md`.

### Domain docs

Oore has one product domain whose private documentation follows the existing
repository governance. See `docs/agents/domain.md`.

## Read First (Mandatory)

Before making any code or architecture change, use the Obsidian MCP to read
`Oore Docs Index` from the `oore.build` vault.

Treat that index and its linked notes as the source of truth.

## Non-Negotiable Rules

- Keep frontend and backend cleanly separated.
- V1 auth is OIDC for any non-loopback access (Remote mode). Loopback-only local login is supported; when setup is incomplete it is only available in Local Only mode (no passwords).
- V1 backend runtime target is macOS.
- Hosted offering at `ci.oore.build` is UI-only.
- Keep command surfaces stable:
- `oored` for daemon/runtime lifecycle.
- `oore` for operator/setup/admin flows.

## Frontend Rules (V1)

- Use TanStack Router file-based routing in `apps/web`.
- Do not introduce Next.js for V1.
- Use Bun as package manager/runtime for frontend toolchain.
- Use TanStack Query for server state and Zustand for UI-local state in
  `apps/web`.
- Use shadcn with Base UI primitives (not Radix).
- Keep `apps/web` and `apps/docs` aligned with the checked-in shadcn registry configuration. The two `components.json` files must remain identical.
- `style: base-nova`
- `iconLibrary: hugeicons`
- `baseColor: neutral`
- `menuAccent: subtle`
- `menuColor: default-translucent`
- Amber is Oore's product primary. Inter is used for UI text and JetBrains Mono for machine data.
- Light, dark, and system appearance are supported. Component styles and color palettes are not runtime-selectable.
- Docs use the official Astro 7 + Fumadocs integration under `apps/docs`.
  Deploy only the static `apps/docs/dist` output; no docs runtime server or SPA
  fallback is permitted.
- The public site is a static Vite application under `apps/site` and should not carry the React/shadcn application scaffold.

## Frontend Design System (Mandatory)

- Read `DESIGN.md` before any frontend UI work.
- Follow the shadcn-first component selection rule: check registry -> install -> use.
- Never create custom dialogs, dropdowns, drawers, or tables when shadcn has equivalents.
- Use Hugeicons for all authored icons. No inline SVG icons.
- Use shadcn Form component with react-hook-form + zod for all forms.
- Use Skeleton/Spinner for loading states, Toast for transient feedback, Alert for persistent feedback.
- Static colors must use the light and dark token system from `apps/web/src/styles.css`. No hard-coded Tailwind color classes.
- Preserve the checked-in Nova component geometry, shadcn data slots, and neutral `cn-*` hooks in shared primitives.
- Sidebar emphasis aliases to the app primary. Oore-only success, warning, and info tokens keep their semantic meaning.
- Support dark mode using token-based styling only.
- Use sentence case. Prefer compact type, dividers, and whitespace over decorative card stacks or uppercase tracking.
- Use the shared `PageLayout`, `PageHeader`, collection controls, and Settings navigation contracts documented in `DESIGN.md`.
- Query-backed screens must distinguish initial loading, refresh, empty, filtered-empty, and error states; never present a failed request as an empty collection.
- Motion must be short and functional, respect reduced-motion preferences, and never become the primary source of hierarchy.

## Documentation and Governance Rules

- Internal technical docs and ADRs live in the private `oore.build` Obsidian vault.
- Every user-facing feature MUST add or update a feature note using `Feature Doc Template` in that vault.
- If code changes platform decisions or strict rules:
  - update `Platform Contract (V1)`
  - add or update the relevant feature note
  - add or update an ADR if changing a `MUST`-level rule
- GitHub Issues is the canonical tracker for bugs, features, roadmap work, and follow-ups.
- Do not commit private notes or add links or pointers to them elsewhere in the repository.

## Release Channels (Alpha/Beta/Stable)

Release automation is branch + tag driven via GitHub Actions:

- Merge to `alpha` -> cuts `vX.Y.Z-alpha.N` prerelease tags
- Merge to `beta` -> cuts `vX.Y.Z-beta.N` prerelease tags
- Merge to `stable` -> cuts `vX.Y.Z` production tags
- `master` is a playground branch (validated but not auto-tagged)

Before changing release automation, read `Release Channels (alpha / beta / stable) via GitHub Actions` in the private docs vault.

## Backend Bootstrap Direction

- Rust workspace crates:
- `crates/oored`
- `crates/oore`
- `crates/oore-bootstrap`
- `crates/oore-install`
- `crates/oore-contract`
- Keep `/v1/public/setup-status` non-sensitive.
- Setup mutating endpoints must be token-gated and disabled after `ready` (exception: Local Only mode may auto-complete setup on first loopback local login).

## Makefile Maintenance

- All build, test, lint, and dev commands must have a corresponding `make` target in the root `Makefile`.
- When adding new scripts or tooling, update the Makefile.
- `make validate` is the single command for the full pre-handoff checklist.

## v0.2.0 Test Freeze

- Do not add, change, generate, or run automated tests during v0.2.0 feature implementation.
- First complete each feature and let Arya check its UX and behavior manually.
- Add only necessary regression tests after the v0.2.0 behavior is accepted.
- Get Arya's explicit confirmation before any automated test work or test run.
- Use formatting, focused compilation, static analysis, and manual product checks during this freeze.
- Do not run `make validate` during this freeze because it runs automated tests.

## Validation Checklist (Before Handoff)

- During the v0.2.0 test freeze, run only the approved non-test checks.
- After Arya ends the freeze, run `make validate` before handoff.

## V1 Roadmap

- The implementation roadmap is `V1 Implementation Roadmap` in the private docs vault.
- Check off completed items and update gap summary after each phase.
- Track new work in GitHub Issues and add it to the appropriate roadmap phase or create a new phase.
- Roadmap does NOT override the Platform Contract — it sequences existing commitments.
