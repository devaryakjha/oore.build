'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { isAuthenticated } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { SWRConfig } from 'swr'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const swrConfig = useMemo(() => ({
    revalidateOnFocus: true,
    dedupingInterval: 1000, // 1 second - allows polling to work while preventing spam
    errorRetryCount: 3,
    onError: (error: { status?: number }) => {
      // Handle 401 errors by redirecting to login
      if (error?.status === 401) {
        router.replace('/login')
      }
    },
  }), [router])

  useEffect(() => {
    setMounted(true)
    if (!isAuthenticated()) {
      router.replace('/login')
    } else {
      setAuthenticated(true)
    }
  }, [router])

  // Show nothing while checking auth
  if (!mounted || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true" aria-label="Loading application">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold animate-pulse" aria-hidden="true">
          O
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <SWRConfig value={swrConfig}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </SWRConfig>
  )
}
