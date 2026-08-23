import type { Build, BuildStatus, Pipeline, Project } from '@oore/client/models'

export interface ProjectLatestBuild {
  id: string
  build_number: number
  status: BuildStatus
  pipeline_id: string
  pipeline_name: string | null
  created_at: number
  updated_at: number
  finished_at: number | null
}

/**
 * Temporary compatibility shape while the published client still types the
 * project collection as Project[]. The API sends these fields flattened.
 */
export type ProjectListItem = Project & {
  latest_build?: ProjectLatestBuild | null
}

export function asProjectListItems(
  projects: ReadonlyArray<Project>,
): Array<ProjectListItem> {
  // SAFETY: the list-projects endpoint now returns flattened latest_build data;
  // the published 0.1.0 client is the only part that still narrows it to Project.
  const projectListItems = projects as ReadonlyArray<ProjectListItem>
  return [...projectListItems]
}

export function latestBuildActivityAt(build: ProjectLatestBuild): number {
  return build.finished_at ?? build.updated_at
}

export function selectProjectLatestBuild(
  projectId: string,
  builds: ReadonlyArray<Build>,
  pipelines: ReadonlyArray<Pipeline>,
): ProjectLatestBuild | null {
  const latest = builds.reduce<Build | null>((selected, build) => {
    if (build.project_id !== projectId) return selected
    if (!selected || build.build_number > selected.build_number) return build
    return selected
  }, null)

  if (!latest) return null

  return {
    id: latest.id,
    build_number: latest.build_number,
    status: latest.status,
    pipeline_id: latest.pipeline_id,
    pipeline_name:
      pipelines.find((pipeline) => pipeline.id === latest.pipeline_id)?.name ??
      null,
    created_at: latest.created_at,
    updated_at: latest.updated_at,
    finished_at: latest.finished_at ?? null,
  }
}
