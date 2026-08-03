import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const siteRoot = join(here, '..')
const page = readFileSync(join(siteRoot, 'src/pages/index.astro'), 'utf8')
const css = readFileSync(join(siteRoot, 'src/styles.css'), 'utf8')
const headers = readFileSync(join(siteRoot, 'public/_headers'), 'utf8')
const robots = readFileSync(join(siteRoot, 'public/robots.txt'), 'utf8')
const themeImage = readFileSync(
  join(siteRoot, 'src/components/theme-image.astro'),
  'utf8',
)
const imageDelivery = readFileSync(
  join(siteRoot, '../../shared/media/cloudflare-images.ts'),
  'utf8',
)
const normalizedPage = page.replace(/\s+/g, ' ')

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

test('publishes truthful agent discovery metadata', () => {
  assert.match(
    headers,
    /Link: <https:\/\/docs\.oore\.build\/>; rel="service-doc"/,
  )
  assert.match(robots, /Content-Signal: ai-train=no, search=yes, ai-input=yes/)
})
