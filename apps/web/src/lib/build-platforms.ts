import type { Build, BuildPlatform } from '@/lib/types'

const BUILD_PLATFORMS = new Set<BuildPlatform>(['android', 'ios', 'macos'])

export const BUILD_PLATFORM_LABELS: Record<BuildPlatform, string> = {
  android: 'Android',
  ios: 'iOS',
  macos: 'macOS',
}

function platformList(value: unknown): Array<BuildPlatform> {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value.filter(
        (platform): platform is BuildPlatform =>
          typeof platform === 'string' &&
          BUILD_PLATFORMS.has(platform as BuildPlatform),
      ),
    ),
  ]
}

function nestedPlatforms(
  snapshot: Record<string, unknown>,
  key: string,
): Array<BuildPlatform> {
  const value = snapshot[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  return platformList((value as Record<string, unknown>).platforms)
}

export function getBuildPlatforms(build: Build): Array<BuildPlatform> {
  const snapshot = build.config_snapshot
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
