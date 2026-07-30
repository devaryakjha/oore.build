import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons'

import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function ProjectActionsMenu({
  canManage,
  open,
  onOpenChange,
  project,
}: {
  canManage: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${project.name}`}
            title="Project actions"
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalCircle01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            render={
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
              />
            }
          >
            Open project
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                search={{ tab: 'builds' }}
              />
            }
          >
            View builds
          </DropdownMenuItem>
          {canManage ? (
            <DropdownMenuItem
              render={
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  search={{ tab: 'settings' }}
                />
              }
            >
              Project settings
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
