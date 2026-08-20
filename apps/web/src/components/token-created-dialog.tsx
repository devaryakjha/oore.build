import { useState } from 'react'
import { toast } from '@/lib/toast'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'

import type { CreateApiTokenResponse } from '@oore/client/models'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

interface TokenCreatedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  response: CreateApiTokenResponse | null
}

export default function TokenCreatedDialog({
  open,
  onOpenChange,
  response,
}: TokenCreatedDialogProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!response) return
    void navigator.clipboard.writeText(response.token).then(() => {
      setCopied(true)
      toast.success('Token copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Token created</DialogTitle>
          <DialogDescription>
            Make sure to copy your token now. You won&apos;t be able to see it
            again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <InputGroup>
            <InputGroupInput
              value={response?.token ?? ''}
              readOnly
              aria-label="Created API token"
              className="font-mono text-xs"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="ghost"
                size="xs"
                aria-label={copied ? 'Copied' : 'Copy'}
                onClick={handleCopy}
              >
                <span className="grid">
                  <span
                    aria-hidden
                    className={cn(
                      'motion-gentle col-start-1 row-start-1 inline-flex items-center gap-1 transition-[transform,opacity]',
                      copied
                        ? 'scale-95 opacity-0 duration-100 ease-(--motion-ease-out)'
                        : 'scale-100 opacity-100 duration-150 ease-(--motion-ease-out)',
                    )}
                  >
                    <HugeiconsIcon icon={Copy01Icon} />
                    Copy
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'motion-gentle col-start-1 row-start-1 inline-flex items-center gap-1 transition-[transform,opacity]',
                      copied
                        ? 'scale-100 opacity-100 duration-150 ease-(--motion-ease-out)'
                        : 'scale-95 opacity-0 duration-100 ease-(--motion-ease-out)',
                    )}
                  >
                    <HugeiconsIcon icon={Tick02Icon} />
                    Copied
                  </span>
                </span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Alert>
            <AlertDescription>
              This token will not be shown again. Store it in a secure location.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
