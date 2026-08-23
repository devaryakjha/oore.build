import type { Artifact, Build, BuildStatus } from '@oore/client/models'

import { artifactInstallReadiness } from '@/lib/artifact-install'

export const PROJECT_TAB_VALUES = [
  'overview',
  'builds',
  'pipelines',
  'settings',
] as const

export type ProjectTab = (typeof PROJECT_TAB_VALUES)[number]

const ACTIVE_BUILD_STATUSES = new Set<BuildStatus>([
  'queued',
  'scheduled',
  'assigned',
  'running',
])

export type ProjectHealthTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

export type ProjectHealthAction =
  | 'build'
  | 'pipelines'
  | 'runner-settings'
  | 'source-settings'

export interface ProjectHealth {
  action?: ProjectHealthAction
  detail: string
  label: string
  title: string
  tone: ProjectHealthTone
}

export function resolveProjectTab(value: string | undefined): ProjectTab {
  return (
    PROJECT_TAB_VALUES.find((candidate) => candidate === value) ?? 'overview'
  )
}

function buildTimestamp(build: Build): number {
  return build.queued_at || build.created_at
}

export function newestProjectBuild(builds: Array<Build>): Build | undefined {
  return [...builds].sort((left, right) => {
    const numberDifference = right.build_number - left.build_number
    return numberDifference || buildTimestamp(right) - buildTimestamp(left)
  })[0]
}

export function selectProjectActivity(
  builds: Array<Build>,
  limit = 5,
): Array<Build> {
  const newestFirst = [...builds].sort((left, right) => {
    const timeDifference = buildTimestamp(right) - buildTimestamp(left)
    return timeDifference || right.build_number - left.build_number
  })
  const active = newestFirst.filter((build) =>
    ACTIVE_BUILD_STATUSES.has(build.status),
  )
  const terminal = newestFirst.filter(
    (build) => !ACTIVE_BUILD_STATUSES.has(build.status),
  )

  return [...active, ...terminal].slice(0, limit)
}

export function deriveProjectHealth({
  buildQueryFailed,
  hasSourceLink,
  latestBuild,
  pipelineCount,
  runnerPaused,
  runnerStatusFailed,
  sourceAvailable,
}: {
  buildQueryFailed: boolean
  hasSourceLink: boolean
  latestBuild?: Build
  pipelineCount: number
  runnerPaused: boolean
  runnerStatusFailed: boolean
  sourceAvailable: boolean
}): ProjectHealth {
  if (!hasSourceLink) {
    return {
      action: 'source-settings',
      detail: 'Choose a source repository before this project can run a build.',
      label: 'Setup needed',
      title: 'No source repository',
      tone: 'danger',
    }
  }

  if (!sourceAvailable) {
    return {
      action: 'source-settings',
      detail:
        'Oore cannot find the linked repository. Builds remain queued until the source link is repaired.',
      label: 'Blocked',
      title: 'Source repository unavailable',
      tone: 'danger',
    }
  }

  if (pipelineCount === 0) {
    return {
      action: 'pipelines',
      detail:
        'The source is connected. Create or import a pipeline before running a build.',
      label: 'Setup needed',
      title: 'No pipeline configured',
      tone: 'warning',
    }
  }

  if (latestBuild?.runner_policy_block_reason === 'repository_unavailable') {
    return {
      action: 'source-settings',
      detail:
        'The queued build cannot use its source snapshot. Repair the project source before it can start.',
      label: 'Blocked',
      title: `Build #${latestBuild.build_number} is waiting for its source`,
      tone: 'danger',
    }
  }

  if (
    runnerPaused ||
    latestBuild?.runner_policy_block_reason === 'instance_paused'
  ) {
    return {
      action: 'runner-settings',
      detail:
        'Builds can be queued, but the direct macOS runner must be resumed before they can start.',
      label: 'Blocked',
      title: 'Direct macOS runner is paused',
      tone: 'warning',
    }
  }

  if (buildQueryFailed) {
    return {
      detail:
        'Oore could not load build status. Retry before acting on project health.',
      label: 'Unknown',
      title: 'Build health unavailable',
      tone: 'neutral',
    }
  }

  if (latestBuild?.status === 'failed' || latestBuild?.status === 'timed_out') {
    return {
      action: 'build',
      detail:
        latestBuild.status === 'timed_out'
          ? 'The latest build timed out. Open it to inspect the last completed step and logs.'
          : 'The latest build failed. Open it to inspect the failed step and logs.',
      label: 'Needs attention',
      title: `Build #${latestBuild.build_number} ${latestBuild.status === 'timed_out' ? 'timed out' : 'failed'}`,
      tone: 'danger',
    }
  }

  if (latestBuild && ACTIVE_BUILD_STATUSES.has(latestBuild.status)) {
    const isRunning = latestBuild.status === 'running'
    return {
      action: 'build',
      detail: isRunning
        ? 'The latest build is running. Open it to follow the live log.'
        : 'The latest build is waiting to start. Open it for its queue and runner state.',
      label: isRunning ? 'Building' : 'Waiting',
      title: `Build #${latestBuild.build_number} is ${isRunning ? 'running' : 'queued'}`,
      tone: 'info',
    }
  }

  if (runnerStatusFailed) {
    return {
      detail:
        'The last build is available, but Oore could not verify the direct runner setting.',
      label: 'Unknown',
      title: 'Runner status unavailable',
      tone: 'neutral',
    }
  }

  if (!latestBuild) {
    return {
      action: 'pipelines',
      detail:
        'The project has a source and pipeline. Run the first build from the project header.',
      label: 'Ready to run',
      title: 'No build history yet',
      tone: 'info',
    }
  }

  if (latestBuild.status === 'succeeded') {
    return {
      action: 'build',
      detail: 'The latest build succeeded and no current blocker is reported.',
      label: 'Healthy',
      title: `Build #${latestBuild.build_number} succeeded`,
      tone: 'success',
    }
  }

  return {
    action: 'build',
    detail: 'No build is active. Open the latest build for its final status.',
    label: 'Idle',
    title: `Build #${latestBuild.build_number} is ${latestBuild.status}`,
    tone: 'neutral',
  }
}

export function selectInstallableProjectArtifacts(
  artifacts: Array<Artifact>,
  now = Math.floor(Date.now() / 1000),
): Array<Artifact> {
  const newestFirst = [...artifacts].sort(
    (left, right) => right.created_at - left.created_at,
  )
  const selectedPlatforms = new Set<Artifact['artifact_type']>()

  return newestFirst.filter((artifact) => {
    if (selectedPlatforms.has(artifact.artifact_type)) return false
    if (artifact.state !== 'available') return false
    if (artifact.expires_at != null && artifact.expires_at <= now) return false
    if (!artifactInstallReadiness(artifact).ready) return false

    selectedPlatforms.add(artifact.artifact_type)
    return true
  })
}
