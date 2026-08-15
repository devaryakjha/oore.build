import * as z from 'zod'
import type { Artifact, Build, JsonObject } from '@/lib/types'
import { getIosAppMetadata } from '@/lib/artifact-install'

const jsonObjectSchema = z.record(z.string(), z.json())

export function changelogSummary(markdown: string): string {
  const firstLine = markdown
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return (firstLine ?? '')
    .replace(/^[-*+]\s+/, '')
    .replace(/[*_`#>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function metadataObject(value: JsonObject, key: string): JsonObject | null {
  const candidate = jsonObjectSchema.safeParse(value[key])
  return candidate.success ? candidate.data : null
}

function metadataString(
  value: JsonObject,
  ...keys: Array<string>
): string | null {
  for (const key of keys) {
    const stringCandidate = z.string().safeParse(value[key])
    if (stringCandidate.success && stringCandidate.data.trim())
      return stringCandidate.data.trim()
    const numberCandidate = z.number().safeParse(value[key])
    if (numberCandidate.success) return String(numberCandidate.data)
  }
  return null
}

function artifactVersion(
  artifact: Artifact,
): { name: string; number: string } | null {
  const ios = getIosAppMetadata(artifact)
  if (ios) return { name: ios.version, number: ios.buildNumber }

  const android = metadataObject(artifact.metadata, 'android_app')
  if (!android) return null
  const name = metadataString(android, 'version_name', 'version')
  const number = metadataString(android, 'version_code', 'build_number')
  return name && number ? { name, number } : null
}

export function qaProjectVersionBase(
  artifacts: Array<Artifact>,
): string | null {
  return (
    [...artifacts]
      .sort((left, right) => right.created_at - left.created_at)
      .map(artifactVersion)
      .find((version) => version !== null)?.name ?? null
  )
}

export function qaBuildVersion(
  build: Build,
  artifacts: Array<Artifact>,
  fallbackVersion: string | null,
): string {
  const exact = artifacts
    .map(artifactVersion)
    .find((version) => version !== null)
  return exact
    ? `${exact.name}+${exact.number}`
    : fallbackVersion
      ? `${fallbackVersion}+${build.build_number}`
      : `Build ${build.build_number}`
}
