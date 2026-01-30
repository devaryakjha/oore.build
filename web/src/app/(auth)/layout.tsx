'use client'

import { useEffect, useState } from 'react'
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold animate-pulse">
          O
        </div>
      </div>
    )
  }

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        dedupingInterval: 1000, // 1 second - allows polling to work while preventing spam
        errorRetryCount: 3,
        onError: (error) => {
          // Handle 401 errors by redirecting to login
          if (error?.status === 401) {
            router.replace('/login')
          }
        },
      }}
    >
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
