export type BuildSort =
  | 'created_at'
  | 'status'
  | 'project_name'
  | 'pipeline_name'
  | 'branch'

export const BUILD_SORT_OPTIONS = {
  created_at: 'Newest first',
  status: 'Status',
  project_name: 'Project',
  pipeline_name: 'Pipeline',
  branch: 'Branch',
} satisfies Record<BuildSort, string>
