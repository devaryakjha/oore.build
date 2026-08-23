# Repository guidance

## Agent behavior

- Consult the Visualize skill before explanations. Create a visual only when it materially improves the explanation.
- Be concise, direct, and candid.
- Challenge weak assumptions. Distinguish verified facts from uncertainty.
- Ground research in authoritative, current sources. Link important evidence.
- Preserve the original goal and constraints.
- Finish authorized work end to end. Verify the actual result before claiming completion.
- Ask questions only when a decision is materially ambiguous, risky, or requires approval.
- Use relevant skills.
- Spawn subagents only for genuinely independent work. Synthesize their findings.
- Keep changes focused and simple.
- Avoid unrelated edits, unnecessary abstractions, and low-signal tests.
- Test observable behavior. Review substantial changes.
- Validate user-facing work in the real interface when applicable.
- Preserve unrelated work.
- Never take destructive, production, or external actions beyond the user's authorization.
- Report meaningful blockers, outcomes, and evidence without noisy progress.

## Product boundaries

- Keep frontend and backend code separate.
- Use OIDC for non-loopback access.
- Allow passwordless local login only on loopback.
- Target macOS for the V1 backend runtime.
- Keep `ci.oore.build` as a UI-only hosted service.
- Keep `oored` for daemon lifecycle commands.
- Keep `oore` for setup, administration, and operator commands.
- Center the operator experience on `Project → Build → Install/share`.
  Treat pipelines and runners as supporting infrastructure.

## Frontend

- Use Bun for frontend package and tool commands.
- Use TanStack Router file-based routing in `apps/web`.
- Use TanStack Query for server state.
- Use Zustand for shared client state.
- Use shadcn with Base UI primitives.
- Keep `apps/web/components.json` and `apps/docs/components.json` identical.
- Use Hugeicons for authored icons.
- Use the tokens from `apps/web/src/styles.css` for colors.
- Support light, dark, and system appearance.
- Read `DESIGN.md` before frontend interface work.
- Keep `apps/docs` as an Astro and Fumadocs static site.
- Keep `apps/site` as a static Vite site.
- Use `@oore/client` for API models, operations, TanStack Query factories, and
  base MSW handlers. Keep web-only client setup, demo mutation guards, error
  conversion, and instance query-key scoping in `apps/web/src/lib/api-client`.

## API contracts

- When an exported API changes, run `make gen-openapi` and
  `make check-openapi`.
- Update `oore-ci/oore-client-js` in a companion pull request generated from
  the exact checked-in `apps/docs/public/openapi.json` schema.

## Backend

- Keep `/v1/public/setup-status` free of sensitive data.
- Protect setup mutations with a token.
- Disable setup mutations after setup reaches `ready`.
- Keep the Local Only first-login setup exception.

## Releases

- Merge to `alpha` for `vX.Y.Z-alpha.N` releases.
- Merge to `beta` for `vX.Y.Z-beta.N` releases.
- Merge to `stable` for `vX.Y.Z` releases.
- Validate `master` without automatic tags.

## Maintenance

- Add a root Make target for each build, test, lint, or development command.
- Use conventional commit messages.
- Run `make validate` before handoff.
