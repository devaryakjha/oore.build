interface RoleLabels {
  [role: string]: string
}

export const ROLE_LABELS: RoleLabels = {
  owner: 'Owner',
  admin: 'Admin',
  developer: 'Developer',
  qa_viewer: 'QA Viewer',
}
