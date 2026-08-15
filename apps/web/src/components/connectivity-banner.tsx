import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { WifiOff } from '@hugeicons/core-free-icons'
import { useMountEffect } from '@/hooks/use-mount-effect'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

export default function ConnectivityBanner() {
  const [offline, setOffline] = useState(
    globalThis.navigator ? !globalThis.navigator.onLine : false,
  )

  useMountEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  })

  return (
    <Collapsible open={offline} className="sticky top-0 z-40">
      <CollapsibleContent className="ease-(--motion-ease-out) data-ending-style:-translate-y-full data-ending-style:duration-100 data-starting-style:-translate-y-full">
        <Alert
          aria-live="assertive"
          className="place-content-center rounded-none border-x-0 border-t-0 border-destructive/30 bg-destructive/10 py-2 text-destructive"
          variant="destructive"
        >
          <HugeiconsIcon icon={WifiOff} aria-hidden />
          <AlertDescription className="text-destructive">
            You are offline
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  )
}
