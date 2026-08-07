# Repository guidance

## Product boundaries

- Keep frontend and backend code separate.
- Use OIDC for non-loopback access.
- Allow passwordless local login only on loopback.
- Target macOS for the V1 backend runtime.
- Keep `ci.oore.build` as a UI-only hosted service.
- Keep `oored` for daemon lifecycle commands.
- Keep `oore` for setup, administration, and operator commands.

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
