import { Download04Icon, Upload04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { lazy, Suspense, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { User } from '@/lib/types'
import { downloadUsersCsv } from './-user-csv'

const loadImportUsersDialog = () => import('./-import-users-dialog')
const ImportUsersDialog = lazy(loadImportUsersDialog)

export function UserCsvActions({ users }: { users: Array<User> }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <HugeiconsIcon
          icon={Upload04Icon}
          data-icon="inline-start"
          aria-hidden
        />
        Import
      </Button>
      <Button variant="outline" onClick={() => downloadUsersCsv(users)}>
        <HugeiconsIcon
          icon={Download04Icon}
          data-icon="inline-start"
          aria-hidden
        />
        Export
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <ImportUsersDialog
            existingEmails={
              new Set(users.map((user) => user.email.toLowerCase()))
            }
            open
            onOpenChange={setOpen}
          />
        </Suspense>
      ) : null}
    </>
  )
}
