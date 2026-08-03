import fs from 'node:fs'
import path from 'node:path'

import { OPENAPI_CATEGORIES } from '../src/lib/openapi-categories'
import {
  acceptedOperationIds,
  authoredCanonicals,
  buildRedirectRules,
  readUrlContract,
  serializeRedirectRules,
} from './public-contract'

const appDir = path.resolve(import.meta.dirname, '..')
const repoDir = path.resolve(appDir, '../..')
const outputPath = path.join(appDir, 'public/_redirects')
const contract = readUrlContract(
  path.join(repoDir, 'wayfinder/public-docs-url-contract.md'),
)
const acceptedOperations = acceptedOperationIds(contract)
const canonicalPages = [
  ...authoredCanonicals(contract).map((row) => row.path),
  ...OPENAPI_CATEGORIES.map(
    (category) => `/reference/api/categories/${category.slug}`,
  ),
  ...[
    ...acceptedOperations.preserved,
    ...acceptedOperations.additions.map((row) => row.id),
  ].map((operationId) => `/openapi/operations/${operationId}`),
]
const output = serializeRedirectRules(
  buildRedirectRules({ canonicalPages, contract }),
)

if (process.argv.includes('--check')) {
  const current = fs.readFileSync(outputPath, 'utf8')
  if (current !== output) {
    console.error(
      'apps/docs/public/_redirects is stale; run make generate-docs-redirects',
    )
    process.exit(1)
  }
} else {
  fs.writeFileSync(outputPath, output)
}
