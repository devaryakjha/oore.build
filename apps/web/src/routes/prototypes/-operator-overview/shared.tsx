import { useState } from 'react'
import {
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
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const attentionItems = [
  {
    id: 'gitlab-rejected',
    project: 'GitLab source',
    title: 'Mobile source rejected its stored credential',
    meta: 'Critical incident · occurred 3 times',
  },
  {
    id: 'ios-runner-blocked',
    project: 'Orbit iOS',
    title: 'Build #639 is blocked: no online macOS runner',
    meta: 'Release · queued 12 minutes ago',
  },
]

export const runningBuilds = [
  {
    id: 'android-921',
    project: 'Orbit Android',
    build: '#921',
    branch: 'release/2.8',
    step: 'Assemble release APK',
    progress: 68,
    elapsed: '6m 14s',
  },
  {
    id: 'api-1842',
    project: 'Oore API',
    build: '#1842',
    branch: 'main',
    step: 'Waiting for mac-mini-02',
    progress: 12,
    elapsed: '1m 08s',
  },
]

export const installableBuild = {
  project: 'Orbit Android',
  build: '#920',
  version: '2.8.0 (920)',
  platform: 'Android APK',
  expires: 'Expires in 6 days',
}

export const recentFailures = [
  {
    project: 'Storefront',
    build: '#184',
    reason: '3 snapshot tests failed',
    time: '12m ago',
  },
  {
    project: 'Orbit iOS',
    build: '#638',
    reason: 'Provisioning profile missing',
    time: 'Yesterday, 18:42',
  },
  {
    project: 'Docs',
    build: '#72',
    reason: 'Deploy check timed out',
    time: 'Aug 21, 09:10',
  },
]

export function useOverviewDemo() {
  const [notice, setNotice] = useState(
    'Prototype data is fixed. Actions update this preview only.',
  )
  const [queued, setQueued] = useState(false)

  const runBuild = () => {
    setQueued(true)
    setNotice('Storefront build #185 is queued on the Release pipeline.')
  }
  const reconnectSource = () => {
    setNotice('GitLab connection repair opened for the Mobile source.')
  }
  const openRunnerSettings = () => {
    setNotice('Runner health opened for the blocked Orbit iOS build.')
  }
  const openBuild = (label: string) => {
    setNotice(`Build details opened for ${label}.`)
  }
  const viewLogs = (label: string) => {
    setNotice(`Logs opened for ${label}.`)
  }
  const cancelBuild = (label: string) => {
    setNotice(`Cancel confirmation opened for ${label}.`)
  }
  const install = () => {
    setNotice('The Orbit Android APK install page opened.')
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        'https://ci.oore.build/install/orbit-android/920',
      )
      setNotice('Install link copied.')
    } catch {
      setNotice(
        'Install link selected: ci.oore.build/install/orbit-android/920',
      )
    }
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Orbit Android 2.8.0',
          url: 'https://ci.oore.build/install/orbit-android/920',
        })
        setNotice('Install link shared.')
        return
      } catch {
        // A cancelled share sheet is a complete interaction in the prototype.
      }
    }
    setNotice('Share sheet opened for Orbit Android 2.8.0.')
  }

  return {
    notice,
    queued,
    runBuild,
    reconnectSource,
    openRunnerSettings,
    openBuild,
    viewLogs,
    cancelBuild,
    install,
    copyLink,
    share,
  }
}

export function PrototypeNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/45 px-3 py-2 text-xs text-muted-foreground"
    >
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        className="size-4 text-success"
      />
      {children}
    </div>
  )
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

export function PrototypeShell({ children }: { children: React.ReactNode }) {
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
          <ShellNavItem
            label="Overview"
            icon={DashboardSquare02Icon}
            active
          />
          <ShellNavItem label="Projects" icon={Clock01Icon} />
          <ShellNavItem label="Builds" icon={PlayIcon} />
          <ShellNavItem label="Settings" icon={Settings01Icon} />
        </nav>

        <div className="mt-auto rounded-xl border bg-background/65 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="size-2 rounded-full bg-success" />
            All systems operational
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            3 runners connected
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold md:hidden">Oore CI</span>
            <span className="hidden text-muted-foreground md:inline">
              Operator workspace
            </span>
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
        <main className="min-h-0 flex-1 overflow-y-auto pb-24">{children}</main>
      </div>
    </div>
  )
}

function ShellNavItem({
  active = false,
  icon,
  label,
}: {
  active?: boolean
  icon: typeof DashboardSquare02Icon
  label: string
}) {
  return (
    <div
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center gap-3 rounded-lg px-3 text-sm',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-muted-foreground',
      )}
    >
      <HugeiconsIcon icon={icon} className="size-4" />
      {label}
    </div>
  )
}

export function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'danger' | 'success' | 'info'
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          'text-2xl font-semibold tracking-tight tabular-nums',
          tone === 'danger' && 'text-destructive',
          tone === 'success' && 'text-success',
          tone === 'info' && 'text-info',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function InstallActions({
  install,
  copyLink,
  share,
  compact = false,
}: {
  install: () => void
  copyLink: () => void
  share: () => void
  compact?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size={compact ? 'sm' : 'default'} onClick={install}>
        <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
        Install
      </Button>
      <Button
        size={compact ? 'sm' : 'default'}
        variant="outline"
        onClick={copyLink}
      >
        <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
        Copy link
      </Button>
      <Button
        size={compact ? 'sm' : 'default'}
        variant="ghost"
        onClick={share}
      >
        <HugeiconsIcon icon={Share08Icon} data-icon="inline-start" />
        Share
      </Button>
    </div>
  )
}
