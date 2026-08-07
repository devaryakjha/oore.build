# Oore CI documentation

The public documentation is an Astro 7 static site using Fumadocs through its
official Astro provider and React-island integration.

```bash
bun run dev
bun run check
bun run build
bun run preview
```

The build writes static output to `dist`. Cloudflare Pages serves this directory
without a runtime server or an SPA fallback.

Use `preview` to inspect the static build locally.

- Authored guides and reference: `content/docs/`
- Navigation and folder ordering: `content/docs/**/meta.json`
- Astro content collection and Fumadocs source: `src/content.config.ts` and
  `src/lib/source.ts`
- Static routes and Fumadocs island: `src/pages/` and `src/components/`
- Shared shadcn registry configuration: `components.json`
- Generated API contract and other static assets: `public/`

Brand assets and product screenshots are linked from `shared/brand` and
`shared/media/product`. Astro materializes those links as regular files in
`dist`.
