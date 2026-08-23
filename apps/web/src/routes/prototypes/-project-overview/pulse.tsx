import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  BlockerIcon,
  HealthBadge,
  InstallActions,
  PrimaryBlockerActions,
  ToneDot,
  type ScenarioData,
} from './shared'

interface PulseOverviewProps {
  data: ScenarioData
  queued: boolean
  onRunBuild: () => void
  onOpenAction: (label: string) => void
  onInstall: () => void
  onCopyLink: () => void
  onShare: () => void
}

export default function PulseOverview(props: PulseOverviewProps) {
  const { data } = props

  return (
    <div className="project-overview-enter mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header>
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Pulse
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          {data.headline}
        </h2>
      </header>

      <section
        aria-label="Project summary"
        className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3"
      >
        <SummaryMetric
          label="Project health"
          value={data.healthLabel}
          detail="Highest current signal"
          divided={false}
        />
        <SummaryMetric
          label="Pipelines"
          value={String(data.pipelineCount)}
          detail={data.pipelineCount === 1 ? 'Configured pipeline' : 'Configured pipelines'}
        />
        <SummaryMetric
          label="Builds"
          value={String(data.buildCount)}
          detail={data.latestBuild ? `Latest ${data.latestBuild.number}` : 'No build history'}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
              <BlockerIcon tone={data.healthTone} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Highest blocker
                </span>
                <HealthBadge tone={data.healthTone}>{data.healthLabel}</HealthBadge>
              </div>
              <h3 className="mt-2 text-lg font-semibold">{data.blocker}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {data.blockerDetail}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <PrimaryBlockerActions {...props} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Recent build activity</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Newest events for Storefront
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => props.onOpenAction('Builds')}
            >
              View builds
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          </div>
          <div className="divide-y">
            {data.activity.map((item) => (
              <button
                type="button"
                key={`${item.title}-${item.time}`}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                onClick={() => props.onOpenAction(item.title)}
              >
                <ToneDot tone={item.tone} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.time}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Install availability</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Newest signed build that can be shared
              </p>
            </div>
            {data.install ? <Badge variant="success">Ready</Badge> : null}
          </div>
          {data.install ? (
            <div className="mt-5">
              <div className="text-xl font-semibold">{data.install.version}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {data.install.build} · {data.install.platform}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {data.install.note}
              </p>
            </div>
          ) : null}
          <div className="mt-5">
            <InstallActions
              data={data}
              onInstall={props.onInstall}
              onCopyLink={props.onCopyLink}
              onShare={props.onShare}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
  divided = true,
}: {
  label: string
  value: string
  detail: string
  divided?: boolean
}) {
  return (
    <div className={divided ? 'border-t p-4 sm:border-t-0 sm:border-l' : 'p-4'}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}
