# Official Fumadocs-on-Astro 7 architecture

## Question

For the Astro, Fumadocs, React, MDX, search, and OpenAPI versions pinned by
Oore, what exact official Fumadocs-supported Astro architecture should
`apps/docs` use?

## Decision

Build `apps/docs` as an Astro 7.1.6 static site that follows Fumadocs' official
Astro integration literally:

- Astro content collections own Markdown and MDX ingestion.
- Astro file routes and `getStaticPaths()` own URL generation.
- Astro's default static output owns the deployable HTML and assets.
- One `client:load` React island renders Fumadocs' `RootProvider`,
  `DocsLayout`, `DocsPage`, search dialog, and interactive OpenAPI content.
- Fumadocs' Astro provider receives `Astro.url.pathname`, `Astro.params`, and
  Astro's `navigate` function.
- Fumadocs' loader owns the one canonical page tree.
- Fumadocs Orama static search is emitted through an Astro static endpoint.
- Fumadocs OpenAPI `staticSource()` contributes virtual pages to the same
  loader and therefore the same Astro route set and page tree.

This is the architecture in Fumadocs' version-matched
[Astro manual](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/apps/docs/content/docs/%28framework%29/manual-installation/astro.mdx)
and
[official Astro example](https://github.com/fuma-nama/fumadocs/tree/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro).
The signed npm provenance for `@fumadocs/base-ui@16.13.0`
[identifies that source revision](https://registry.npmjs.org/-/npm/v1/attestations/@fumadocs%2fbase-ui@16.13.0).

The migration must not preserve TanStack Start inside Astro, replace Fumadocs'
Astro provider with a custom bridge, or retain an SPA fallback. Those would
contradict the stated reason for the migration and the official integration.

## Version fit

Oore currently pins the relevant versions in the
[docs manifest](../apps/docs/package.json),
[site manifest](../apps/site/package.json), and [lockfile](../bun.lock):

| Surface | Oore version | Official compatibility finding |
| --- | --- | --- |
| Astro | `7.1.6` | Fumadocs 16.13's official example uses Astro `^7.1.3`. |
| `@astrojs/react` | `6.0.2` | The official example uses `^6.0.1`. |
| React / React DOM | `19.2.7` | Fumadocs core/UI 16.13 require React `^19.2.0`. |
| `fumadocs-core` | `16.13.0` | Exact match with the official Astro provider and example. |
| `fumadocs-ui` | alias to `@fumadocs/base-ui@16.13.0` | Exact match with the official Astro provider and example. |
| `fumadocs-mdx` | `15.2.0` | Not part of Fumadocs' official Astro architecture. |
| `fumadocs-openapi` | `11.2.2` | Supports virtual loader sources and client OpenAPI pages. |
| Orama | `^3.1.18` | Same major and range used by the official Astro example. |

The official Fumadocs example uses `@astrojs/mdx` and
`@astrojs/markdown-remark`, not `fumadocs-mdx`; see its
[package manifest](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/package.json)
and
[Astro configuration](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/astro.config.mjs).
Therefore `fumadocs-mdx`, `source.config.ts`, generated
`collections/server`/`collections/browser` modules, and the
`fumadocs-mdx/vite` plugin should leave `apps/docs`. Keeping them would create a
second content build system inside Astro.

The implementation should add the official example's Astro MDX dependencies
and use the documented Fumadocs remark/rehype plugins:
`remarkHeading`, `remarkCodeTab`, `remarkNpm`, `remarkStructure`, and
`rehypeCode`. Additional documented Fumadocs plugins should be added only when
the page ledger proves an authored-page requirement.

## Responsibility boundary

| Concern | Owner after migration |
| --- | --- |
| Markdown/MDX discovery and schema | Astro content collections |
| Static page and endpoint generation | Astro `src/pages` |
| Static build output | Astro `dist/` |
| React hydration | Astro `client:load` on the Fumadocs island |
| Framework route context | `fumadocs-ui/provider/astro` |
| Navigation, folders, breadcrumbs | One Fumadocs loader and its metadata files |
| Documentation UI | Fumadocs UI |
| Static search data and client | Fumadocs core + Orama |
| OpenAPI virtual pages and page-tree decoration | Fumadocs OpenAPI |
| Hosting | Existing Cloudflare Pages project, receiving `apps/docs/dist` |

Astro's official routing model makes files in `src/pages` into routes and
requires `getStaticPaths()` to enumerate dynamic routes in the default static
mode. Astro renders framework components to static HTML unless a `client:*`
directive hydrates them; `client:load` loads the island's JavaScript
immediately. See Astro's
[routing guide](https://docs.astro.build/en/guides/routing/) and
[framework-components guide](https://docs.astro.build/en/guides/framework-components/).

Fumadocs' exact Astro adapter is already public API in 16.13. It instructs the
caller to pass `Astro.url.pathname`, `Astro.params`, and optionally
`navigate` from `astro:transitions/client`; it falls back to normal browser
navigation when `navigate` is absent. See the exact
[core Astro provider](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/packages/core/src/framework/astro.tsx)
and
[Fumadocs UI wrapper](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/packages/base-ui/src/provider/astro.tsx).

## Target application shape

The implementation should converge on this shape:

```text
apps/docs/
├── astro.config.mjs
├── content/docs/
│   ├── meta.json
│   └── … authored Markdown, MDX, and nested metadata
├── public/
│   ├── _redirects
│   ├── openapi.json
│   └── … static brand and product assets
├── src/
│   ├── components/
│   │   ├── api-page.tsx
│   │   ├── docs.tsx
│   │   ├── layout.astro
│   │   └── search.tsx
│   ├── content.config.ts
│   ├── lib/
│   │   ├── openapi.ts
│   │   └── source.ts
│   ├── pages/
│   │   ├── [...slug].astro
│   │   ├── 404.astro
│   │   └── api/search.ts
│   └── styles/global.css
├── package.json
└── tsconfig.json
```

The exact file names may vary where Oore already has a clear local convention,
but the seams must not. In particular, `src/pages/[...slug].astro` is the route
owner and `src/components/docs.tsx` is the supported React island; there is no
React router beneath them.

## Content source and one page tree

Fumadocs' official Astro example defines two Astro collections:

- `docs`, loaded from `content/docs/**/*.{md,mdx}`
- `meta`, loaded from `content/docs/**/*.{json,yaml}`

It then translates those collection entries into a Fumadocs `StaticSource`
using each file's path relative to `content/docs`. That path is what lets
Fumadocs apply nested `meta.json` ordering and construct the page tree. See the
exact
[content collection](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/src/content.config.ts)
and
[source adapter](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/src/lib/source.ts).

Oore should compose that source with OpenAPI as two inputs to one loader:

```ts
loader(
  {
    docs: await createAstroDocsSource(),
    openapi: await openapi.staticSource({
      baseDir: 'openapi/operations',
    }),
  },
  {
    baseUrl: '/',
    plugins: [openapi.loaderPlugin()],
  },
)
```

The current public operation route is
`/openapi/operations/<operationId>`, so that is the safe default. The page
ledger may place generated API material visibly under Reference without
silently breaking the existing URL contract; if it chooses a new canonical
path, every old operation URL needs a generated and verified 301. The source
composition mechanism does not change.

A single root `meta.json` and nested folder metadata then define navigation. No
separately authored navbar, folder-root list, or route manifest should restate
that hierarchy.

## Page generation and rendering

The catch-all Astro page should use `source.getPages()` in
`getStaticPaths()`. Each source page becomes one build-time route. The route
looks the page up by slug and then branches on `page.type`:

- For an authored page, call Astro's `render()` on the stored collection entry,
  derive its table of contents from the rendered headings, and pass the
  resulting `Content` through Fumadocs' default MDX components.
- For an OpenAPI virtual page, render the title, description, table of contents,
  and `<OpenAPIPage {...page.data.getOpenAPIPageProps()} />`.

The authored-page half is Fumadocs' exact
[Astro route](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/src/pages/%5B...slug%5D.astro).
The OpenAPI half is the framework-neutral virtual-page renderer documented in
the exact
[OpenAPI 11.2.2 integration guide](https://github.com/fuma-nama/fumadocs/blob/d2ee483b05fb4fc5111ccb63a039bee07cce6ba1/apps/docs/content/docs/%28framework%29/integrations/openapi/index.mdx).

The Fumadocs island should match the official
[`docs.tsx`](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/src/components/docs.tsx):

- `RootProvider` comes from `fumadocs-ui/provider/astro`.
- `DocsLayout` receives `source.getPageTree()`.
- `DocsPage` receives page-specific table-of-contents/full-width props.
- `pathname`, `params`, and `navigate` come from Astro.
- The `.astro` route renders the island with `client:load`.

The official example also uses Astro's `ClientRouter` and passes its `navigate`
function to Fumadocs. Oore should use that documented pairing rather than
recreating client navigation. Hydrating smaller independently coordinated
pieces, or hydrating a custom router shell around Fumadocs, would be an
unsupported architecture experiment.

`createOpenAPIPage()` is explicitly a client component. Its page-type branch
must therefore live inside the hydrated React island (for example as an
`OpenAPIDocs` export from the same island module), not only inside an
Astro-rendered static child slot. Authored Astro `Content` can remain the
server-rendered child used by the official example.

## Static search

Keep Orama search fully static:

1. `src/pages/api/search.ts` is an Astro `APIRoute`.
2. `createFromSource(source, …)` builds the index at build time.
3. Its `GET` handler returns `server.staticGET()`.
4. The Fumadocs search dialog uses `oramaStaticClient()`, whose default source
   is `/api/search`.

That is the exact
[Fumadocs Astro search endpoint](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/examples/astro/src/pages/api/search.ts)
and
[static client](https://github.com/fuma-nama/fumadocs/blob/b939cc7c3a57694984bf8288b88586170a55f114/packages/core/src/search/client/orama-static.ts)
for version 16.13. The name at this pinned version is
`oramaStaticClient`, not a newer renamed API.

The official Astro example computes authored-page structured data from the
Astro collection entry. OpenAPI 11.2.2 virtual pages already expose
`structuredData`; see its exact
[`OpenAPIPageData`](https://github.com/fuma-nama/fumadocs/blob/d2ee483b05fb4fc5111ccb63a039bee07cce6ba1/packages/openapi/src/server/index.tsx).
Therefore Oore's `buildIndex` must branch by source type: use
`structure(page.data._raw.body)` for authored pages and
`page.data.structuredData` for OpenAPI pages. This is the only composition
needed to include both kinds of page in one exported index.

No search runtime, Pages Function, or server adapter is required.

## Generated OpenAPI pages

Keep the current virtual-page strategy; it is the supported Fumadocs OpenAPI
path:

- `createOpenAPI({ input: ['./public/openapi.json'] })` remains server/build
  code only.
- `openapi.staticSource()` generates virtual Fumadocs page records from the
  schema.
- `openapi.loaderPlugin()` adds method and deprecation treatments to the page
  tree.
- `createOpenAPIPage()` supplies the interactive client component.
- `source.getPages()` automatically contributes every generated operation to
  Astro's `getStaticPaths()`.

The exact OpenAPI guide describes `staticSource()` as generating pages directly
into the loader, without writing real files. The
[official source example](https://github.com/fuma-nama/fumadocs/blob/d2ee483b05fb4fc5111ccb63a039bee07cce6ba1/examples/openapi/lib/source.ts)
uses the same composition.

Consequently, remove the handwritten OpenAPI-operation route enumerator from
the current Vite configuration. Do not switch to generated MDX files and do not
add an OpenAPI proxy route to this static site. A proxy would be runtime
functionality and is neither necessary for documentation rendering nor part of
Oore's current static hosting contract.

## Cloudflare Pages contract

The hosting product and release metadata stay the same; only the artifact path
changes:

- Keep the `oore-docs` Pages project.
- Keep the existing alpha/beta/stable Pages branch mapping, commit metadata,
  serialized deploys, and retry behavior.
- Change the deploy input from `apps/docs/.output/public` to
  `apps/docs/dist`.
- Deploy with the existing `wrangler pages deploy <directory>` direct-upload
  flow.
- Do not add an Astro Cloudflare adapter or Pages Functions: the site is
  statically generated.

Those retained deployment semantics are visible in Oore's
[Makefile](../Makefile) and
[release workflow](../.github/workflows/release.yml).
Astro's default output directory is `dist`, and `public/` assets are copied into
the build unchanged; see Astro's
[project structure](https://docs.astro.build/en/basics/project-structure/).
This means `_redirects`, `openapi.json`, `robots.txt`, and public images should
flow through Astro's normal asset pipeline. The docs-only
`tools/materialize-docs-static-assets.ts` post-build copy should disappear; its
behavior must instead be proven by the built-asset checks.

Keep the real 301 move rules in `public/_redirects`. Cloudflare recommends
placing `_redirects` in a framework's public/static directory, and follows a
matching redirect even when an asset exists; see the
[Pages redirects contract](https://developers.cloudflare.com/pages/configuration/redirects/).
Do not add a `/* / 200` proxy.

Add `src/pages/404.astro`, which Astro builds to a top-level `404.html`.
Without that file, Cloudflare Pages assumes the deployment is an SPA and routes
unmatched URLs to `/`; with it, Pages serves normal not-found behavior. See
Astro's
[custom 404 contract](https://docs.astro.build/en/basics/astro-pages/#custom-404-error-page)
and Cloudflare's
[serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## Surfaces that disappear

The following are migration deletions, not layers to preserve:

- `@tanstack/react-router`
- `@tanstack/react-router-devtools`
- `@tanstack/react-start`
- `@tanstack/start-static-server-functions`
- TanStack route files, generated route tree, router factory, loaders, and
  server functions
- Nitro and `nitro/vite`
- direct `vite` and `@vitejs/plugin-react` application ownership
- the custom authored/OpenAPI prerender-page enumerator
- SPA flags and SPA fallback assumptions
- `serve --single` preview behavior
- `fumadocs-mdx`, `source.config.ts`, and generated collection client/server
  loaders
- `.output/public` as an artifact contract
- the docs-only static-asset materialization script

The replacement is not an equivalent custom abstraction. It is Astro's
standard `astro dev`, `astro build`, and `astro preview`, plus Fumadocs'
published Astro adapter.

## Approaches to reject

- Astro hosting the old TanStack Start application as a single island.
- A custom route-context provider instead of `fumadocs-ui/provider/astro`.
- A React SPA catch-all or Cloudflare `200` rewrite.
- Manual discovery of Markdown paths or OpenAPI operation IDs outside the
  Fumadocs source loader.
- A second hard-coded navigation model beside the Fumadocs page tree.
- `fumadocs-mdx/vite` alongside Astro content collections.
- Emitting OpenAPI MDX files when the existing virtual source is supported.
- Adding a server adapter, search server, OpenAPI proxy, or Pages Function to a
  static documentation site.
- Splitting Fumadocs into independently hydrated islands without an upstream
  example requiring it.

## Behavior-focused acceptance

The migration is equivalent only when these observable contracts pass:

| Contract | Proof |
| --- | --- |
| Static artifact | `astro build` produces `apps/docs/dist` with HTML, assets, `/api/search`, `openapi.json`, `_redirects`, and `404.html`; no runtime server artifact is needed. |
| Authored routes | Every retained authored page in the disposition ledger has a generated URL and correct title/body on a fresh direct request. |
| OpenAPI routes | Every operation ID in `public/openapi.json` resolves at its generated Reference URL and renders method, path, description, and interactive request schema without a client error. |
| One hierarchy | Sidebar, breadcrumbs, previous/next links, and mobile navigation all reflect the same nested Fumadocs page tree. |
| Static search | `/api/search` returns the exported index; a browser query finds at least one authored guide and one generated OpenAPI operation and navigates to each result. |
| Deep links | A fresh request to a nested guide and a generated OpenAPI page returns its page, not the root shell. |
| Not found | A nonexistent URL returns the built 404 page and does not render the docs home page. |
| Redirects | Each retained legacy redirect returns its declared 301 and destination; no wildcard 200 rewrite exists. |
| Public assets | Favicons, social image, screenshots, fonts, `robots.txt`, and `openapi.json` are real readable files in the deployed artifact. |
| Interaction | Search keyboard shortcut, sidebar controls, theme behavior, copy buttons, tabs, and client navigation work after hydration and after more than one navigation. |
| Metadata | Canonical URL, title, description, Open Graph, and Twitter metadata remain correct on direct page loads. |
| Production hosting | A Pages preview deployed from `apps/docs/dist` passes the same deep-link, 404, redirect, search, asset, and OpenAPI checks without Functions. |

These checks should extend the existing documentation publishing integrity suite
around user-visible behavior. They should not assert arbitrary test counts,
generated-file spelling, or the internal shape of Astro's output.

## Resolution

Use Fumadocs' official Astro React-island integration exactly, then compose its
documented Astro content source with its documented OpenAPI virtual source.
Astro replaces TanStack Start, Nitro, the SPA, manual prerender discovery, and
the `.output/public` artifact. Fumadocs remains responsible for the docs UI,
page tree, static search, and generated OpenAPI pages. Cloudflare Pages remains
a direct-upload static host for `apps/docs/dist`, with explicit `404.html`
rather than SPA fallback behavior.
