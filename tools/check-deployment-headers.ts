type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface HeaderSmokeHosts {
  site: string
  docs: string
  web: string
  releases: string
}

export interface HeaderFailure {
  hostname: string
  path: string
  expected: string
  actual: string
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

const CSP_DIRECTIVES = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
]

function normalizeBaseUrl(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`)
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/$/, '')
}

export function resolveHeaderSmokeHosts(
  env: Record<string, string | undefined> = process.env,
): HeaderSmokeHosts {
  const domain = env.OORE_HEADER_SMOKE_BASE_DOMAIN ?? 'oore.build'
  return {
    site: normalizeBaseUrl(env.OORE_HEADER_SMOKE_SITE ?? domain),
    docs: normalizeBaseUrl(env.OORE_HEADER_SMOKE_DOCS ?? `docs.${domain}`),
    web: normalizeBaseUrl(env.OORE_HEADER_SMOKE_WEB ?? `ci.${domain}`),
    releases: normalizeBaseUrl(
      env.OORE_HEADER_SMOKE_RELEASES ?? `releases.${domain}`,
    ),
  }
}

function actualHeader(headers: Headers, name: string): string {
  return headers.get(name) ?? '<missing>'
}

function addFailure(
  failures: Array<HeaderFailure>,
  url: URL,
  expected: string,
  actual: string,
) {
  failures.push({
    hostname: url.hostname,
    path: url.pathname,
    expected,
    actual,
  })
}

function expectExactHeader(
  failures: Array<HeaderFailure>,
  url: URL,
  headers: Headers,
  name: string,
  expected: string,
) {
  const actual = actualHeader(headers, name)
  if (actual !== expected) {
    addFailure(failures, url, `${name}: ${expected}`, `${name}: ${actual}`)
  }
}

function expectSecurityHeaders(
  failures: Array<HeaderFailure>,
  url: URL,
  headers: Headers,
) {
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    expectExactHeader(failures, url, headers, name, expected)
  }
  const csp = actualHeader(headers, 'content-security-policy')
  for (const directive of CSP_DIRECTIVES) {
    if (
      !csp
        .split(';')
        .map((value) => value.trim())
        .includes(directive)
    ) {
      addFailure(
        failures,
        url,
        `content-security-policy contains ${directive}`,
        `content-security-policy: ${csp}`,
      )
    }
  }
}

function expectRevalidatedHtml(
  failures: Array<HeaderFailure>,
  url: URL,
  headers: Headers,
) {
  const actual = actualHeader(headers, 'cache-control')
  const directives = actual
    .toLowerCase()
    .split(',')
    .map((value) => value.trim())
  if (
    !directives.includes('max-age=0') ||
    !directives.includes('must-revalidate')
  ) {
    addFailure(
      failures,
      url,
      'cache-control contains max-age=0 and must-revalidate',
      `cache-control: ${actual}`,
    )
  }
}

function findHashedAsset(
  html: string,
  prefix: '/assets/' | '/_astro/',
): string | null {
  const escaped = prefix.replace('/', '\\/')
  const match = html.match(
    new RegExp(`(?:src|href)=["']([^"']*${escaped}[^"']+)["']`),
  )
  if (!match) return null
  return new URL(match[1], 'https://asset.invalid').pathname
}

async function fetchChecked(
  fetchImpl: FetchLike,
  failures: Array<HeaderFailure>,
  base: string,
  path: string,
): Promise<Response | null> {
  const url = new URL(path, `${base}/`)
  try {
    const response = await fetchImpl(url, { redirect: 'follow' })
    if (!response.ok) {
      addFailure(failures, url, 'HTTP 2xx response', `HTTP ${response.status}`)
      return null
    }
    return response
  } catch (error) {
    addFailure(
      failures,
      url,
      'reachable response',
      error instanceof Error ? error.message : String(error),
    )
    return null
  }
}

export async function runDeploymentHeaderSmoke(
  hosts: HeaderSmokeHosts,
  fetchImpl: FetchLike = fetch,
): Promise<Array<HeaderFailure>> {
  const failures: Array<HeaderFailure> = []
  for (const [kind, base] of [
    ['site', hosts.site],
    ['docs', hosts.docs],
    ['web', hosts.web],
  ] as const) {
    const response = await fetchChecked(fetchImpl, failures, base, '/')
    if (!response) continue
    const url = new URL('/', `${base}/`)
    expectRevalidatedHtml(failures, url, response.headers)
    expectSecurityHeaders(failures, url, response.headers)
    const html = await response.text()
    const prefix = kind === 'web' ? '/assets/' : '/_astro/'
    if (kind === 'site') continue
    const assetPath = findHashedAsset(html, prefix)
    if (!assetPath) {
      addFailure(
        failures,
        url,
        `HTML references a hashed ${prefix} resource`,
        'no matching resource',
      )
      continue
    }
    const asset = await fetchChecked(fetchImpl, failures, base, assetPath)
    if (asset) {
      expectExactHeader(
        failures,
        new URL(assetPath, `${base}/`),
        asset.headers,
        'cache-control',
        'public, max-age=31536000, immutable',
      )
    }
  }

  for (const path of ['/install', '/uninstall']) {
    const response = await fetchChecked(fetchImpl, failures, hosts.site, path)
    if (response) {
      expectExactHeader(
        failures,
        new URL(path, `${hosts.site}/`),
        response.headers,
        'cache-control',
        'no-store',
      )
    }
  }

  const releasePath = '/latest/stable.json'
  const release = await fetchChecked(
    fetchImpl,
    failures,
    hosts.releases,
    releasePath,
  )
  if (release) {
    expectExactHeader(
      failures,
      new URL(releasePath, `${hosts.releases}/`),
      release.headers,
      'cache-control',
      'public, max-age=60, s-maxage=300',
    )
  }
  return failures
}

if (import.meta.main) {
  const hosts = resolveHeaderSmokeHosts()
  const failures = await runDeploymentHeaderSmoke(hosts)
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(
        `[deployment-headers] ${failure.hostname}${failure.path}: expected ${failure.expected}; actual ${failure.actual}`,
      )
    }
    process.exitCode = 1
  } else {
    console.log('[deployment-headers] All deployment header checks passed.')
  }
}
