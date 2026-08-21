import * as z from 'zod'
import type { Build, BuildPlatform } from '@oore/client/models'

const buildPlatformSchema = z.enum(['android', 'ios', 'macos'])
const jsonObjectSchema = z.record(z.string(), z.json())
type JsonObject = z.infer<typeof jsonObjectSchema>

export const BUILD_PLATFORM_LABELS = {
  android: 'Android',
  ios: 'iOS',
  macos: 'macOS',
} satisfies Record<BuildPlatform, string>

function platformList(value: JsonObject[string]): Array<BuildPlatform> {
  if (!Array.isArray(value)) return []

  const platforms = value.flatMap((candidate) => {
    const platform = buildPlatformSchema.safeParse(candidate)
    return platform.success ? [platform.data] : []
  })
  return [...new Set(platforms)]
}

function nestedPlatforms(
  snapshot: JsonObject,
  key: string,
): Array<BuildPlatform> {
  const value = z.record(z.string(), z.json()).safeParse(snapshot[key])
  return value.success ? platformList(value.data.platforms) : []
}

export function getBuildPlatforms(build: Build): Array<BuildPlatform> {
  const parsedSnapshot = jsonObjectSchema.safeParse(build.config_snapshot)
  if (!parsedSnapshot.success) return []
  const snapshot = parsedSnapshot.data
  const selectedPlatforms = platformList(snapshot.selected_platforms)
  if (selectedPlatforms.length > 0) return selectedPlatforms

  const configuredPlatforms = nestedPlatforms(snapshot, 'ui_execution_config')
  if (configuredPlatforms.length > 0) return configuredPlatforms

  const legacyConfiguredPlatforms = nestedPlatforms(
    snapshot,
    'execution_config',
  )
  if (legacyConfiguredPlatforms.length > 0) return legacyConfiguredPlatforms

  return platformList(snapshot.platforms)
}
