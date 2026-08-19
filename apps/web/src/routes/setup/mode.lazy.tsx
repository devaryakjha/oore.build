import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { useSetupPreferences, useSetupStatus } from '@/hooks/use-setup'
import { getApiErrorMessage } from '@/lib/api-client/api-error'
import { PageMeta } from '@/lib/seo'
import { useSetupStore } from '@/stores/setup-store'
import { SetupStepError } from '@/components/setup-route-components'

const modeSchema = z.object({
  mode: z.enum(['local', 'remote_oidc', 'remote_trusted']),
})

type ModeForm = z.infer<typeof modeSchema>

const MODE_COMPARISON: Array<{
  value: ModeForm['mode']
  label: string
  description: string
  technicalDetail: string
  terminalOnly?: boolean
}> = [
  {
    value: 'local',
    label: 'Use Oore on this Mac',
    description: 'For one person on this Mac, including through an SSH tunnel.',
    technicalDetail: 'Passwordless · loopback only',
  },
  {
    value: 'remote_oidc',
    label: 'Let people sign in with an identity provider',
    description:
      'For a team using Google, Microsoft Entra ID, Okta, Auth0, or another OIDC provider.',
    technicalDetail: 'Team sign-in · HTTPS required',
  },
  {
    value: 'remote_trusted',
    label: 'Use an existing trusted access proxy',
    description:
      'For Cloudflare Access, oauth2-proxy, or a similar proxy. Continue setup in the terminal.',
    technicalDetail: 'Terminal handoff · advanced proxy setup',
    terminalOnly: true,
  },
]

export const Route = createLazyFileRoute('/setup/mode')({
  component: SetupModeStep,
  errorComponent: SetupStepError,
})

function toModeValue(
  runtimeMode: 'local' | 'remote' | undefined,
  remoteAuthMode: 'oidc' | 'trusted_proxy' | undefined,
): ModeForm['mode'] {
  if (runtimeMode === 'local') return 'local'
  if (remoteAuthMode === 'trusted_proxy') return 'remote_trusted'
  return 'remote_oidc'
}

// oxlint-disable-next-line react/react-compiler
function SetupModeStep() {
  const navigate = useNavigate()
  const sessionToken = useSetupStore((s) => s.sessionToken)
  const { data: status } = useSetupStatus()
  const setupModeMutation = useSetupPreferences()

  useEffect(() => {
    if (
      status &&
      !status.is_configured &&
      status.runtime_mode === 'remote' &&
      status.remote_auth_mode === 'trusted_proxy'
    ) {
      void navigate({
        to: '/setup/trusted-proxy',
        viewTransition: { types: ['setup-forward'] },
      })
    }
  }, [navigate, status])

  const modeValues = status
    ? { mode: toModeValue(status.runtime_mode, status.remote_auth_mode) }
    : undefined

  const form = useForm<ModeForm>({
    resolver: zodResolver(modeSchema),
    defaultValues: {
      mode: toModeValue(status?.runtime_mode, status?.remote_auth_mode),
    },
    values: modeValues,
    mode: 'onBlur',
  })
  const selectedMode = form.watch('mode')

  const errorMessage = setupModeMutation.error
    ? getApiErrorMessage(setupModeMutation.error, {
        invalid_state:
          'This access choice cannot change after you create the owner account.',
        session_expired:
          'Your setup session has expired. Restart setup with a fresh bootstrap token.',
        invalid_session:
          'Your setup session is invalid. Restart setup from the token step.',
      })
    : null

  function onSubmit(values: ModeForm) {
    if (!sessionToken) return

    const runtimeMode = values.mode === 'local' ? 'local' : 'remote'
    const remoteAuthMode =
      values.mode === 'remote_trusted'
        ? 'trusted_proxy'
        : values.mode === 'remote_oidc'
          ? 'oidc'
          : undefined

    setupModeMutation.mutate(
      {
        sessionToken,
        runtimeMode,
        remoteAuthMode,
      },
      {
        onSuccess: () => {
          if (values.mode === 'local') {
            void navigate({
              to: '/setup/owner',
              viewTransition: { types: ['setup-forward'] },
            })
            return
          }
          if (values.mode === 'remote_trusted') {
            void navigate({
              to: '/setup/trusted-proxy',
              viewTransition: { types: ['setup-forward'] },
            })
            return
          }
          void navigate({
            to: '/setup/oidc',
            viewTransition: { types: ['setup-forward'] },
          })
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <PageMeta title="Choose Access" />
      <div className="space-y-1">
        <h2 className="text-lg font-medium">How will you use Oore?</h2>
        <p className="text-sm text-muted-foreground">
          Choose who can reach this instance and how they sign in.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Access choice</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={setupModeMutation.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {MODE_COMPARISON.find(
                          (mode) => mode.value === selectedMode,
                        )?.label ?? 'Choose how people access Oore'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">
                        Use Oore on this Mac
                      </SelectItem>
                      <SelectItem value="remote_oidc">
                        Let people sign in with an identity provider
                      </SelectItem>
                      <SelectItem value="remote_trusted">
                        Existing trusted access proxy (terminal only)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <ItemGroup aria-label="Access choice details">
            {MODE_COMPARISON.map((mode) => {
              const selected = selectedMode === mode.value
              return (
                <Item
                  key={mode.value}
                  variant={selected ? 'muted' : 'outline'}
                  size="sm"
                >
                  <ItemContent>
                    <ItemTitle>{mode.label}</ItemTitle>
                    <ItemDescription>
                      {mode.description}{' '}
                      {mode.terminalOnly ? (
                        <code className="font-mono text-xs">
                          {mode.technicalDetail}
                        </code>
                      ) : (
                        mode.technicalDetail
                      )}
                    </ItemDescription>
                  </ItemContent>
                  {selected || mode.terminalOnly ? (
                    <ItemActions>
                      <Badge variant="secondary">
                        {mode.terminalOnly ? 'Terminal only' : 'Selected'}
                      </Badge>
                    </ItemActions>
                  ) : null}
                </Item>
              )
            })}
          </ItemGroup>

          {selectedMode === 'remote_trusted' ? (
            <Alert>
              <AlertTitle>Terminal handoff after this step</AlertTitle>
              <AlertDescription>
                Click Continue first. Wait for the original terminal to say that
                setup is paused. The next page then gives you the command to
                run.
              </AlertDescription>
            </Alert>
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save your access choice</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={setupModeMutation.isPending}
          >
            {setupModeMutation.isPending ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
