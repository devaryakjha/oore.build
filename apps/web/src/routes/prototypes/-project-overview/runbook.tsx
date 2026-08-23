import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons'
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

interface RunbookOverviewProps {
  data: ScenarioData
  queued: boolean
  onRunBuild: () => void
  onOpenAction: (label: string) => void
  onInstall: () => void
  onCopyLink: () => void
  onShare: () => void
}

export default function RunbookOverview(props: RunbookOverviewProps) {
  const { data } = props
  const nextAction = getNextAction(data)

  return (
    <div className="project-overview-enter mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Runbook
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          What should happen next?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {data.headline}
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-label="Project runbook" className="space-y-3">
          <RunbookStep
            number="1"
            label="Resolve the current blocker"
            title={data.blocker}
            detail={data.blockerDetail}
            active={data.healthTone === 'danger' || data.healthTone === 'warning'}
          >
            <PrimaryBlockerActions {...props} />
          </RunbookStep>

          <RunbookStep
            number="2"
            label="Confirm build outcome"
            title={data.latestBuild ? `${data.latestBuild.number} · ${data.latestBuild.status}` : 'No build recorded'}
            detail={
              data.latestBuild
                ? `${data.latestBuild.branch} · ${data.latestBuild.commit} · ${data.latestBuild.time}`
                : data.pipelineCount > 0
                  ? 'The configured pipeline has not run yet.'
                  : 'A build becomes available after a pipeline is configured.'
            }
            active={data.id === 'active' || data.id === 'no-builds'}
          >
            <Button
              variant="outline"
              onClick={() => props.onOpenAction(data.latestBuild ? 'Build details' : 'Pipelines')}
            >
              {data.latestBuild ? 'Open build' : 'Review pipelines'}
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          </RunbookStep>

          <RunbookStep
            number="3"
            label="Deliver a testable build"
            title={data.install ? `${data.install.version} is installable` : 'No installable build yet'}
            detail={
              data.install
                ? `${data.install.build} · ${data.install.platform} · ${data.install.note}`
                : 'A successful signed build will appear here with install and share actions.'
            }
            active={Boolean(data.install)}
            complete={Boolean(data.install)}
          >
            <InstallActions
              data={data}
              compact
              onInstall={props.onInstall}
              onCopyLink={props.onCopyLink}
              onShare={props.onShare}
            />
          </RunbookStep>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Project state</h3>
              <HealthBadge tone={data.healthTone}>{data.healthLabel}</HealthBadge>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Fact label="Pipelines" value={String(data.pipelineCount)} />
              <Fact label="Builds" value={String(data.buildCount)} />
              <Fact
                label="Latest build"
                value={data.latestBuild?.number ?? 'None'}
              />
              <Fact
                label="Installable"
                value={data.install?.build ?? 'None'}
              />
            </dl>
          </section>

          <section className="rounded-xl border bg-muted/35 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <HugeiconsIcon icon={Clock01Icon} className="size-4" />
              Next action
            </div>
            <div className="mt-2 text-sm font-semibold">{nextAction.title}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {nextAction.detail}
            </p>
          </section>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Latest activity</h3>
            </div>
            <div className="divide-y">
              {data.activity.slice(0, 3).map((item) => (
                <button
                  type="button"
                  key={`${item.title}-${item.time}`}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                  onClick={() => props.onOpenAction(item.title)}
                >
                  <ToneDot tone={item.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {item.time}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function RunbookStep({
  number,
  label,
  title,
  detail,
  active = false,
  complete = false,
  children,
}: {
  number: string
  label: string
  title: string
  detail: string
  active?: boolean
  complete?: boolean
  children: React.ReactNode
}) {
  return (
    <article className={active ? 'rounded-xl border border-primary/35 bg-card p-5 shadow-sm' : 'rounded-xl border bg-card p-5'}>
      <div className="flex gap-4">
        <div className={complete ? 'grid size-8 shrink-0 place-items-center rounded-full bg-success/15 text-success' : active ? 'grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground' : 'grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground'}>
          {complete ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> : number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </span>
            {active ? <Badge variant="outline">Current</Badge> : null}
          </div>
          <h3 className="mt-2 text-lg font-semibold">{title}</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {detail}
          </p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs font-medium">{value}</dd>
    </div>
  )
}

function getNextAction(data: ScenarioData) {
  if (data.id === 'no-pipeline') {
    return { title: 'Create a pipeline', detail: 'The connected repository is ready to import.' }
  }
  if (data.id === 'no-builds') {
    return { title: 'Run the first build', detail: 'Use Run build in the project header to verify the whole path.' }
  }
  if (data.id === 'blocked') {
    return { title: 'Restore a compatible runner', detail: 'Build #185 will start when Xcode 16 capacity returns.' }
  }
  if (data.id === 'active') {
    return { title: 'Watch the running build', detail: 'Compilation is at 68%; the live log has full detail.' }
  }
  return { title: 'Review build #185', detail: 'The older install-ready IPA remains safe to share.' }
}
