import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AppleIcon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Key01Icon,
  LinkSquare02Icon,
} from '@hugeicons/core-free-icons'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import {
  SettingsSection,
  SettingsSurface,
} from '@/components/settings/settings-section'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  useAppleAccount,
  useAppleAccountOperation,
  useRemoveAppleAccount,
  useSelectAppleApp,
} from '@/hooks/use-apple-account'
import { useApiContext } from '@/hooks/use-api-context'
import { connectAppleAccount, getApiErrorMessage } from '@/lib/api'
import {
  getActiveInstanceOrRedirect,
  requireInstanceRoleOrRedirect,
} from '@/lib/instance-context'
import { PageMeta } from '@/lib/seo'
import { toast } from '@/lib/toast'
import type { AppleAppSummary } from '@/lib/types'

const MAX_KEY_BYTES = 64 * 1024

const appleAccountSchema = z.object({
  keyId: z
    .string()
    .trim()
    .min(1, 'Enter the key ID.')
    .max(128, 'The key ID is too long.')
    .regex(/^[A-Za-z0-9-]+$/, 'Enter the key ID shown by Apple.'),
  issuerId: z
    .string()
    .trim()
    .min(1, 'Enter the issuer ID.')
    .max(128, 'The issuer ID is too long.')
    .regex(/^[A-Za-z0-9-]+$/, 'Enter the issuer ID shown by Apple.'),
  privateKeyFile: z
    .custom<File>((value) => value instanceof File, 'Choose the .p8 file.')
    .refine(
      (file) => file instanceof File && file.size <= MAX_KEY_BYTES,
      'The .p8 file is too large.',
    ),
})

type AppleAccountFormValues = z.infer<typeof appleAccountSchema>

export const Route = createFileRoute('/settings/apple')({
  staticData: {
    breadcrumb: {
      title: 'Apple account',
    },
  },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireInstanceRoleOrRedirect(instance.id, ['owner'])
  },
  component: AppleAccountPage,
})

function AppleAccountPage() {
  const { baseUrl, token } = useApiContext()
  const accountQuery = useAppleAccount()
  const [operationId, setOperationId] = useState<string | null>(null)
  const operationQuery = useAppleAccountOperation(operationId)
  const selectMutation = useSelectAppleApp()
  const removeMutation = useRemoveAppleAccount()
  const [connectPending, setConnectPending] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [showReplaceForm, setShowReplaceForm] = useState(false)
  const account = accountQuery.data
  const operation = operationQuery.data
  const refetchAccount = accountQuery.refetch

  useEffect(() => {
    if (operation?.status === 'succeeded') {
      void refetchAccount()
      setShowReplaceForm(false)
    }
  }, [operation?.status, refetchAccount])

  const selectedApp = useMemo(
    () => account?.apps.find((app) => app.id === account.selectedAppId) ?? null,
    [account],
  )

  async function handleConnect(values: AppleAccountFormValues) {
    if (!baseUrl || !token) {
      setConnectError('Sign in again before you connect Apple.')
      return false
    }
    setConnectPending(true)
    setConnectError(null)
    try {
      const privateKeyPem = await values.privateKeyFile.text()
      const response = await connectAppleAccount(baseUrl, token, {
        keyId: values.keyId.trim(),
        issuerId: values.issuerId.trim(),
        privateKeyPem,
      })
      setOperationId(response.operationId)
      toast.success('Apple account check started')
      return true
    } catch (error) {
      setConnectError(
        getApiErrorMessage(error, {
          apple_account_invalid: 'Check the key ID and issuer ID.',
          apple_key_invalid: 'Choose the .p8 file downloaded from Apple.',
          apple_connection_in_progress:
            'Another Apple account check is already running.',
        }),
      )
      return false
    } finally {
      setConnectPending(false)
    }
  }

  function handleSelect(app: AppleAppSummary | null) {
    if (!app || app.id === account?.selectedAppId) return
    selectMutation.mutate(
      { appId: app.id },
      {
        onSuccess: () => toast.success(`${app.name} selected`),
        onError: (error) =>
          toast.error(
            getApiErrorMessage(error, {
              apple_app_unknown: 'Apple did not return that app.',
            }),
          ),
      },
    )
  }

  function handleRemove() {
    removeMutation.mutate(undefined, {
      onSuccess: () => {
        setOperationId(null)
        setShowReplaceForm(false)
        toast.success('Apple account removed')
      },
      onError: (error) =>
        toast.error(getApiErrorMessage(error, { store_error: 'Try again.' })),
    })
  }

  return (
    <PageLayout width="wide">
      <PageMeta title="Apple account" noindex />
      <PageHeader
        title="Apple account"
        description="Connect App Store Connect once, then let Oore handle Apple release work."
      />

      {accountQuery.isLoading ? (
        <AppleAccountSkeleton />
      ) : accountQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Apple account could not load</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{accountQuery.error.message}</span>
            <Button
              variant="outline"
              onClick={() => void accountQuery.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : account?.connected && !showReplaceForm ? (
        <ConnectedAppleAccount
          accountKeyId={account.keyId ?? 'Unknown'}
          apps={account.apps}
          removePending={removeMutation.isPending}
          selectedApp={selectedApp}
          selectPending={selectMutation.isPending}
          onRemove={handleRemove}
          onReplace={() => setShowReplaceForm(true)}
          onSelect={handleSelect}
        />
      ) : (
        <ConnectAppleAccountForm
          error={connectError}
          operation={operation}
          operationLoading={operationQuery.isFetching}
          pending={connectPending}
          replacing={account?.connected === true}
          onCancel={
            account?.connected ? () => setShowReplaceForm(false) : undefined
          }
          onSubmit={handleConnect}
        />
      )}
    </PageLayout>
  )
}

function ConnectAppleAccountForm({
  error,
  onCancel,
  onSubmit,
  operation,
  operationLoading,
  pending,
  replacing,
}: {
  error: string | null
  onCancel?: () => void
  onSubmit: (values: AppleAccountFormValues) => Promise<boolean>
  operation:
    | {
        status: 'queued' | 'claimed' | 'running' | 'succeeded' | 'failed'
        errorMessage?: string
      }
    | undefined
  operationLoading: boolean
  pending: boolean
  replacing: boolean
}) {
  const form = useForm<AppleAccountFormValues>({
    resolver: zodResolver(appleAccountSchema),
    defaultValues: { keyId: '', issuerId: '' },
    mode: 'onBlur',
  })
  const operationActive =
    operation?.status === 'queued' ||
    operation?.status === 'claimed' ||
    operation?.status === 'running'
  const statusText =
    operation?.status === 'running'
      ? 'Oore is checking the key with Apple.'
      : operation?.status === 'claimed'
        ? 'The Mac runner is preparing the Apple tool.'
        : 'Oore is waiting for an available Mac runner.'

  return (
    <div className="space-y-7">
      <SettingsSection
        title={
          replacing ? 'Replace the Apple key' : 'Connect App Store Connect'
        }
        description={
          replacing
            ? 'The current key stays active unless this check succeeds.'
            : 'Oore checks the key before it saves the connection.'
        }
      >
        <SettingsSurface className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <HugeiconsIcon icon={AppleIcon} aria-hidden />
            </div>
            <div className="space-y-3 text-sm">
              <p className="font-medium">Get these three values from Apple</p>
              <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
                <li>
                  Open{' '}
                  <a
                    href="https://appstoreconnect.apple.com/access/integrations/api"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    App Store Connect API access
                    <HugeiconsIcon
                      icon={LinkSquare02Icon}
                      className="ml-1 inline size-3.5"
                      aria-hidden
                    />
                  </a>
                  .
                </li>
                <li>
                  Create a Team API key, then copy its key ID and issuer ID.
                </li>
                <li>
                  Download its .p8 file. Apple only offers this download once.
                </li>
              </ol>
              <p className="text-muted-foreground">
                Do not use an Individual API key. Oore encrypts the Team key and
                sends it only to the selected Apple tool for one job.
              </p>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Apple account check could not start</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {operationActive || operationLoading ? (
            <Alert>
              <Spinner />
              <AlertTitle>Checking Apple account</AlertTitle>
              <AlertDescription>{statusText}</AlertDescription>
            </Alert>
          ) : operation?.status === 'failed' ? (
            <Alert variant="destructive">
              <AlertTitle>Apple rejected this connection</AlertTitle>
              <AlertDescription>
                {operation.errorMessage ??
                  'Check the Team key details and try again.'}
              </AlertDescription>
            </Alert>
          ) : operation?.status === 'succeeded' ? (
            <Alert>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              <AlertTitle>Apple account connected</AlertTitle>
              <AlertDescription>
                Oore found your apps. Choose the app that this instance will
                use.
              </AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                if (await onSubmit(values)) {
                  form.reset({
                    keyId: values.keyId,
                    issuerId: values.issuerId,
                  })
                }
              })}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="keyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key ID</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="ABC123DEFG"
                          disabled={pending || operationActive}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The short ID shown beside the Team key.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="issuerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issuer ID</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="00000000-0000-0000-0000-000000000000"
                          disabled={pending || operationActive}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The issuer ID above the Team keys list.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="privateKeyFile"
                render={({ field: { onChange, ref } }) => (
                  <FormItem>
                    <FormLabel>Private key file</FormLabel>
                    <FormControl>
                      <Input
                        ref={ref}
                        type="file"
                        accept=".p8,application/pkcs8,text/plain"
                        disabled={pending || operationActive}
                        onChange={(event) => onChange(event.target.files?.[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Choose the AuthKey_*.p8 file from Apple. Oore never shows
                      its contents.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-wrap justify-end gap-2">
                {onCancel ? (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={pending || operationActive}>
                  {pending || operationActive ? (
                    <Spinner />
                  ) : (
                    <HugeiconsIcon icon={Key01Icon} />
                  )}
                  {operationActive
                    ? 'Checking Apple'
                    : replacing
                      ? 'Check new key'
                      : 'Connect Apple'}
                </Button>
              </div>
            </form>
          </Form>
        </SettingsSurface>
      </SettingsSection>
    </div>
  )
}

function ConnectedAppleAccount({
  accountKeyId,
  apps,
  onRemove,
  onReplace,
  onSelect,
  removePending,
  selectedApp,
  selectPending,
}: {
  accountKeyId: string
  apps: Array<AppleAppSummary>
  onRemove: () => void
  onReplace: () => void
  onSelect: (app: AppleAppSummary | null) => void
  removePending: boolean
  selectedApp: AppleAppSummary | null
  selectPending: boolean
}) {
  return (
    <div className="space-y-7">
      <SettingsSection
        title="Connection"
        description="This Team key passed an App Store Connect check."
      >
        <SettingsSurface className="flex flex-wrap items-center gap-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon icon={AppleIcon} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">App Store Connect</p>
              <Badge variant="success">Connected</Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              Key {accountKeyId}
            </p>
          </div>
          <Button variant="outline" onClick={onReplace}>
            Replace key
          </Button>
        </SettingsSurface>
      </SettingsSection>

      <SettingsSection
        title="App"
        description="Choose the Apple app that Oore will prepare and publish."
      >
        <SettingsSurface className="space-y-3">
          {apps.length === 0 ? (
            <Alert>
              <AlertTitle>No apps found</AlertTitle>
              <AlertDescription>
                This Team key cannot see any apps. Replace it with a key that
                can.
              </AlertDescription>
            </Alert>
          ) : (
            <Combobox
              items={apps}
              value={selectedApp}
              onValueChange={onSelect}
              itemToStringLabel={(app) => app.name}
              disabled={selectPending}
            >
              <ComboboxInput
                placeholder="Search apps"
                aria-label="Choose Apple app"
                className="w-full"
              >
                {selectPending ? <Spinner /> : null}
              </ComboboxInput>
              <ComboboxContent className="bg-popover">
                <ComboboxEmpty>No matching apps.</ComboboxEmpty>
                <ComboboxList>
                  {(app) => (
                    <ComboboxItem key={app.id} value={app}>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{app.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {app.bundleId}
                        </p>
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          )}
          {selectedApp ? (
            <p className="text-sm text-muted-foreground">
              Oore will use{' '}
              <span className="font-medium text-foreground">
                {selectedApp.name}
              </span>{' '}
              for the next Apple steps.
            </p>
          ) : apps.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Choose one app to finish this setup.
            </p>
          ) : null}
        </SettingsSurface>
      </SettingsSection>

      <SettingsSection
        title="Remove Apple account"
        description="This removes the encrypted key and stops new Apple work."
      >
        <SettingsSurface className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Existing build files stay unchanged. Oore removes the saved Team
            key.
          </p>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <HugeiconsIcon icon={Delete02Icon} />
              Remove account
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove the Apple account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Oore will delete the encrypted Team key and cancel any active
                  Apple account check.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep account</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={removePending}
                  onClick={onRemove}
                >
                  {removePending ? <Spinner /> : null}
                  Remove account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingsSurface>
      </SettingsSection>
    </div>
  )
}

function AppleAccountSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading Apple account">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
