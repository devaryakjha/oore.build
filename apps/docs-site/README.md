# Oore CI documentation

The public documentation is a Fumadocs site built as a static TanStack Start
SPA for Cloudflare Pages.

```bash
bun run dev
bun run test
bun run check
bun run build
bun run preview
```

Production output is written to `.output/public`. It contains the SPA shell,
the build-time Orama search index, and the Cloudflare Pages `_redirects`
fallback; it does not require a runtime server.

- Authored guides and reference: `docs/`
- Navigation and folder ordering: `docs/**/meta.json`
- Fumadocs source configuration: `source.config.ts`
- Application routes and layout: `src/`
- Shared shadcn registry configuration: `components.json`
- Generated API contract and other static assets: `public/`

Brand assets are linked from `shared/brand`, and product screenshots are linked
from `apps/site/public/product`. From the repository root, run
`bun run generate:og` to rebuild the shared 1200×630 SVG and PNG social artwork
from `tools/generate-og-images.tsx` with Satori and Resvg.
