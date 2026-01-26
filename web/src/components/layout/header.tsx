'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import { logout } from '@/lib/auth'
import { Logout03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Separator } from '@/components/ui/separator'

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 my-3 self-stretch" />
      <div className="flex-1" />
      <ThemeToggle />
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={logout}
        title="Logout"
      >
        <HugeiconsIcon icon={Logout03Icon} className="h-4 w-4" />
        <span className="sr-only">Logout</span>
      </Button>
    </header>
  )
}
