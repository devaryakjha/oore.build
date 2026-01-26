'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  useGitLabCredentials,
  useGitLabSetupStatus,
  setupGitLab,
  deleteGitLabCredentials,
  refreshGitLabToken,
  registerGitLabApp,
} from '@/lib/api/gitlab'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateTime, formatDistanceToNow } from '@/lib/format'
import { toast } from 'sonner'
import {
  ArrowLeft02Icon,
  GitlabIcon,
  Add01Icon,
  RefreshIcon,
  Delete01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  AlertCircleIcon,
  Clock01Icon,
  LinkSquare01Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/lib/constants'

type DialogStep = 'instance-url' | 'register-app' | 'connecting'

function isGitLabCom(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname === 'gitlab.com' || hostname === 'www.gitlab.com'
  } catch {
    return false
  }
}

export default function GitLabSettingsPage() {
  const { data: credentials, isLoading, mutate } = useGitLabCredentials()

  const [setupState, setSetupState] = useState<string | null>(null)
  const setupWindowRef = useRef<Window | null>(null)
  const windowCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [dialogStep, setDialogStep] = useState<DialogStep>('instance-url')
  const [instanceUrl, setInstanceUrl] = useState('https://gitlab.com')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)

  // Poll for setup status
  const { data: setupStatus, mutate: mutateSetupStatus } = useGitLabSetupStatus(setupState, !!setupState)

  // Cleanup function for setup flow
  const cleanupSetupFlow = useCallback(() => {
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current)
      windowCheckIntervalRef.current = null
    }
    setupWindowRef.current = null
  }, [])

  // Handle setup completion - runs whenever setupStatus changes (even in background)
  useEffect(() => {
    if (!setupStatus) return

    if (setupStatus.status === 'completed') {
      // Close the setup window immediately
      setupWindowRef.current?.close()
      cleanupSetupFlow()
      toast.success('GitLab connected successfully!')
      setSetupState(null)
      resetDialog()
      mutate()
    } else if (setupStatus.status === 'failed') {
      setupWindowRef.current?.close()
      cleanupSetupFlow()
      toast.error(setupStatus.message || 'Setup failed')
      setSetupState(null)
      setDialogStep('instance-url')
    } else if (setupStatus.status === 'expired') {
      setupWindowRef.current?.close()
      cleanupSetupFlow()
      toast.error('Setup session expired')
      setSetupState(null)
      setDialogStep('instance-url')
    }
  }, [setupStatus, mutate, cleanupSetupFlow])

  // Monitor if the setup window was closed manually
  useEffect(() => {
    if (!setupState) {
      cleanupSetupFlow()
      return
    }

    // Check every second if the window was closed
    windowCheckIntervalRef.current = setInterval(async () => {
      if (setupWindowRef.current?.closed) {
        // Window was closed by user, force a status check
        const latestStatus = await mutateSetupStatus()

        // If status is still pending, user closed without completing - cancel the flow
        if (!latestStatus || latestStatus.status === 'pending') {
          cleanupSetupFlow()
          setSetupState(null)
          setDialogStep('instance-url')
          toast.info('Setup cancelled - window was closed')
        }
        // If status is completed/failed/expired, the other effect will handle it
      }
    }, 1000)

    return () => {
      if (windowCheckIntervalRef.current) {
        clearInterval(windowCheckIntervalRef.current)
        windowCheckIntervalRef.current = null
      }
    }
  }, [setupState, mutateSetupStatus, cleanupSetupFlow])

  const resetDialog = () => {
    setShowAddDialog(false)
    setDialogStep('instance-url')
    setInstanceUrl('https://gitlab.com')
    setClientId('')
    setClientSecret('')
  }

  const handleContinue = async () => {
    // Validate URL
    try {
      new URL(instanceUrl)
    } catch {
      toast.error('Please enter a valid URL')
      return
    }

    if (isGitLabCom(instanceUrl)) {
      // For gitlab.com, go directly to OAuth flow
      await handleStartSetup()
    } else {
      // For self-hosted, show the registration step
      setDialogStep('register-app')
    }
  }

  const handleRegisterAndConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Please enter both Client ID and Client Secret')
      return
    }

    setRegistering(true)
    try {
      await registerGitLabApp(instanceUrl, clientId.trim(), clientSecret.trim())
      toast.success('OAuth app registered')
      // Now start the OAuth flow
      await handleStartSetup()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register OAuth app'
      toast.error(message)
    } finally {
      setRegistering(false)
    }
  }

  const handleStartSetup = async () => {
    setDialogStep('connecting')
    try {
      const response = await setupGitLab({ instance_url: instanceUrl })
      setSetupState(response.state)
      // Open the GitLab authorization page
      setupWindowRef.current = window.open(response.auth_url, '_blank')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start GitLab setup'
      // Check if it's the "no OAuth app" error (self-hosted or gitlab.com without env vars)
      if (message.includes('No OAuth app registered') || message.includes('OORE_GITLAB_CLIENT_ID not set')) {
        toast.error('OAuth app not configured. Please register your GitLab OAuth app.')
        setDialogStep('register-app')
      } else {
        toast.error(message)
        setDialogStep('instance-url')
      }
    }
  }

  const handleCancelSetup = useCallback(() => {
    setupWindowRef.current?.close()
    cleanupSetupFlow()
    setSetupState(null)
    setDialogStep('instance-url')
    toast.info('Setup cancelled')
  }, [cleanupSetupFlow])

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      await deleteGitLabCredentials(deleteId, true)
      toast.success('GitLab credentials removed')
      mutate()
    } catch {
      toast.error('Failed to remove credentials')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const handleRefresh = async (credId: string, instanceUrl: string) => {
    setRefreshingId(credId)
    try {
      await refreshGitLabToken(instanceUrl)
      toast.success('Token refreshed')
      mutate()
    } catch {
      toast.error('Failed to refresh token')
    } finally {
      setRefreshingId(null)
    }
  }

  if (isLoading) {
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

  const hasCredentials = credentials && credentials.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/settings" />}>
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitLab Integration</h1>
          <p className="text-muted-foreground">
            Configure your GitLab OAuth connections
          </p>
        </div>
      </div>

      {/* Setup in progress (shown outside dialog when window is open) */}
      {setupState && !showAddDialog && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-primary" />
              <CardTitle>Connecting to GitLab</CardTitle>
            </div>
            <CardDescription>
              Complete the authorization in the opened window. This page will update automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Status: {setupStatus?.message ?? 'Waiting for GitLab authorization…'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleCancelSetup}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white">
                <HugeiconsIcon icon={GitlabIcon} className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>GitLab OAuth</CardTitle>
                <CardDescription>
                  {hasCredentials
                    ? `${credentials.length} instance(s) connected`
                    : 'No GitLab instances connected'}
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} disabled={!!setupState}>
              <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
              Add Instance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!hasCredentials ? (
            <EmptyState
              icon={<HugeiconsIcon icon={GitlabIcon} className="h-10 w-10" />}
              title="No GitLab connections"
              description="Connect your GitLab account to receive webhooks and access projects."
              action={
                <Button onClick={() => setShowAddDialog(true)}>
                  <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                  Connect GitLab
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {credentials.map((cred) => (
                <div key={cred.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cred.username}</span>
                        <Badge variant="outline" className="text-xs">
                          {new URL(cred.instance_url).hostname}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {cred.enabled_projects_count} projects enabled
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cred.needs_refresh ? (
                        <Badge variant="destructive" className="gap-1">
                          <HugeiconsIcon icon={AlertCircleIcon} className="h-3 w-3" />
                          Token Expired
                        </Badge>
                      ) : cred.token_expires_at ? (
                        <Badge variant="outline" className="gap-1">
                          <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                          Expires {formatDistanceToNow(cred.token_expires_at)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Instance URL</span>
                      <a
                        href={cred.instance_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {cred.instance_url}
                      </a>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User ID</span>
                      <code className="font-mono">{cred.user_id}</code>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connected</span>
                      <span>{formatDateTime(cred.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={cred.instance_url} target="_blank" rel="noopener noreferrer" />}
                    >
                      <HugeiconsIcon icon={LinkSquare01Icon} className="mr-2 h-3 w-3" />
                      Open GitLab
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefresh(cred.id, cred.instance_url)}
                      disabled={refreshingId === cred.id}
                    >
                      <HugeiconsIcon
                        icon={RefreshIcon}
                        className={cn('mr-2 h-3 w-3', refreshingId === cred.id && 'animate-spin')}
                      />
                      {refreshingId === cred.id ? 'Refreshing…' : 'Refresh Token'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(cred.id)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="mr-2 h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Instance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="sm:max-w-lg">
          {dialogStep === 'instance-url' && (
            <>
              <DialogHeader>
                <DialogTitle>Connect GitLab Instance</DialogTitle>
                <DialogDescription>
                  Enter the URL of your GitLab instance to connect.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="instance-url">Instance URL</Label>
                  <Input
                    id="instance-url"
                    placeholder="https://gitlab.com"
                    value={instanceUrl}
                    onChange={(e) => setInstanceUrl(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use https://gitlab.com for GitLab.com or enter your self-hosted instance URL.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>
                <Button onClick={handleContinue} disabled={!instanceUrl.trim()}>
                  Continue
                  <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogStep === 'register-app' && (
            <>
              <DialogHeader>
                <DialogTitle>Register OAuth Application</DialogTitle>
                <DialogDescription>
                  Self-hosted GitLab instances require an OAuth application.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <HugeiconsIcon icon={InformationCircleIcon} className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Create an OAuth application in GitLab:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Go to <strong>Admin Area → Applications</strong> (or User Settings → Applications)</li>
                        <li>Click <strong>New application</strong></li>
                        <li>Set Name to <strong>Oore CI</strong></li>
                        <li>Set Redirect URI to <code className="bg-muted px-1 py-0.5 rounded text-xs">{API_BASE_URL}/setup/gitlab/callback</code></li>
                        <li>Check the <strong>api</strong> scope</li>
                        <li>Click <strong>Save application</strong></li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-id">Application ID</Label>
                  <Input
                    id="client-id"
                    placeholder="Enter the Application ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-secret">Secret</Label>
                  <Input
                    id="client-secret"
                    type="password"
                    placeholder="Enter the Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    The secret is encrypted before storage and never exposed.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogStep('instance-url')}>
                  Back
                </Button>
                <Button
                  onClick={handleRegisterAndConnect}
                  disabled={registering || !clientId.trim() || !clientSecret.trim()}
                >
                  {registering ? (
                    <>
                      <HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
                      Registering…
                    </>
                  ) : (
                    <>
                      Register & Connect
                      <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogStep === 'connecting' && (
            <>
              <DialogHeader>
                <DialogTitle>Connecting to GitLab</DialogTitle>
                <DialogDescription>
                  Complete the authorization in the opened window.
                </DialogDescription>
              </DialogHeader>
              <div className="py-8 flex flex-col items-center justify-center gap-4">
                <HugeiconsIcon icon={Loading03Icon} className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center">
                  {setupStatus?.message ?? 'Waiting for GitLab authorization…'}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancelSetup}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remove GitLab Connection"
        description="Are you sure you want to remove this GitLab connection? All enabled projects will be disconnected."
        confirmText="Remove"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
