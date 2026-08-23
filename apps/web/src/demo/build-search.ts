export const MAX_DEMO_BUILD_SEARCH_LENGTH = 200

export interface DemoBuildSearchRecord {
  branch?: string | null
  buildNumber: number
  commitSha?: string | null
  pipelineName?: string | null
  projectName?: string | null
}

function searchedBuildNumber(search: string): bigint | null {
  const value = search.startsWith('#') ? search.slice(1) : search
  if (!/^\d+$/.test(value)) return null

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export function matchesDemoBuildSearch(
  build: DemoBuildSearchRecord,
  rawSearch: string,
): boolean {
  const search = rawSearch.trim()
  if (!search) return true

  const normalizedSearch = search.toLowerCase()
  const textFields = [
    build.projectName,
    build.pipelineName,
    build.branch,
    build.commitSha,
  ]
  if (
    textFields.some((value) =>
      value?.toLowerCase().includes(normalizedSearch),
    )
  ) {
    return true
  }

  const buildNumber = searchedBuildNumber(search)
  return buildNumber !== null && buildNumber === BigInt(build.buildNumber)
}
