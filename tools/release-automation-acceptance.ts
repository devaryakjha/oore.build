type WorkflowStep = {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

type WorkflowJob = {
  name?: string
  needs?: string | string[]
  steps?: WorkflowStep[]
}

type WorkflowTrigger = {
  push?: {
    branches?: string[]
    tags?: string[]
  }
  workflow_dispatch?: unknown
  schedule?: unknown
}

type Workflow = {
  on?: WorkflowTrigger
  permissions?: Record<string, string>
  env?: Record<string, string>
  jobs?: Record<string, WorkflowJob>
}

const autotagPath = '.github/workflows/autotag.yml'
const releasePath = '.github/workflows/release.yml'

async function readWorkflow(path: string): Promise<Workflow> {
  return Bun.YAML.parse(await Bun.file(path).text()) as Workflow
}

function assertContract(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    console.error(`[release-automation] ${message}`)
    process.exit(1)
  }
}

function requireJob(workflow: Workflow, name: string): WorkflowJob {
  const job = workflow.jobs?.[name]
  assertContract(job, `Missing ${name} job`)
  return job
}

function requireStep(job: WorkflowJob, name: string): WorkflowStep {
  const step = job.steps?.find((candidate) => candidate.name === name)
  assertContract(step, `Missing ${name} step`)
  return step
}

function hasOwn(object: object | undefined, key: string): boolean {
  return Boolean(object && Object.hasOwn(object, key))
}

function needs(job: WorkflowJob): string[] {
  if (Array.isArray(job.needs)) return job.needs
  return job.needs ? [job.needs] : []
}

const [autotag, release] = await Promise.all([
  readWorkflow(autotagPath),
  readWorkflow(releasePath),
])

assertContract(
  JSON.stringify(autotag.on?.push?.branches) ===
    JSON.stringify(['stable', 'alpha', 'beta']),
  'Autotag must keep the stable, alpha, and beta branch triggers',
)
assertContract(
  autotag.permissions?.actions === 'write',
  'Autotag must retain workflow dispatch permission',
)
assertContract(
  autotag.permissions?.contents === 'write',
  'Autotag must retain annotated tag permission',
)
const startRelease = requireStep(
  requireJob(autotag, 'autotag'),
  'Start release',
)
assertContract(
  startRelease.run?.includes(
    'gh workflow run release.yml --ref "${GITHUB_REF_NAME}" --field tag="${TAG}"',
  ),
  'Autotag must dispatch the release workflow from the same branch',
)
assertContract(
  !(await Bun.file(autotagPath).text()).includes('RELEASE_PAT'),
  'Autotag must not depend on a personal access token',
)

assertContract(
  JSON.stringify(release.on?.push?.tags) === JSON.stringify(['v*']),
  'Release must retain the v-prefixed tag trigger',
)
assertContract(
  hasOwn(release.on, 'workflow_dispatch'),
  'Release must retain manual tag dispatch',
)
assertContract(
  !hasOwn(release.on, 'schedule'),
  'Release acceptance must not add a scheduled-confidence trigger',
)
assertContract(
  release.env?.RELEASE_TAG === '${{ inputs.tag || github.ref_name }}',
  'Release must retain one tag source for push and manual dispatch',
)

const acceptance = requireJob(release, 'acceptance')
assertContract(
  acceptance.name === 'Hermetic release acceptance',
  'Release acceptance must be named as hermetic evidence',
)
assertContract(
  requireStep(acceptance, 'Run hermetic release acceptance').run ===
    'make release-smoke',
  'Release acceptance must use the stable make release-smoke command',
)
for (const dependentJob of ['deploy', 'rust']) {
  assertContract(
    needs(requireJob(release, dependentJob)).includes('acceptance'),
    `${dependentJob} must wait for hermetic release acceptance`,
  )
}

for (const jobName of [
  'acceptance',
  'deploy',
  'rust',
  'release',
  'release-index',
]) {
  const checkout = requireJob(release, jobName).steps?.find((step) =>
    step.uses?.startsWith('actions/checkout@'),
  )
  assertContract(checkout, `${jobName} must check out release source`)
  assertContract(
    checkout.with?.ref === '${{ env.RELEASE_TAG }}',
    `${jobName} must check out the exact release tag`,
  )
}

assertContract(
  requireStep(
    requireJob(release, 'release'),
    'Package release tarballs',
  ).run?.includes('shasum -a 256'),
  'Release packaging must generate archive checksums',
)
assertContract(
  requireStep(
    requireJob(release, 'release'),
    'Create GitHub Release',
  ).run?.includes('gh release upload'),
  'Release publication must upload GitHub Release assets',
)
assertContract(
  needs(requireJob(release, 'release-index')).includes('release'),
  'Release index publication must wait for release asset publication',
)

console.log('[release-automation] Hermetic workflow contracts passed.')
