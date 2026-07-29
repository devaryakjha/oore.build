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

The repository does not currently implement its documented
`make release-smoke` command. The release-acceptance migration will restore and
curate that command rather than silently defining new release semantics during
this expand step.

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
