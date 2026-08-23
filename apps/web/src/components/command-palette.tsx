import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CommandLineIcon,
  FolderLibraryIcon,
  Home01Icon,
} from '@hugeicons/core-free-icons'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useProjects } from '@/hooks/use-projects'
import { useAuthStore } from '@/stores/auth-store'
import { useHasPermission } from '@/hooks/use-permissions'
import { settingsPaletteItemsForRole } from '@/components/settings/settings-navigation'
import type { Project } from '@oore/client/models'

const EMPTY_PROJECTS: Array<Project> = []

interface PaletteItem {
  id: string
  label: string
  icon: typeof Home01Icon
  action: () => void
  keywords?: string
}

export default function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)

  const isQaViewer = authUser?.role === 'qa_viewer'
  const canWriteProjects = useHasPermission('projects:write')

  const { data: projectsData } = useProjects(
    { limit: 50 },
    { enabled: !isQaViewer },
  )
  const projects = projectsData?.projects ?? EMPTY_PROJECTS

  function go(to: string) {
    onOpenChange(false)
    void navigate({ to })
  }

  const navItems: Array<PaletteItem> = [
    ...(!isQaViewer
      ? [
          {
            id: 'nav-dashboard',
            label: 'Overview',
            icon: Home01Icon,
            action: () => go('/'),
            keywords: 'home dashboard',
          },
          {
            id: 'nav-projects',
            label: 'Projects',
            icon: FolderLibraryIcon,
            action: () => go('/projects'),
            keywords: 'repositories repos',
          },
        ]
      : []),
    {
      id: 'nav-builds',
      label: 'Builds',
      icon: CommandLineIcon,
      action: () => go('/builds'),
      keywords: 'queue history runs',
    },
  ]

  const settingsItems: Array<PaletteItem> = settingsPaletteItemsForRole(
    authUser?.role,
  ).map((item) => ({
    ...item,
    action: () => go(item.to),
  }))

  const actionItems: Array<PaletteItem> = canWriteProjects
    ? [
        {
          id: 'action-new-project',
          label: 'Create new project',
          icon: FolderLibraryIcon,
          action: () => go('/projects?openCreate=1'),
          keywords: 'add new project create',
        },
      ]
    : []

  const projectItems: Array<PaletteItem> = (isQaViewer ? [] : projects).map(
    (project) => ({
      id: `project-${project.id}`,
      label: project.name,
      icon: FolderLibraryIcon,
      action: () => go(`/projects/${project.id}`),
      keywords: project.description ?? '',
    }),
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput
          placeholder={
            isQaViewer
              ? 'Search builds and pages...'
              : 'Search projects, pages, actions...'
          }
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  keywords={item.keywords ? [item.keywords] : undefined}
                  onSelect={() => item.action()}
                >
                  <HugeiconsIcon
                    icon={Icon}
                    size={16}
                    className="text-muted-foreground"
                  />
                  {item.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
          {settingsItems.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Settings">
                {settingsItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      keywords={item.keywords ? [item.keywords] : undefined}
                      onSelect={() => item.action()}
                    >
                      <HugeiconsIcon
                        icon={Icon}
                        size={16}
                        className="text-muted-foreground"
                      />
                      {item.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          ) : null}
          {actionItems.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                {actionItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      keywords={item.keywords ? [item.keywords] : undefined}
                      onSelect={() => item.action()}
                    >
                      <HugeiconsIcon
                        icon={Icon}
                        size={16}
                        className="text-muted-foreground"
                      />
                      {item.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          ) : null}
          {projectItems.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Projects">
                {projectItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      keywords={item.keywords ? [item.keywords] : undefined}
                      onSelect={() => item.action()}
                    >
                      <HugeiconsIcon
                        icon={Icon}
                        size={16}
                        className="text-muted-foreground"
                      />
                      {item.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
