import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { parse } from 'yaml'

import { contentRoute, editorialPages } from './public-contract'

const appDir = path.resolve(import.meta.dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const docsDir = path.join(appDir, 'content/docs')
const reviewPath = path.join(appDir, 'editorial-review.json')
const acceptedInputRefs = {
  acceptance: 'f1402153',
  architecture: '2a0a887b',
  deployment: '04a00aa7',
  ledger: 'aa7d6986',
  tree: '3e6505b8',
  truth: 'd645878a',
  urls: '61706887',
  voice: '442d306c',
} as const

type ReviewPage = {
  findings: string[]
  fixes: string[]
  id: string
  note: string
  path: string
  result: 'pass'
  sha256: string
  source: string
  type: 'concept' | 'landing' | 'reference' | 'task' | 'tutorial'
}

type ReviewRecord = {
  acceptedInputs: Record<string, string>
  attestation: string
  pages: ReviewPage[]
  result: 'pass'
  reviewedCommit: string
  reviewerCoverage: string[]
  schema: 'oore-docs-editorial-review-v1'
  unresolvedFindings: string[]
}

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
}

function sha256(source: Buffer | string) {
  return crypto.createHash('sha256').update(source).digest('hex')
}

function sourceForRoute(route: string) {
  const matches = walk(docsDir).filter(
    (source) =>
      /\.(?:md|mdx)$/.test(source) &&
      contentRoute(path.relative(docsDir, source)) === route,
  )
  if (matches.length !== 1) {
    throw new Error(
      `Expected one authored source for ${route}, found ${matches.length}`,
    )
  }
  return matches[0]
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(fs.existsSync(reviewPath), 'Missing apps/docs/editorial-review.json')
const record = JSON.parse(
  fs.readFileSync(reviewPath, 'utf8'),
) as Partial<ReviewRecord>
assert(
  record.schema === 'oore-docs-editorial-review-v1',
  'Invalid review schema',
)
assert(record.result === 'pass', 'Editorial review is not passing')
assert(
  typeof record.reviewedCommit === 'string' &&
    /^[a-f0-9]{40}$/.test(record.reviewedCommit),
  'Editorial review must name one full repository commit',
)
assert(
  git('merge-base', '--is-ancestor', record.reviewedCommit, 'HEAD') === '',
  'Reviewed commit is not an ancestor of HEAD',
)

const acceptedInputs = Object.fromEntries(
  Object.entries(acceptedInputRefs).map(([name, ref]) => [
    name,
    git('rev-parse', `${ref}^{commit}`),
  ]),
)
assert(
  JSON.stringify(record.acceptedInputs) === JSON.stringify(acceptedInputs),
  'Editorial review accepted-input commits are stale',
)
assert(
  Array.isArray(record.reviewerCoverage) &&
    record.reviewerCoverage.length > 0 &&
    record.reviewerCoverage.every(
      (entry) => typeof entry === 'string' && entry.trim() !== '',
    ),
  'Editorial review must record reviewer coverage',
)
assert(
  typeof record.attestation === 'string' && record.attestation.length >= 80,
  'Editorial review attestation is missing',
)
assert(
  Array.isArray(record.unresolvedFindings) &&
    record.unresolvedFindings.length === 0,
  'Editorial review has unresolved findings',
)
assert(Array.isArray(record.pages), 'Editorial review pages are missing')

const expected = editorialPages(
  fs.readFileSync(
    path.join(repoDir, 'wayfinder/canonical-docs-tree.md'),
    'utf8',
  ),
)
const actualByPath = new Map<string, ReviewPage>()
for (const page of record.pages) {
  assert(
    !actualByPath.has(page.path),
    `Duplicate editorial review: ${page.path}`,
  )
  actualByPath.set(page.path, page)
}
assert(
  actualByPath.size === expected.length,
  `Editorial review covers ${actualByPath.size}/${expected.length} pages`,
)

for (const accepted of expected) {
  const review = actualByPath.get(accepted.path)
  assert(review, `Missing editorial review: ${accepted.path}`)
  assert(review.id === accepted.id, `${accepted.path} has the wrong review ID`)
  assert(
    review.type === accepted.type,
    `${accepted.path} has the wrong editorial type`,
  )
  assert(review.result === 'pass', `${accepted.path} did not pass review`)
  assert(
    typeof review.note === 'string' && review.note.trim().length >= 40,
    `${accepted.path} needs a page-specific review note`,
  )
  assert(
    Array.isArray(review.findings) &&
      review.findings.every((finding) => typeof finding === 'string'),
    `${accepted.path} has invalid findings`,
  )
  assert(
    Array.isArray(review.fixes) &&
      review.fixes.every((fix) => typeof fix === 'string'),
    `${accepted.path} has invalid fixes`,
  )
  assert(
    review.findings.length === review.fixes.length,
    `${accepted.path} must pair each finding with its applied fix`,
  )

  const source = sourceForRoute(accepted.path)
  const relative = path.relative(appDir, source).split(path.sep).join('/')
  assert(review.source === relative, `${accepted.path} source path is stale`)
  assert(
    review.sha256 === sha256(fs.readFileSync(source)),
    `${accepted.path} content digest is stale`,
  )

  const frontmatter = fs
    .readFileSync(source, 'utf8')
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
  assert(frontmatter, `${accepted.path} has no frontmatter`)
  const metadata = parse(frontmatter) as { title?: string }
  assert(
    metadata.title === accepted.title,
    `${accepted.path} reviewed title is stale`,
  )
}

const reviewedInputs = [
  'apps/docs/content/docs',
  'apps/docs/public/openapi.json',
  'apps/docs/src/lib/openapi-categories.ts',
  'wayfinder/canonical-docs-tree.md',
  'wayfinder/public-deployment-contract.md',
  'wayfinder/public-docs-page-ledger.md',
  'wayfinder/public-docs-truth-table.md',
  'wayfinder/public-docs-url-contract.md',
  'wayfinder/public-docs-voice-prototype.md',
]
const changed = git(
  'diff',
  '--name-only',
  `${record.reviewedCommit}..HEAD`,
  '--',
  ...reviewedInputs,
)
assert(
  changed === '',
  `Reviewed source changed after ${record.reviewedCommit}: ${changed}`,
)

console.log(
  JSON.stringify({
    acceptedInputs,
    pages: expected.length,
    result: 'PASS',
    reviewedCommit: record.reviewedCommit,
    schema: record.schema,
    unresolvedFindings: 0,
  }),
)
