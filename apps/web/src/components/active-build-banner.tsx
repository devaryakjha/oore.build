import { Link } from '@tanstack/react-router'

import RepositoryAvatar from '@/components/repository-avatar'
import type { Build } from '@/lib/types'
import {
  getRunnerPolicyBlockLabel,
  getStatusVariant,
} from '@/lib/status-variants'
import { relativeTime } from '@/lib/format-utils'
import { Badge } from '@/components/ui/badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

interface ActiveBuildBannerProps {
  build: Build
}

export default function ActiveBuildBanner({ build }: ActiveBuildBannerProps) {
  const projectName = build.context?.project_name ?? build.project_id
  const detail = [
    build.context?.pipeline_name,
    build.branch,
    build.context?.runner_name,
    relativeTime(build.created_at),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Item
      variant="muted"
      size="default"
      className="min-h-16 border-border"
      render={
        <Link
          to="/builds/$buildId"
          params={{ buildId: build.id }}
          aria-label={`Open ${projectName} build #${build.build_number}`}
        />
      }
    >
      <ItemMedia>
        <RepositoryAvatar
          fullName={build.context?.repository_full_name ?? projectName}
          avatarUrl={build.context?.project_avatar_url}
          size="sm"
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {projectName}{' '}
          <span className="font-mono text-xs text-muted-foreground">
            #{build.build_number}
          </span>
        </ItemTitle>
        <ItemDescription>{detail}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {build.runner_policy_block_reason ? (
          <Badge variant="destructive">
            {getRunnerPolicyBlockLabel(build.runner_policy_block_reason)}
          </Badge>
        ) : null}
        <Badge variant={getStatusVariant(build.status)}>{build.status}</Badge>
      </ItemActions>
    </Item>
  )
}
