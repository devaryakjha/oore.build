import { useState } from 'react'
import {
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  InstallActions,
  PrototypeNotice,
  attentionItems,
  installableBuild,
  recentFailures,
  runningBuilds,
  useOverviewDemo,
} from './shared'

type Filter = 'all' | 'attention' | 'running' | 'install' | 'failures'

const filters: { id: Filter; label: string; count?: number }[] = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Attention', count: 2 },
  { id: 'running', label: 'Running', count: 2 },
  { id: 'install', label: 'Install', count: 1 },
  { id: 'failures', label: 'Failures', count: 3 },
]

export default function TimelineOverview() {
  const demo = useOverviewDemo()
  const [filter, setFilter] = useState<Filter>('all')
  const show = (kind: Filter) => filter === 'all' || filter === kind

  return (
    <div className="operator-overview-enter mx-auto w-full max-w-6xl px-4 py-5 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Timeline
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Build activity
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Decisions, live work, and installable outcomes in one ordered view.
          </p>
        </div>
        <Button onClick={demo.runBuild} disabled={demo.queued}>
          <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
          {demo.queued ? 'Build queued' : 'Run build'}
        </Button>
      </header>

      <div className="mt-5">
        <PrototypeNotice>{demo.notice}</PrototypeNotice>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Filter build activity">
        {filters.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={filter === item.id ? 'secondary' : 'ghost'}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            {item.count ? (
              <span className="ml-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] tabular-nums">
                {item.count}
              </span>
            ) : null}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Today</h2>
            <span className="text-xs text-muted-foreground">Newest first</span>
          </div>
          <div className="relative space-y-4 before:absolute before:inset-y-3 before:left-[0.6875rem] before:w-px before:bg-border">
            {show('attention') ? (
              <TimelineItem
                dot="danger"
                time="12 minutes ago"
                eyebrow="Needs attention"
                title="Mobile GitLab source rejected its credential"
                detail="Critical source incident · occurred 3 times · builds cannot fetch."
              >
                <Button
                  size="sm"
                  onClick={demo.reconnectSource}
                >
                  Reconnect GitLab
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => demo.openBuild('the affected builds')}
                >
                  View affected builds
                </Button>
              </TimelineItem>
            ) : null}

            {show('running')
              ? runningBuilds.map((build, index) => (
                  <TimelineItem
                    key={build.id}
                    dot="info"
                    time={index === 0 ? 'Started 6 minutes ago' : 'Queued 1 minute ago'}
                    eyebrow="Running now"
                    title={`${build.project} ${build.build}`}
                    detail={`${build.branch} · ${build.step} · ${build.elapsed}`}
                  >
                    <div className="mr-auto h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-info"
                        style={{ width: `${build.progress}%` }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        demo.viewLogs(`${build.project} ${build.build}`)
                      }
                    >
                      Live log
                    </Button>
                  </TimelineItem>
                ))
              : null}

            {show('install') ? (
              <TimelineItem
                dot="success"
                time="Ready 36 minutes ago"
                eyebrow="Ready to install/share"
                title={`${installableBuild.project} ${installableBuild.version}`}
                detail={`${installableBuild.platform} · ${installableBuild.expires}`}
              >
                <InstallActions
                  install={demo.install}
                  copyLink={demo.copyLink}
                  share={demo.share}
                  compact
                />
              </TimelineItem>
            ) : null}

            {show('attention') ? (
              <TimelineItem
                dot="warning"
                time="Queued 12 minutes ago"
                eyebrow="Needs attention"
                title={attentionItems[1].title}
                detail={attentionItems[1].meta}
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={demo.openRunnerSettings}
                >
                  Open runners
                  <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
                </Button>
              </TimelineItem>
            ) : null}
          </div>

          {show('failures') ? (
            <section className="mt-8 border-t pt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent failures</h2>
                <Badge variant="outline">Past 7 days</Badge>
              </div>
              <div className="divide-y rounded-xl border bg-card">
                {recentFailures.map((failure) => (
                  <button
                    type="button"
                    key={`${failure.project}-${failure.build}`}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                    onClick={() =>
                      demo.viewLogs(`${failure.project} ${failure.build}`)
                    }
                  >
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      className="size-4 shrink-0 text-destructive"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {failure.project}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          {failure.build}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {failure.reason}
                      </span>
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {failure.time}
                    </span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {filter !== 'all' &&
          ((filter === 'attention' && !show('attention')) ||
            (filter === 'running' && !show('running')) ||
            (filter === 'install' && !show('install')) ||
            (filter === 'failures' && !show('failures'))) ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No activity matches this filter.
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-xl border bg-card lg:sticky lg:top-6">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Operator queue</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Current workload by outcome
            </p>
          </div>
          <div className="divide-y">
            <QueueRow
              icon={Alert02Icon}
              tone="danger"
              label="Needs attention"
              value="2"
              onClick={() => setFilter('attention')}
            />
            <QueueRow
              icon={Clock01Icon}
              tone="info"
              label="Running now"
              value="2"
              onClick={() => setFilter('running')}
            />
            <QueueRow
              icon={CheckmarkCircle02Icon}
              tone="success"
              label="Ready to install/share"
              value="1"
              onClick={() => setFilter('install')}
            />
            <QueueRow
              icon={Alert02Icon}
              tone="danger"
              label="Recent failures"
              value="3"
              onClick={() => setFilter('failures')}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function TimelineItem({
  children,
  detail,
  dot,
  eyebrow,
  time,
  title,
}: {
  children: React.ReactNode
  detail: string
  dot: 'danger' | 'warning' | 'info' | 'success'
  eyebrow: string
  time: string
  title: string
}) {
  return (
    <article className="relative pl-9">
      <span
        className={cn(
          'absolute top-1 left-0 z-10 grid size-[1.375rem] place-items-center rounded-full border-4 border-background',
          dot === 'danger' && 'bg-destructive',
          dot === 'warning' && 'bg-warning',
          dot === 'info' && 'bg-info',
          dot === 'success' && 'bg-success',
        )}
      />
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {eyebrow}
          </span>
          <time className="text-xs text-muted-foreground">{time}</time>
        </div>
        <h3 className="mt-2 text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </article>
  )
}

function QueueRow({
  icon,
  label,
  onClick,
  tone,
  value,
}: {
  icon: typeof Alert02Icon
  label: string
  onClick: () => void
  tone: 'danger' | 'info' | 'success'
  value: string
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      onClick={onClick}
    >
      <HugeiconsIcon
        icon={icon}
        className={cn(
          'size-4',
          tone === 'danger' && 'text-destructive',
          tone === 'info' && 'text-info',
          tone === 'success' && 'text-success',
        )}
      />
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <span className="font-mono text-xs font-semibold">{value}</span>
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
    </button>
  )
}
