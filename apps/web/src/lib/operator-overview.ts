import type { Artifact, Build } from '@oore/client/models'

import { artifactInstallReadiness } from '@/lib/artifact-install'

const ACTIVE_BUILD_STATUSES = new Set<Build['status']>([
  'queued',
  'scheduled',
  'assigned',
  'running',
])

export interface InstallableBuildArtifact {
  artifact: Artifact
  build: Build
}

export interface InstallableBuild {
  artifacts: [Artifact, ...Array<Artifact>]
  build: Build
}

function newestBuildFirst(left: Build, right: Build): number {
  return (
    right.updated_at - left.updated_at || right.created_at - left.created_at
  )
}

export function selectOperatorBuildActivity(builds: Array<Build>) {
  const newest = [...builds].sort(newestBuildFirst)

  return {
    blocked: newest
      .filter(
        (build) =>
          ACTIVE_BUILD_STATUSES.has(build.status) &&
          build.runner_policy_block_reason,
      )
      .slice(0, 3),
    failures: newest
      .filter(
        (build) => build.status === 'failed' || build.status === 'timed_out',
      )
      .slice(0, 4),
    succeeded: newest.filter((build) => build.status === 'succeeded'),
  }
}

export function selectInstallableBuildArtifacts({
  artifacts,
  builds,
  now = Math.floor(Date.now() / 1000),
}: {
  artifacts: Array<Artifact>
  builds: Array<Build>
  now?: number
}): Array<InstallableBuildArtifact> {
  const buildsById = new Map(builds.map((build) => [build.id, build]))
  const selected = new Set<string>()

  return [...artifacts]
    .sort((left, right) => {
      const leftBuild = buildsById.get(left.build_id)
      const rightBuild = buildsById.get(right.build_id)
      return (
        (rightBuild?.created_at ?? 0) - (leftBuild?.created_at ?? 0) ||
        right.created_at - left.created_at
      )
    })
    .flatMap((artifact) => {
      const build = buildsById.get(artifact.build_id)
      if (
        !build ||
        build.status !== 'succeeded' ||
        artifact.state !== 'available' ||
        (artifact.artifact_type !== 'apk' &&
          artifact.artifact_type !== 'ipa') ||
        !artifactInstallReadiness(artifact).ready ||
        (artifact.expires_at != null && artifact.expires_at <= now)
      ) {
        return []
      }

      const key = `${build.project_id}:${artifact.artifact_type}`
      if (selected.has(key)) return []
      selected.add(key)
      return [{ artifact, build }]
    })
    .slice(0, 6)
}

export function groupInstallableBuildArtifacts(
  items: Array<InstallableBuildArtifact>,
): Array<InstallableBuild> {
  const builds = new Map<string, InstallableBuild>()

  for (const { artifact, build } of items) {
    const selected = builds.get(build.id)
    if (selected) {
      selected.artifacts.push(artifact)
    } else {
      builds.set(build.id, { artifacts: [artifact], build })
    }
  }

  return [...builds.values()]
}
