import { useRef } from 'react'

import type { Project } from '@/lib/types'
import RepositoryAvatar from '@/components/repository-avatar'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'

export default function QaProjectPicker({
  hasMoreProjects,
  isFetchingMoreProjects,
  onLoadMoreProjects,
  onOpenChange,
  onProjectChange,
  open,
  project,
  projects,
}: {
  hasMoreProjects: boolean
  isFetchingMoreProjects: boolean
  onLoadMoreProjects: () => void
  onOpenChange: (open: boolean) => void
  onProjectChange: (projectId: string) => void
  open: boolean
  project: Project
  projects: Array<Project>
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <Combobox
      items={projects}
      value={project}
      open={open}
      onOpenChange={onOpenChange}
      onValueChange={(nextProject) => {
        if (nextProject) onProjectChange(nextProject.id)
      }}
      itemToStringLabel={(item) => item.name}
    >
      <ComboboxTrigger
        ref={triggerRef}
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-48 min-w-0 justify-between px-2 font-normal"
            aria-label={`Choose app, currently ${project.name}`}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <RepositoryAvatar
            fullName={project.repository_full_name ?? project.name}
            avatarUrl={project.repository_avatar_url}
            repositoryId={project.repository_id}
            provider={project.repository_provider}
            size="sm"
          />
          <span className="truncate">{project.name}</span>
        </span>
      </ComboboxTrigger>
      <ComboboxContent
        anchor={triggerRef}
        className="w-72 max-w-[calc(100vw-2rem)] bg-popover"
      >
        <ComboboxInput
          autoFocus
          className="w-auto"
          placeholder="Search apps"
          aria-label="Search apps"
        />
        <ComboboxEmpty>No matching apps.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.id} value={item}>
              <RepositoryAvatar
                fullName={item.repository_full_name ?? item.name}
                avatarUrl={item.repository_avatar_url}
                repositoryId={item.repository_id}
                provider={item.repository_provider}
                size="sm"
              />
              <span className="truncate">{item.name}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
        {hasMoreProjects ? (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={isFetchingMoreProjects}
              onClick={onLoadMoreProjects}
            >
              {isFetchingMoreProjects ? 'Loading more…' : 'Load more apps'}
            </Button>
          </div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  )
}
