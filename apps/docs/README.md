# Oore CI documentation

The public documentation is an Astro 7 static site using Fumadocs through its
official Astro provider and React-island integration.

```bash
bun run dev
bun run test
bun run check
bun run build
bun run preview
bun run preview:production
```

Production output is written to `dist`. It contains route-specific HTML, a real
`404.html`, the build-time Orama search index, the generated OpenAPI reference,
the sitemap and robots metadata, and the Cloudflare Pages redirects. It does not
require a runtime server or an SPA fallback.

`preview` uses Astro's standard preview command for local inspection.
`preview:production` serves the already-built `dist` directory through Wrangler's
local Pages model; the browser acceptance suite uses it to exercise Pages
redirect, header, and not-found behavior without rebuilding or deploying.

- Authored guides and reference: `content/docs/`
- Navigation and folder ordering: `content/docs/**/meta.json`
- Astro content collection and Fumadocs source: `src/content.config.ts` and
  `src/lib/source.ts`
- Static routes and Fumadocs island: `src/pages/` and `src/components/`
- Shared shadcn registry configuration: `components.json`
- Generated API contract and other static assets: `public/`

Brand assets and product screenshots are linked from `shared/brand` and
`shared/media/product`. Astro materializes those links as regular files in
`dist`. From the repository root, run
`bun run generate:og` to rebuild the shared 1200×630 SVG and PNG social artwork
from `tools/generate-og-images.tsx` with Satori and Resvg.
