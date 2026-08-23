import {
  Alert02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Clock01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  InstallActions,
  PrototypeNotice,
  attentionItems,
  installableBuild,
  recentFailures,
  runningBuilds,
  useOverviewDemo,
} from './shared'

export default function TriageBoard() {
  const demo = useOverviewDemo()

  return (
    <div className="operator-overview-enter mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Triage board
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Work that needs a decision, builds in motion, and releases ready to
            share.
          </p>
        </div>
        <Button onClick={demo.runBuild} disabled={demo.queued}>
          <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
          {demo.queued ? 'Build queued' : 'Run build'}
        </Button>
      </header>

      <PrototypeNotice>{demo.notice}</PrototypeNotice>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Needs attention</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Blocks releases or requires an operator
              </p>
            </div>
            <Badge variant="destructive">2</Badge>
          </div>
          <div className="divide-y">
            <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                  <HugeiconsIcon icon={Alert02Icon} className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">
                    {attentionItems[0].project}
                  </div>
                  <div className="text-sm font-medium">
                    {attentionItems[0].title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {attentionItems[0].meta}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={demo.reconnectSource}
              >
                Reconnect source
              </Button>
            </article>
            <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
                  <HugeiconsIcon icon={Clock01Icon} className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">
                    {attentionItems[1].project}
                  </div>
                  <div className="text-sm font-medium">
                    {attentionItems[1].title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {attentionItems[1].meta}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={demo.openRunnerSettings}
              >
                Open runners
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </article>
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Running now</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Active work across connected runners
              </p>
            </div>
            <Badge className="bg-info/15 text-info">2 active</Badge>
          </div>
          <div className="divide-y">
            {runningBuilds.map((build) => (
              <article key={build.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {build.project}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        {build.build}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {build.branch} · {build.step} · {build.elapsed}
                    </div>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Cancel ${build.project} ${build.build}`}
                    onClick={() => demo.cancelBuild(`${build.project} ${build.build}`)}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} />
                  </Button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-info"
                    style={{ width: `${build.progress}%` }}
                  />
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => demo.viewLogs(`${build.project} ${build.build}`)}
                >
                  View live log
                  <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Ready to install/share</h2>
                <Badge variant="success">Signed</Badge>
              </div>
              <div className="mt-4 text-lg font-semibold">
                {installableBuild.project}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {installableBuild.version} · {installableBuild.platform}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {installableBuild.expires}
              </div>
            </div>
            <Badge variant="outline">{installableBuild.build}</Badge>
          </div>
          <div className="mt-5">
            <InstallActions
              install={demo.install}
              copyLink={demo.copyLink}
              share={demo.share}
              compact
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Recent failures</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Failed builds from the past seven days
              </p>
            </div>
            <Badge variant="outline">3</Badge>
          </div>
          <div className="divide-y">
            {recentFailures.map((failure) => (
              <button
                type="button"
                key={`${failure.project}-${failure.build}`}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                onClick={() =>
                  demo.viewLogs(`${failure.project} ${failure.build}`)
                }
              >
                <span className="size-2 shrink-0 rounded-full bg-destructive" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {failure.project}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      {failure.build}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {failure.reason}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {failure.time}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
