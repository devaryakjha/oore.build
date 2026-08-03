import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type ArtifactManifestEntry = {
  bytes: number
  path: string
  sha256: string
  type: 'directory' | 'file'
}

function compareUtf8(left: string, right: string) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right))
}

function walk(root: string, directory = root): ArtifactManifestEntry[] {
  return fs.readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name)
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    const stat = fs.lstatSync(absolute)

    if (stat.isSymbolicLink()) {
      throw new Error(`Artifact contains a symbolic link: ${relative}`)
    }
    if (stat.isDirectory()) {
      return [
        {
          bytes: 0,
          path: relative,
          sha256: '0'.repeat(64),
          type: 'directory' as const,
        },
        ...walk(root, absolute),
      ]
    }
    if (!stat.isFile()) {
      throw new Error(`Artifact contains a special entry: ${relative}`)
    }

    const contents = fs.readFileSync(absolute)
    return [
      {
        bytes: contents.byteLength,
        path: relative,
        sha256: crypto.createHash('sha256').update(contents).digest('hex'),
        type: 'file' as const,
      },
    ]
  })
}

export function createArtifactManifest(root: string) {
  if (!fs.statSync(root).isDirectory()) {
    throw new Error(`Artifact root is not a directory: ${root}`)
  }
  const entries = walk(root).sort((left, right) =>
    compareUtf8(left.path, right.path),
  )
  const digest = crypto.createHash('sha256')
  digest.update(Buffer.from('oore-docs-dist-v1\0'))

  for (const entry of entries) {
    const pathBytes = Buffer.from(entry.path)
    const pathLength = Buffer.alloc(8)
    const fileLength = Buffer.alloc(8)
    pathLength.writeBigUInt64BE(BigInt(pathBytes.byteLength))
    fileLength.writeBigUInt64BE(BigInt(entry.bytes))

    digest.update(entry.type === 'directory' ? 'D' : 'F')
    digest.update(pathLength)
    digest.update(pathBytes)
    digest.update(fileLength)
    digest.update(
      entry.type === 'directory'
        ? Buffer.alloc(32)
        : Buffer.from(entry.sha256, 'hex'),
    )
  }

  return {
    digest: digest.digest('hex'),
    entries,
    schema: 'oore-docs-dist-v1',
  }
}

if (import.meta.main) {
  const appDir = path.resolve(import.meta.dirname, '..')
  process.stdout.write(
    `${JSON.stringify(
      createArtifactManifest(path.join(appDir, 'dist')),
      undefined,
      2,
    )}\n`,
  )
}
