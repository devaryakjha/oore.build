import { Suspense, lazy, useState } from 'react'
import { BriefcaseBusiness as WorkUpdateIcon } from 'lucide-react'
import { useRuntimeUpdates } from '@/hooks/use-runtime-updates'
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

const RuntimeUpdateDialog = lazy(() => import('./runtime-update-dialog'))

export default function RuntimeUpdateNotice() {
  const [open, setOpen] = useState(false)
  const updates = useRuntimeUpdates()
  const updateCount =
    Number(updates.frontendRelease.data?.update_available === true) +
    Number(updates.backendRelease.data?.update_available === true)

  return (
    <>
      <Collapsible open={updateCount > 0}>
        <CollapsibleContent className="ease-(--motion-ease-out) data-ending-style:translate-y-1 data-ending-style:duration-100 data-starting-style:translate-y-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant="outline"
                tooltip={`${updateCount} update${updateCount === 1 ? '' : 's'} available`}
                onClick={() => setOpen(true)}
              >
                <WorkUpdateIcon size={18} />
                <span>Updates available</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{updateCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>

      {open && updateCount > 0 ? (
        <Suspense fallback={null}>
          <RuntimeUpdateDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  )
}
