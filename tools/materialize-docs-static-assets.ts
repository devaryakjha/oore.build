import { copyFile, lstat, unlink } from 'node:fs/promises'
import path from 'node:path'

const repositoryRoot = path.resolve(import.meta.dir, '..')
const sourceDir = path.join(repositoryRoot, 'apps/docs-site/public')
const outputDir = path.join(repositoryRoot, 'apps/docs-site/.output/public')

const sharedAssets = [
  'demo-builds-dark.png',
  'demo-builds.png',
  'demo-dashboard-dark.png',
  'demo-dashboard.png',
  'favicon.ico',
  'logo.svg',
  'logo192.png',
  'logo512.png',
  'og-image.png',
  'og-image.svg',
]

for (const asset of sharedAssets) {
  const source = path.join(sourceDir, asset)
  const output = path.join(outputDir, asset)

  if ((await lstat(output)).isSymbolicLink()) {
    await unlink(output)
  }

  await copyFile(source, output)
}

console.log(
  `Materialized ${sharedAssets.length} shared assets in apps/docs-site/.output/public`,
)
