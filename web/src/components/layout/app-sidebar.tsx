'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar'
import {
  Home01Icon,
  FolderLibraryIcon,
  PackageIcon,
  GitPullRequestIcon,
  Settings01Icon,
  GithubIcon,
  GitlabIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import { listEquals } from '@/lib/equality'

const mainNavItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: Home01Icon,
  },
  {
    title: 'Repositories',
    url: '/repositories',
    icon: FolderLibraryIcon,
  },
  {
    title: 'Builds',
    url: '/builds',
    icon: PackageIcon,
  },
  {
    title: 'Webhooks',
    url: '/webhooks',
    icon: GitPullRequestIcon,
  },
]

const settingsNavItems = [
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings01Icon,
  },
  {
    title: 'GitHub',
    url: '/settings/github',
    icon: GithubIcon,
  },
  {
    title: 'GitLab',
    url: '/settings/gitlab',
    icon: GitlabIcon,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (url: string) => listEquals(pathname.split('/'), url.split('/'))

  return (
    <Sidebar>
      <SidebarHeader className="h-14 border-b justify-center">
        <div className="flex items-center gap-2 px-2">
          <Image
            src="/icon.svg"
            alt="Oore"
            width={24}
            height={24}
          />
          <span className="font-semibold">Oore</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} />} isActive={isActive(item.url)}>
                    <HugeiconsIcon icon={item.icon} className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} />} isActive={isActive(item.url)}>
                    <HugeiconsIcon icon={item.icon} className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="p-2 text-xs text-muted-foreground">
          <p>Oore CI/CD</p>
          <p>Self-hosted Flutter builds</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
