import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons'

import type { Build } from '@oore/client/models'
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

export default function BuildActionsMenu({ build }: { build: Build }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <span className="sr-only">Open menu</span>
        <HugeiconsIcon icon={MoreHorizontalCircle01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            render={
              <Link to="/builds/$buildId" params={{ buildId: build.id }} />
            }
          >
            Open build
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <Link
                to="/projects/$projectId"
                params={{ projectId: build.project_id }}
                search={{ tab: 'builds' }}
              />
            }
          >
            Open project builds
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
