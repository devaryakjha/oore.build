import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  MoreHorizontalCircle01Icon,
} from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ApiTokenActions({ onRevoke }: { onRevoke: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <span className="sr-only">Open menu</span>
        <HugeiconsIcon icon={MoreHorizontalCircle01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem variant="destructive" onClick={onRevoke}>
            <HugeiconsIcon icon={Cancel01Icon} />
            Revoke token
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
