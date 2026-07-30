import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const siteRoot = join(here, '..')
const page = readFileSync(join(siteRoot, 'src/pages/index.astro'), 'utf8')
const css = readFileSync(join(siteRoot, 'src/styles.css'), 'utf8')
const config = readFileSync(join(siteRoot, 'astro.config.ts'), 'utf8')
const themeImage = readFileSync(
  join(siteRoot, 'src/components/theme-image.astro'),
  'utf8',
)
const screenshotFrame = readFileSync(
  join(siteRoot, 'src/components/product-screenshot-frame.astro'),
  'utf8',
)
const imageDelivery = readFileSync(
  join(siteRoot, '../../shared/media/cloudflare-images.ts'),
  'utf8',
)
const components = readFileSync(join(siteRoot, 'components.json'), 'utf8')
const webComponents = readFileSync(
  join(siteRoot, '../web/components.json'),
  'utf8',
)
const normalizedPage = page.replace(/\s+/g, ' ')

test('uses Astro static output and build-time React components', () => {
  assert.match(config, /output:\s*['"]static['"]/)
  assert.match(config, /integrations:\s*\[react\(\)\]/)
  assert.doesNotMatch(page, /client:(?:load|idle|visible|media|only)/)
  assert.match(page, /from ['"]@\/components\/ui\/button['"]/)
  assert.match(page, /from ['"]@\/components\/ui\/card['"]/)
})

test('inherits the web app styling contract', () => {
  assert.equal(components, webComponents)
  assert.match(css, /@import ['"]\.\.\/\.\.\/web\/src\/styles\.css['"]/)
  assert.doesNotMatch(css, /#[\da-f]{3,8}/i)
  assert.doesNotMatch(css, /gradient\(/)
  assert.doesNotMatch(css, /text-transform:\s*uppercase/)
})

test('keeps local product and brand assets intact', () => {
  const references = [
    ...page.matchAll(
      /(?:href|src|lightSrc|darkSrc)=["'](\/(?:product\/[^"'?#]+|logo\.svg))["']/g,
    ),
  ].map((match) => match[1])

  assert.ok(references.length >= 4)
  for (const reference of references) {
    assert.ok(
      existsSync(join(siteRoot, 'public', reference.slice(1))),
      `missing local asset ${reference}`,
    )
  }
})

test('serves high-quality product captures through Cloudflare', () => {
  assert.match(
    imageDelivery,
    /\/cdn-cgi\/image\/width=\$\{width\},quality=90,format=auto/,
  )
  assert.match(imageDelivery, /\[720, 1200, 1440\]/)
  assert.match(page, /dashboardLight = '\/product\/demo-dashboard\.png'/)
  assert.match(page, /dashboardDark = '\/product\/demo-dashboard-dark\.png'/)
  assert.match(page, /lightSrc="\/product\/demo-builds\.png"/)
  assert.match(page, /darkSrc="\/product\/demo-builds-dark\.png"/)
  assert.match(themeImage, /data-light-src=\{lightSrc\}/)
  assert.match(themeImage, /data-dark-src=\{darkSrc\}/)
  assert.match(page, /document\.querySelectorAll\('\[data-theme-image\]'\)/)
  assert.match(page, /document\.addEventListener\(\s*['"]error['"]/)
  assert.match(page, /currentSrc\.includes\(['"]\/cdn-cgi\/image\/['"]\)/)
  assert.doesNotMatch(page, /demo-(?:dashboard|builds)-(?:720|1200)\.webp/)
})

test('uses one browser frame for every landing-page product screenshot', () => {
  assert.equal((page.match(/<ProductScreenshotFrame\b/g) ?? []).length, 2)
  assert.match(screenshotFrame, /product-shot/)
  assert.match(screenshotFrame, /terminal-dots/)
  assert.match(screenshotFrame, /<Badge variant="success"/)
  assert.doesNotMatch(page, /Live demo data/)
  assert.doesNotMatch(page, /Queue, history, and outcomes/)
})

test('keeps the header and hero outline actions visible in light mode', () => {
  assert.equal((page.match(/site-outline-action/g) ?? []).length, 2)
  assert.match(css, /:root:not\(\.dark\) \.site-outline-action/)
  assert.match(css, /background:\s*var\(--muted\)/)
})

test('uses the current Direct runner product contract', () => {
  assert.match(normalizedPage, /Register the managed Direct runner/)
  assert.match(
    normalizedPage,
    /Creating a project or changing its source authorizes that repository's commands/,
  )
  assert.match(normalizedPage, /does not present it as a hostile-code sandbox/)
  assert.match(normalizedPage, /External-fork events do not queue builds/)

  assert.doesNotMatch(page, /approve each repository/)
  assert.doesNotMatch(page, /oored run/)
  assert.doesNotMatch(page, /oore setup token/)
})

test('keeps the page semantic, responsive, and accessible', () => {
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1)
  assert.match(page, /<main id="main">/)
  assert.match(page, /href="#main"/)
  assert.match(page, /aria-controls="site-nav"/)
  assert.match(page, /<ol /)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(page, /event\.key === ['"]Escape['"]/)
  assert.match(page, /aria-expanded/)
})

test('keeps route and social metadata canonical', () => {
  assert.match(page, /rel="canonical" href="https:\/\/oore\.build\/"/)
  assert.match(page, /property="og:url" content="https:\/\/oore\.build\/"/)
  assert.match(page, /name="twitter:card" content="summary_large_image"/)
  assert.match(page, /'@type': 'SoftwareApplication'/)
})
