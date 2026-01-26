'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  useGitHubApp,
  useGitHubInstallations,
  useGitHubSetupStatus,
  getGitHubManifest,
  syncGitHubInstallations,
  deleteGitHubApp,
} from '@/lib/api/github'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateTime } from '@/lib/format'
import { validateExternalUrl } from '@/lib/url'
import { toast } from 'sonner'
import {
  ArrowLeft02Icon,
  GithubIcon,
  Add01Icon,
  RefreshIcon,
  Delete01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  LinkSquare01Icon,
  UserIcon,
  Building01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export default function GitHubSettingsPage() {
  const { data: app, isLoading: appLoading, mutate: mutateApp } = useGitHubApp()
  const { data: installations, isLoading: installationsLoading, mutate: mutateInstallations } = useGitHubInstallations()

  const [setupState, setSetupState] = useState<string | null>(null)
  const [awaitingInstallation, setAwaitingInstallation] = useState(false)
  const setupWindowRef = useRef<Window | null>(null)
  const windowCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const installationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [starting, setStarting] = useState(false)

  // Poll for setup status when in setup flow
  const { data: setupStatus, mutate: mutateSetupStatus } = useGitHubSetupStatus(setupState, !!setupState)

  // Cleanup function for setup flow
  const cleanupSetupFlow = useCallback(() => {
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current)
      windowCheckIntervalRef.current = null
    }
    if (installationCheckIntervalRef.current) {
      clearInterval(installationCheckIntervalRef.current)
      installationCheckIntervalRef.current = null
    }
    setupWindowRef.current = null
    setAwaitingInstallation(false)
  }, [])

  // Handle setup completion - runs whenever setupStatus changes (even in background)
  useEffect(() => {
    if (!setupStatus) return

    if (setupStatus.status === 'completed') {
      // App was created, but we need to check if installation is done too
      // Start polling for installations
      setAwaitingInstallation(true)
    } else if (setupStatus.status === 'failed') {
      setupWindowRef.current?.close()
      cleanupSetupFlow()
      toast.error(setupStatus.message || 'Setup failed')
      setSetupState(null)
    } else if (setupStatus.status === 'expired') {
      setupWindowRef.current?.close()
      cleanupSetupFlow()
      toast.error('Setup session expired')
      setSetupState(null)
    }
  }, [setupStatus, cleanupSetupFlow])

  // Poll for installations after app is created
  useEffect(() => {
    if (!awaitingInstallation) return

    // Check immediately
    const checkInstallations = async () => {
      const latestApp = await mutateApp()
      if (latestApp?.installations_count && latestApp.installations_count > 0) {
        // Installation is done, close the window
        setupWindowRef.current?.close()
        cleanupSetupFlow()
        toast.success('GitHub App configured successfully!')
        setSetupState(null)
        mutateInstallations()
      }
    }

    checkInstallations()

    // Keep polling every 2 seconds for installations
    installationCheckIntervalRef.current = setInterval(checkInstallations, 2000)

    return () => {
      if (installationCheckIntervalRef.current) {
        clearInterval(installationCheckIntervalRef.current)
        installationCheckIntervalRef.current = null
      }
    }
  }, [awaitingInstallation, mutateApp, mutateInstallations, cleanupSetupFlow])

  // Monitor if the setup window was closed manually
  useEffect(() => {
    if (!setupState) {
      cleanupSetupFlow()
      return
    }

    // Check every second if the window was closed
    windowCheckIntervalRef.current = setInterval(async () => {
      if (setupWindowRef.current?.closed) {
        // Window was closed by user
        if (awaitingInstallation) {
          // App was created, check if installation was completed
          const latestApp = await mutateApp()
          if (!latestApp?.installations_count || latestApp.installations_count === 0) {
            // No installations - user closed without installing
            cleanupSetupFlow()
            setSetupState(null)
            toast.info('Setup cancelled - please install the app to complete setup')
          }
          // If installations exist, the installation check effect will handle it
        } else {
          // Still in app creation phase, check status
          const latestStatus = await mutateSetupStatus()
          if (!latestStatus || latestStatus.status === 'pending') {
            cleanupSetupFlow()
            setSetupState(null)
            toast.info('Setup cancelled - window was closed')
          }
          // If status is completed, the completion effect will handle it
        }
      }
    }, 1000)

    return () => {
      if (windowCheckIntervalRef.current) {
        clearInterval(windowCheckIntervalRef.current)
        windowCheckIntervalRef.current = null
      }
    }
  }, [setupState, awaitingInstallation, mutateSetupStatus, mutateApp, cleanupSetupFlow])

  const handleStartSetup = async () => {
    setStarting(true)
    try {
      const manifest = await getGitHubManifest()
      setSetupState(manifest.state)
      // Open the GitHub App creation page in a new window
      setupWindowRef.current = window.open(manifest.create_url, '_blank')
    } catch {
      toast.error('Failed to start GitHub setup')
    } finally {
      setStarting(false)
    }
  }

  const handleCancelSetup = useCallback(() => {
    setupWindowRef.current?.close()
    cleanupSetupFlow()
    setSetupState(null)
    toast.info('Setup cancelled')
  }, [cleanupSetupFlow])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncGitHubInstallations()
      toast.success(`Synced ${result.installations_synced} installations, ${result.repositories_synced} repositories`)
      mutateApp()
      mutateInstallations()
    } catch (error) {
      // Check if the app was deleted from GitHub
      if (error && typeof error === 'object' && 'code' in error && error.code === 'APP_DELETED') {
        toast.error('GitHub App was deleted. Configuration has been cleaned up.')
        mutateApp()
        mutateInstallations()
      } else {
        toast.error('Failed to sync installations')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteGitHubApp()
      toast.success('GitHub App removed')
      mutateApp()
      mutateInstallations()
    } catch {
      toast.error('Failed to remove GitHub App')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (appLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/settings" />} aria-label="Back to settings">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <CardSkeleton />
      </div>
    )
  }

  const isConfigured = app?.configured

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/settings" />}>
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub Integration</h1>
          <p className="text-muted-foreground">
            Configure your GitHub App connection
          </p>
        </div>
      </div>

      {/* Setup in progress */}
      {setupState && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-primary" />
              <CardTitle>
                {awaitingInstallation ? 'Waiting for Installation' : 'Setting up GitHub App'}
              </CardTitle>
            </div>
            <CardDescription>
              {awaitingInstallation
                ? 'App created! Complete the installation in the opened window.'
                : 'Complete the setup in the opened window. This page will update automatically.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Status: {awaitingInstallation
                ? 'Waiting for you to install the app on your account…'
                : (setupStatus?.message ?? 'Waiting for GitHub…')}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleCancelSetup}
            >
              Cancel Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* App Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                <HugeiconsIcon icon={GithubIcon} className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>GitHub App</CardTitle>
                <CardDescription>
                  {isConfigured
                    ? `Connected as ${app.app_name}`
                    : 'No GitHub App configured'}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                isConfigured
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }
            >
              <HugeiconsIcon
                icon={isConfigured ? CheckmarkCircle02Icon : GithubIcon}
                className="mr-1 h-3 w-3"
              />
              {isConfigured ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <div className="space-y-4">
              <div className="grid gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App Name</span>
                  <span className="font-medium">{app.app_name}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App ID</span>
                  <code className="font-mono">{app.app_id}</code>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Installations</span>
                  <span>{app.installations_count ?? 0}</span>
                </div>
                {app.created_at && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connected</span>
                      <span>{formatDateTime(app.created_at)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {validateExternalUrl(app.html_url) && (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={validateExternalUrl(app.html_url)!} target="_blank" rel="noopener noreferrer" />}
                  >
                    <HugeiconsIcon icon={LinkSquare01Icon} className="mr-2 h-4 w-4" />
                    View on GitHub
                  </Button>
                )}
                <Button variant="outline" onClick={handleSync} disabled={syncing}>
                  <HugeiconsIcon
                    icon={RefreshIcon}
                    className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
                  />
                  {syncing ? 'Syncing…' : 'Sync'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect a GitHub App to receive webhooks for push events, pull requests, and more.
                The setup wizard will guide you through creating a new GitHub App.
              </p>
              <Button onClick={handleStartSetup} disabled={starting || !!setupState}>
                {starting ? (
                  <>
                    <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                    Setup GitHub App
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installations */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Installations</CardTitle>
                <CardDescription>
                  Organizations and users that have installed your app
                </CardDescription>
              </div>
              {app.app_slug && (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href={`https://github.com/apps/${app.app_slug}/installations/new`} target="_blank" rel="noopener noreferrer" />}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                  Add Installation
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {installationsLoading ? (
              <TableSkeleton rows={3} />
            ) : !installations?.installations || installations.installations.length === 0 ? (
              <EmptyState
                icon={<HugeiconsIcon icon={GithubIcon} className="h-10 w-10" />}
                title="No installations"
                description="Install your GitHub App on an organization or personal account to get started."
                action={
                  app.app_slug && (
                    <Button
                      nativeButton={false}
                      render={<a href={`https://github.com/apps/${app.app_slug}/installations/new`} target="_blank" rel="noopener noreferrer" />}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                      Install App
                    </Button>
                  )
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Repositories</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installations.installations.map((installation) => (
                    <TableRow key={installation.installation_id}>
                      <TableCell className="font-medium">
                        {installation.account_login}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <HugeiconsIcon
                            icon={installation.account_type === 'Organization' ? Building01Icon : UserIcon}
                            className="h-4 w-4 text-muted-foreground"
                          />
                          {installation.account_type}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {installation.repository_selection}
                      </TableCell>
                      <TableCell>
                        <Badge variant={installation.is_active ? 'default' : 'secondary'}>
                          {installation.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Remove GitHub App"
        description="Are you sure you want to remove the GitHub App? This will disconnect all installations and you'll need to set up a new app."
        confirmText="Remove"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
