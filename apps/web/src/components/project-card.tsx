import { Link } from '@tanstack/react-router'
import { Play as PlayIcon, Settings as Setting07Icon } from 'lucide-react'

import type { Project } from '@/lib/types'
import { getStatusVariant } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import RepositoryAvatar from '@/components/repository-avatar'

interface ProjectCardProps {
  canOpenSettings: boolean
  canTriggerBuild: boolean
  project: Project
  lastBuildStatus?: string
  onPreloadTriggerBuild: () => void
  onTriggerBuild: (projectId: string) => void
}

export default function ProjectCard({
  canOpenSettings,
  canTriggerBuild,
  project,
  lastBuildStatus,
  onPreloadTriggerBuild,
  onTriggerBuild,
}: ProjectCardProps) {
  return (
    <Item variant="outline" className="h-full bg-card">
      <ItemMedia>
        <RepositoryAvatar
          fullName={project.repository_full_name ?? project.name}
          avatarUrl={project.repository_avatar_url}
          repositoryId={project.repository_id}
          provider={project.repository_provider}
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {project.name}
          </Link>
        </ItemTitle>
        <ItemDescription>
          {project.repository_full_name ??
            project.description ??
            'Local repository'}
        </ItemDescription>
      </ItemContent>
      {canOpenSettings ? (
        <ItemActions>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Open settings for ${project.name}`}
            title={`Open settings for ${project.name}`}
            render={
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                search={{ tab: 'settings' }}
              />
            }
            nativeButton={false}
          >
            <Setting07Icon />
          </Button>
        </ItemActions>
      ) : null}
      <ItemFooter className="pt-3">
        <Badge
          variant={
            lastBuildStatus ? getStatusVariant(lastBuildStatus) : 'outline'
          }
        >
          {lastBuildStatus ?? 'No builds yet'}
        </Badge>
        {canTriggerBuild ? (
          <Button
            variant="outline"
            onMouseEnter={onPreloadTriggerBuild}
            onFocus={onPreloadTriggerBuild}
            onClick={() => onTriggerBuild(project.id)}
          >
            <PlayIcon data-icon="inline-start" />
            Run build
          </Button>
        ) : null}
      </ItemFooter>
    </Item>
  )
}
