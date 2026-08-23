import { ArrowRight01Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  HealthBadge,
  InstallActions,
  PrimaryBlockerActions,
  ToneDot,
  type ScenarioData,
} from './shared'

interface BoardOverviewProps {
  data: ScenarioData
  queued: boolean
  onRunBuild: () => void
  onOpenAction: (label: string) => void
  onInstall: () => void
  onCopyLink: () => void
  onShare: () => void
}

export default function BoardOverview(props: BoardOverviewProps) {
  const { data } = props

  return (
    <div className="project-overview-enter mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Board
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Project operations
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Health, build motion, and delivery stay visible as parallel lanes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HealthBadge tone={data.healthTone}>{data.healthLabel}</HealthBadge>
          <Button
            size="sm"
            onClick={props.onRunBuild}
            disabled={props.queued || data.pipelineCount === 0}
          >
            <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
            {props.queued ? 'Queued' : 'Run'}
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <BoardLane title="Health" count="1 signal" description="What blocks a useful outcome">
          <article className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Highest blocker
              </span>
              <HealthBadge tone={data.healthTone}>{data.healthLabel}</HealthBadge>
            </div>
            <h3 className="mt-3 text-base font-semibold">{data.blocker}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {data.blockerDetail}
            </p>
            <div className="mt-4">
              <PrimaryBlockerActions {...props} />
            </div>
          </article>

          <article className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Project setup</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniMetric label="Pipelines" value={String(data.pipelineCount)} />
              <MiniMetric label="Builds" value={String(data.buildCount)} />
            </div>
            <Button
              className="mt-3 w-full"
              size="sm"
              variant="outline"
              onClick={() => props.onOpenAction('Pipelines')}
            >
              Open pipelines
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          </article>
        </BoardLane>

        <BoardLane
          title="Build activity"
          count={`${data.activity.length} events`}
          description="What changed and what is moving"
        >
          {data.latestBuild ? (
            <article className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Latest build
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {data.latestBuild.number}
                  </div>
                </div>
                <HealthBadge tone={data.latestBuild.tone}>
                  {data.latestBuild.status}
                </HealthBadge>
              </div>
              <div className="mt-3 font-mono text-xs text-muted-foreground">
                {data.latestBuild.branch} · {data.latestBuild.commit}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.latestBuild.time}
              </div>
              {data.id === 'active' ? (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[68%] rounded-full bg-info" />
                </div>
              ) : null}
            </article>
          ) : (
            <article className="rounded-xl border border-dashed p-4">
              <div className="text-sm font-semibold">No build history</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Build events appear here after a pipeline runs.
              </p>
            </article>
          )}

          <div className="overflow-hidden rounded-xl border bg-card">
            {data.activity.map((item) => (
              <button
                type="button"
                key={`${item.title}-${item.time}`}
                className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                onClick={() => props.onOpenAction(item.title)}
              >
                <ToneDot tone={item.tone} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {item.time}
                </span>
              </button>
            ))}
          </div>

          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={() => props.onOpenAction('Builds')}
          >
            All builds
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </BoardLane>

        <BoardLane title="Delivery" count={data.install ? '1 ready' : '0 ready'} description="What testers can install now">
          <article className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Install availability</h3>
              {data.install ? <Badge variant="success">Ready</Badge> : <Badge variant="outline">None</Badge>}
            </div>
            {data.install ? (
              <>
                <div className="mt-4 text-xl font-semibold">{data.install.version}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {data.install.build} · {data.install.platform}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {data.install.note}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                A successful signed build will appear here with install and share actions.
              </p>
            )}
            <div className="mt-4">
              <InstallActions
                data={data}
                compact
                onInstall={props.onInstall}
                onCopyLink={props.onCopyLink}
                onShare={props.onShare}
              />
            </div>
          </article>

          <article className="rounded-xl border bg-muted/35 p-4">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Outcome
            </div>
            <p className="mt-2 text-sm font-medium">{data.headline}</p>
          </article>
        </BoardLane>
      </div>
    </div>
  )
}

function BoardLane({
  title,
  count,
  description,
  children,
}: {
  title: string
  count: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-2xl bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
