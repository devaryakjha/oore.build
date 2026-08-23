import { isMatch, Link, useMatches, useParams } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { useBuild } from '@/hooks/use-builds'
import { usePipeline } from '@/hooks/use-pipelines'
import { useProject } from '@/hooks/use-projects'

type BreadcrumbEntity = 'project' | 'pipeline' | 'build'

export interface BreadcrumbTrailItem {
  entity?: BreadcrumbEntity
  href: string
  label: string
}

interface BreadcrumbEntityLabels {
  buildNumber?: number
  pipelineName?: string
  projectName?: string
}

export function resolveBreadcrumbLabel(
  item: BreadcrumbTrailItem,
  labels: BreadcrumbEntityLabels,
) {
  if (item.entity === 'project') {
    return labels.projectName?.trim() || item.label
  }
  if (item.entity === 'pipeline') {
    return labels.pipelineName?.trim() || item.label
  }
  if (item.entity === 'build' && labels.buildNumber !== undefined) {
    return `Build #${labels.buildNumber}`
  }
  return item.label
}

export function BreadcrumbTrail({
  items,
}: {
  items: Array<BreadcrumbTrailItem>
}) {
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1

          return [
            <BreadcrumbItem key={`${item.href}:item`} className="min-w-0">
              {isCurrent ? (
                <BreadcrumbPage
                  className="block max-w-44 truncate sm:max-w-64"
                  title={item.label}
                >
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={<Link to={item.href} />}
                  className="block max-w-36 truncate sm:max-w-48"
                  title={item.label}
                >
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>,
            !isCurrent && (
              <BreadcrumbSeparator
                key={`${item.href}:separator`}
                className="shrink-0"
              />
            ),
          ]
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function PageBreadcrumb() {
  const params = useParams({ strict: false })
  const projectQuery = useProject(params.projectId ?? '')
  const pipelineQuery = usePipeline(params.pipelineId ?? '')
  const buildQuery = useBuild(params.buildId ?? '', { refetchInterval: false })
  const labels: BreadcrumbEntityLabels = {
    projectName: projectQuery.data?.project.name,
    pipelineName: pipelineQuery.data?.pipeline.name,
    buildNumber: buildQuery.data?.build.build_number,
  }
  const breadcrumbs = useMatches({
    select: (matches) =>
      matches
        .filter((m) => isMatch(m, 'staticData.breadcrumb'))
        .flatMap((match) => {
          const breadcrumb = match.staticData?.breadcrumb
          return breadcrumb
            ? [
                {
                  entity: breadcrumb.entity,
                  href: match.pathname,
                  label: breadcrumb.title,
                },
              ]
            : []
        }),
  }).map((item) => ({
    ...item,
    label: resolveBreadcrumbLabel(item, labels),
  }))

  return <BreadcrumbTrail items={breadcrumbs} />
}
