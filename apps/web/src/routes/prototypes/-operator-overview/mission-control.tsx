import {
  Alert02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  InstallActions,
  Metric,
  PrototypeNotice,
  attentionItems,
  installableBuild,
  recentFailures,
  runningBuilds,
  useOverviewDemo,
} from './shared'

export default function MissionControl() {
  const demo = useOverviewDemo()

  return (
    <div className="operator-overview-enter mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Mission control
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Good morning, Arya.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two items need a decision. One release is ready to share.
          </p>
        </div>
        <Button size="lg" onClick={demo.runBuild} disabled={demo.queued}>
          <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
          {demo.queued ? 'Build queued' : 'Run build'}
        </Button>
      </header>

      <PrototypeNotice>{demo.notice}</PrototypeNotice>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.75fr)]">
        <section className="overflow-hidden rounded-2xl border border-destructive/25 bg-card">
          <div className="flex items-center gap-2 border-b border-destructive/15 bg-destructive/5 px-5 py-3 text-xs font-semibold tracking-wide text-destructive uppercase">
            <HugeiconsIcon icon={Alert02Icon} className="size-4" />
            Needs attention
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <Badge variant="destructive">Source incident</Badge>
                <h2 className="mt-3 text-xl font-semibold sm:text-2xl">
                  Mobile GitLab source rejected its stored credential
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Builds cannot fetch this source. Oore recorded the same
                  critical incident three times in the past two hours.
                </p>
                <div className="mt-3 font-mono text-xs text-muted-foreground">
                  source · gitlab · latest occurrence 10 minutes ago
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => demo.openBuild('the affected builds')}
                >
                  View affected builds
                </Button>
                <Button onClick={demo.reconnectSource}>
                  Reconnect GitLab
                </Button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t bg-muted/25 px-5 py-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            onClick={demo.openRunnerSettings}
          >
            <span className="size-2 rounded-full bg-warning" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{attentionItems[1].project}:</span>{' '}
              {attentionItems[1].title}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Open runners
            </span>
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </button>
        </section>

        <aside className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">At a glance</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6">
            <Metric label="Need attention" value="2" tone="danger" />
            <Metric label="Running now" value="2" tone="info" />
            <Metric label="Ready to install" value="1" tone="success" />
            <Metric label="Runners online" value="3/3" />
          </div>
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center gap-2 text-xs font-medium text-success">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
              Core services healthy
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Last checked less than a minute ago
            </p>
          </div>
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Running now</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Follow the work most likely to need you next.
            </p>
          </div>
          <Badge className="bg-info/15 text-info">2 active</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {runningBuilds.map((build, index) => (
            <article
              key={build.id}
              className="rounded-xl border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {index === 0 ? 'Building' : 'Waiting for runner'}
                  </div>
                  <h3 className="mt-1 font-semibold">
                    {build.project}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      {build.build}
                    </span>
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Cancel ${build.project} ${build.build}`}
                  onClick={() => demo.cancelBuild(`${build.project} ${build.build}`)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} />
                </Button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{build.step}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-info"
                    style={{ width: `${build.progress}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {build.elapsed}
                </span>
              </div>
              <Button
                className="mt-3"
                size="xs"
                variant="link"
                onClick={() => demo.viewLogs(`${build.project} ${build.build}`)}
              >
                Open live log
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Ready to install/share
                </h2>
                <Badge variant="success">New</Badge>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">
                {installableBuild.project}
              </h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {installableBuild.version} · {installableBuild.platform}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Signed, notarized, and ready for the QA group.{' '}
                {installableBuild.expires}.
              </p>
            </div>
            <Badge variant="outline">{installableBuild.build}</Badge>
          </div>
          <div className="mt-5">
            <InstallActions
              install={demo.install}
              copyLink={demo.copyLink}
              share={demo.share}
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Recent failures</h2>
            <Badge variant="outline">7 days</Badge>
          </div>
          <div className="divide-y">
            {recentFailures.map((failure) => (
              <button
                type="button"
                key={`${failure.project}-${failure.build}`}
                className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                onClick={() =>
                  demo.viewLogs(`${failure.project} ${failure.build}`)
                }
              >
                <span className="size-2 shrink-0 rounded-full bg-destructive" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {failure.project} {failure.build}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {failure.reason}
                  </span>
                </span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
