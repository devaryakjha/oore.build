import { useState } from 'react'
import {
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  DashboardSquare02Icon,
  Moon02Icon,
  PlayIcon,
  Settings01Icon,
  Share08Icon,
  Sun03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useTheme } from 'next-themes'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ProjectScenario =
  | 'failed-installable'
  | 'no-pipeline'
  | 'no-builds'
  | 'blocked'
  | 'active'

export interface ScenarioData {
  id: ProjectScenario
  label: string
  healthLabel: string
  healthTone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  headline: string
  blocker: string
  blockerDetail: string
  pipelineCount: number
  buildCount: number
  latestBuild?: {
    number: string
    status: string
    branch: string
    commit: string
    time: string
    tone: 'success' | 'warning' | 'danger' | 'info'
  }
  activity: Array<{
    title: string
    detail: string
    time: string
    tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  }>
  install?: {
    build: string
    version: string
    platform: string
    note: string
  }
}

export const scenarios = {
  'failed-installable': {
    id: 'failed-installable',
    label: 'Failure + older install',
    healthLabel: 'Needs attention',
    healthTone: 'danger',
    headline: 'Latest build failed; the previous release is still installable.',
    blocker: 'Build #185 failed during snapshot tests',
    blockerDetail:
      'Three checkout snapshots changed on main. The last green build used the same runner and signing profile.',
    pipelineCount: 3,
    buildCount: 185,
    latestBuild: {
      number: '#185',
      status: 'Failed',
      branch: 'main',
      commit: '51ac82f',
      time: '12 minutes ago',
      tone: 'danger',
    },
    activity: [
      {
        title: 'Build #185 failed',
        detail: 'Release · Snapshot tests',
        time: '12m ago',
        tone: 'danger',
      },
      {
        title: 'Build #184 became installable',
        detail: 'Signed IPA · iPhone and iPad',
        time: '2h ago',
        tone: 'success',
      },
      {
        title: 'Build #183 passed',
        detail: 'Preview · main · 9e21bc4',
        time: 'Yesterday',
        tone: 'success',
      },
    ],
    install: {
      build: '#184',
      version: '2.14.0 (184)',
      platform: 'iOS · IPA',
      note: 'Ready to install · expires in 6 days',
    },
  },
  'no-pipeline': {
    id: 'no-pipeline',
    label: 'No pipeline',
    healthLabel: 'Setup needed',
    healthTone: 'warning',
    headline: 'Connect a pipeline before this project can produce a build.',
    blocker: 'No pipeline is configured',
    blockerDetail:
      'The GitHub source is connected. Import a workflow or create a pipeline to make Run build available.',
    pipelineCount: 0,
    buildCount: 0,
    activity: [
      {
        title: 'Repository connected',
        detail: 'oore-ci/storefront · default branch main',
        time: '18m ago',
        tone: 'success',
      },
    ],
  },
  'no-builds': {
    id: 'no-builds',
    label: 'No builds',
    healthLabel: 'Ready to run',
    healthTone: 'info',
    headline: 'The Release pipeline is ready for its first build.',
    blocker: 'No build history yet',
    blockerDetail:
      'Use Run build in the project header to verify the repository, runner, and artifact path together.',
    pipelineCount: 2,
    buildCount: 0,
    activity: [
      {
        title: 'Release pipeline created',
        detail: 'main · iOS signing configured',
        time: '7m ago',
        tone: 'info',
      },
      {
        title: 'Preview pipeline created',
        detail: 'Pull request branches',
        time: '9m ago',
        tone: 'neutral',
      },
    ],
  },
  blocked: {
    id: 'blocked',
    label: 'Blocked',
    healthLabel: 'Blocked',
    healthTone: 'warning',
    headline: 'Build #185 is waiting for an eligible iOS runner.',
    blocker: 'No compatible runner is online',
    blockerDetail:
      'The Release pipeline requires Xcode 16 with iOS signing. mac-mini-02 last checked in 21 minutes ago.',
    pipelineCount: 3,
    buildCount: 185,
    latestBuild: {
      number: '#185',
      status: 'Waiting',
      branch: 'main',
      commit: '51ac82f',
      time: 'queued 8 minutes ago',
      tone: 'warning',
    },
    activity: [
      {
        title: 'Build #185 is waiting',
        detail: 'Release · needs Xcode 16 + iOS signing',
        time: '8m ago',
        tone: 'warning',
      },
      {
        title: 'mac-mini-02 went offline',
        detail: 'Runner heartbeat stopped',
        time: '21m ago',
        tone: 'danger',
      },
      {
        title: 'Build #184 passed',
        detail: 'Release · main · 29d712e',
        time: 'Yesterday',
        tone: 'success',
      },
    ],
    install: {
      build: '#184',
      version: '2.13.8 (184)',
      platform: 'iOS · IPA',
      note: 'Previous install-ready build · expires in 4 days',
    },
  },
  active: {
    id: 'active',
    label: 'Active',
    healthLabel: 'Building',
    healthTone: 'info',
    headline: 'Build #185 is running and the previous release remains available.',
    blocker: 'No blocker detected',
    blockerDetail:
      'The build is compiling on mac-mini-02. Signing is configured and the artifact store is available.',
    pipelineCount: 3,
    buildCount: 185,
    latestBuild: {
      number: '#185',
      status: 'Running · 68%',
      branch: 'main',
      commit: '51ac82f',
      time: 'started 6 minutes ago',
      tone: 'info',
    },
    activity: [
      {
        title: 'Build #185 is compiling',
        detail: 'Release · Assemble macOS app · 68%',
        time: 'Now',
        tone: 'info',
      },
      {
        title: 'Build #184 became installable',
        detail: 'Signed IPA · iPhone and iPad',
        time: 'Yesterday',
        tone: 'success',
      },
      {
        title: 'Release pipeline updated',
        detail: 'Xcode set to 16.0',
        time: '2d ago',
        tone: 'neutral',
      },
    ],
    install: {
      build: '#184',
      version: '2.13.8 (184)',
      platform: 'iOS · IPA',
      note: 'Previous install-ready build · expires in 4 days',
    },
  },
} satisfies Record<ProjectScenario, ScenarioData>

export const scenarioOrder: ProjectScenario[] = [
  'failed-installable',
  'no-pipeline',
  'no-builds',
  'blocked',
  'active',
]

const workspaceItems: Array<{
  label: string
  icon: IconSvgElement
  active: boolean
}> = [
  { label: 'Overview', icon: DashboardSquare02Icon, active: false },
  { label: 'Projects', icon: Clock01Icon, active: true },
  { label: 'Builds', icon: PlayIcon, active: false },
  { label: 'Settings', icon: Settings01Icon, active: false },
]

export function useProjectOverviewDemo() {
  const [scenario, setScenario] = useState<ProjectScenario>(
    'failed-installable',
  )
  const [notice, setNotice] = useState(
    'Prototype data is fixed. Actions update this preview only.',
  )
  const [queued, setQueued] = useState(false)

  return {
    scenario,
    data: scenarios[scenario],
    notice,
    queued,
    selectScenario(next: ProjectScenario) {
      setScenario(next)
      setQueued(false)
      setNotice(`Showing the ${scenarios[next].label.toLowerCase()} state.`)
    },
    runBuild() {
      if (scenarios[scenario].pipelineCount === 0) {
        setNotice('Create or import a pipeline before running a build.')
        return
      }
      setQueued(true)
      setNotice('Storefront build #186 is queued on the Release pipeline.')
    },
    openPeer(label: string) {
      setNotice(`${label} opened for Storefront.`)
    },
    openAction(label: string) {
      setNotice(`${label} opened for Storefront.`)
    },
    install() {
      setNotice('The signed Storefront installer is ready to open.')
    },
    async copyLink() {
      try {
        await navigator.clipboard.writeText(
          'https://ci.oore.build/install/storefront/184',
        )
        setNotice('Install link copied.')
      } catch {
        setNotice('Install link selected: ci.oore.build/install/storefront/184')
      }
    },
    async share() {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Storefront 2.14.0',
            url: 'https://ci.oore.build/install/storefront/184',
          })
          setNotice('Install link shared.')
          return
        } catch {
          // Cancelling the share sheet completes the prototype interaction.
        }
      }
      setNotice('Share options opened for Storefront 2.14.0.')
    },
  }
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Use light appearance' : 'Use dark appearance'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} />
    </Button>
  )
}

export function ProjectPrototypeShell({
  children,
  data,
  notice,
  queued,
  scenario,
  onScenarioChange,
  onRunBuild,
  onOpenPeer,
}: {
  children: React.ReactNode
  data: ScenarioData
  notice: string
  queued: boolean
  scenario: ProjectScenario
  onScenarioChange: (scenario: ProjectScenario) => void
  onRunBuild: () => void
  onOpenPeer: (label: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-0 bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-3 md:flex md:flex-col">
        <div className="flex h-12 items-center gap-3 rounded-xl px-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            O
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Oore CI</div>
            <div className="truncate text-xs text-muted-foreground">
              Local operator
            </div>
          </div>
        </div>

        <nav aria-label="Prototype workspace" className="mt-5 space-y-1">
          {workspaceItems.map(({ label, icon, active }) => (
            <button
              type="button"
              key={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-sidebar-accent',
                active
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => onOpenPeer(label)}
            >
              <HugeiconsIcon icon={icon} className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border bg-background/65 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="size-2 rounded-full bg-success" />
            Source connected
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            oore-ci/storefront
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold md:hidden">Oore CI</span>
            <span className="hidden text-muted-foreground md:inline">
              Projects
            </span>
            <span className="hidden text-muted-foreground md:inline">/</span>
            <span className="truncate font-medium">Storefront</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Prototype · fixed sample data
            </span>
            <ThemeButton />
            <div
              aria-label="Signed in as Arya"
              className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold"
            >
              AJ
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-24">
          <div className="border-b bg-muted/25">
            <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">
                      Storefront
                    </h1>
                    <HealthBadge tone={data.healthTone}>
                      {data.healthLabel}
                    </HealthBadge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    oore-ci/storefront · main
                  </p>
                </div>
                <Button
                  onClick={onRunBuild}
                  disabled={queued || data.pipelineCount === 0}
                >
                  <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
                  {queued ? 'Build queued' : 'Run build'}
                </Button>
              </div>

              <nav
                aria-label="Project sections"
                className="mt-4 flex gap-1 overflow-x-auto"
              >
                {['Overview', 'Builds', 'Pipelines', 'Settings'].map((label) => (
                  <button
                    type="button"
                    key={label}
                    aria-current={label === 'Overview' ? 'page' : undefined}
                    className={cn(
                      'min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                      label === 'Overview'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => onOpenPeer(label)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="border-b bg-background">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Preview state
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Switch data states without changing the chosen layout.
                </p>
              </div>
              <div
                role="toolbar"
                aria-label="Project overview state"
                className="flex gap-1 overflow-x-auto pb-1 lg:pb-0"
              >
                {scenarioOrder.map((id) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={scenario === id ? 'secondary' : 'ghost'}
                    aria-pressed={scenario === id}
                    className="shrink-0"
                    onClick={() => onScenarioChange(id)}
                  >
                    {scenarios[id].label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div
            role="status"
            aria-live="polite"
            className="mx-auto mt-4 flex min-h-9 w-[calc(100%-2rem)] max-w-7xl items-center gap-2 rounded-lg border bg-muted/45 px-3 py-2 text-xs text-muted-foreground sm:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)]"
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-success" />
            {notice}
          </div>

          {children}
        </main>
      </div>
    </div>
  )
}

export function HealthBadge({
  tone,
  children,
}: {
  tone: ScenarioData['healthTone']
  children: React.ReactNode
}) {
  const variants = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-destructive/10 text-destructive',
    info: 'bg-info/15 text-info',
    neutral: 'bg-muted text-muted-foreground',
  }

  return <Badge className={variants[tone]}>{children}</Badge>
}

export function ToneDot({ tone }: { tone: ScenarioData['healthTone'] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0 rounded-full',
        tone === 'success' && 'bg-success',
        tone === 'warning' && 'bg-warning',
        tone === 'danger' && 'bg-destructive',
        tone === 'info' && 'bg-info',
        tone === 'neutral' && 'bg-muted-foreground',
      )}
    />
  )
}

export function BlockerIcon({ tone }: { tone: ScenarioData['healthTone'] }) {
  return (
    <HugeiconsIcon
      icon={tone === 'success' || tone === 'info' ? CheckmarkCircle02Icon : Alert02Icon}
      className={cn(
        'size-5',
        tone === 'success' && 'text-success',
        tone === 'warning' && 'text-warning',
        tone === 'danger' && 'text-destructive',
        tone === 'info' && 'text-info',
      )}
    />
  )
}

export function PrimaryBlockerActions({
  data,
  onOpenAction,
}: {
  data: ScenarioData
  onOpenAction: (label: string) => void
}) {
  if (data.id === 'no-pipeline') {
    return (
      <Button onClick={() => onOpenAction('Create pipeline')}>
        Create pipeline
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
      </Button>
    )
  }
  if (data.id === 'no-builds') {
    return (
      <Button variant="outline" onClick={() => onOpenAction('Release pipeline')}>
        Review pipeline
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
      </Button>
    )
  }
  if (data.id === 'blocked') {
    return (
      <Button onClick={() => onOpenAction('Runner settings')}>
        Open runner settings
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
      </Button>
    )
  }
  if (data.id === 'failed-installable') {
    return (
      <Button onClick={() => onOpenAction('Build #185')}>
        Open build
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
      </Button>
    )
  }
  return (
    <Button variant="outline" onClick={() => onOpenAction('Live build log')}>
      Open live log
      <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
    </Button>
  )
}

export function InstallActions({
  data,
  onInstall,
  onCopyLink,
  onShare,
  compact = false,
}: {
  data: ScenarioData
  onInstall: () => void
  onCopyLink: () => void
  onShare: () => void
  compact?: boolean
}) {
  if (!data.install) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No installable build yet. A signed artifact will appear here after a
        successful release build.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={compact ? 'sm' : 'default'} onClick={onInstall}>
        <HugeiconsIcon icon={CheckmarkCircle02Icon} data-icon="inline-start" />
        Install
      </Button>
      <Button
        size={compact ? 'sm' : 'default'}
        variant="outline"
        onClick={onCopyLink}
      >
        <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
        Copy link
      </Button>
      <Button
        size={compact ? 'sm' : 'default'}
        variant="ghost"
        onClick={onShare}
      >
        <HugeiconsIcon icon={Share08Icon} data-icon="inline-start" />
        Share
      </Button>
    </div>
  )
}

export const toneIcon = {
  danger: Alert02Icon,
  warning: Clock01Icon,
  info: Clock01Icon,
  success: CheckmarkCircle02Icon,
  neutral: Clock01Icon,
}
