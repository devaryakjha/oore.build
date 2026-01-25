# Oore Landing Page

Marketing landing page for [oore.build](https://oore.build) - a self-hosted Flutter CI/CD platform.

## Development

```bash
# Install dependencies
bun install

# Start dev server (http://localhost:4321)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Deployment

This site is deployed on Cloudflare Pages.

### Build Settings

| Setting | Value |
|---------|-------|
| Framework preset | Astro |
| Build command | `bun run build` |
| Build output directory | `dist` |
| Root directory | `landing` |

### Custom Domain

The site is served at `oore.build`. DNS is managed through Cloudflare.

## OG Image

The `public/og-image.svg` is a template for the social sharing image. Convert it to PNG (1200x630) before deployment:

```bash
# Using ImageMagick
convert public/og-image.svg public/og-image.png

# Or use any SVG to PNG converter
```

## Project Structure

```
landing/
├── src/
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── Features.astro
│   │   ├── WhySelfHost.astro
│   │   ├── QuickStart.astro
│   │   ├── Status.astro
│   │   ├── Footer.astro
│   │   └── ui/
│   │       ├── Card.astro
│   │       └── Terminal.astro
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── favicon.ico
│   ├── og-image.png
│   ├── robots.txt
│   └── _headers
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## Tech Stack

- [Astro](https://astro.build/) - Static site generator
- [Tailwind CSS v4](https://tailwindcss.com/) - Utility-first CSS
- [Cloudflare Pages](https://pages.cloudflare.com/) - Hosting

## Adding to Cloudflare Pages

1. Go to Cloudflare Dashboard > Pages
2. Create a project > Connect to Git
3. Select the `oore` repository
4. Configure build settings (see table above)
5. Deploy

After initial deployment:
1. Go to Custom domains
2. Add `oore.build`
3. DNS will auto-configure since it's on Cloudflare
