import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useSetupStatus,
  useSetupTrustedProxyConfigure,
} from '@/hooks/use-setup'
import { getApiErrorMessage } from '@/lib/api'
import { PageMeta } from '@/lib/seo'
import { loadTrustedProxySetupPrefill } from '@/lib/setup-prefill'
import { useSetupStore } from '@/stores/setup-store'
import { useSetupModeGuard } from '@/hooks/use-setup-route-transitions'
import { SetupStepError } from '@/components/setup-route-components'

const trustedProxyPresetSchema = z.enum([
  'cloudflare_access',
  'generic',
  'warpgate',
  'custom',
])
type TrustedProxyPreset = z.infer<typeof trustedProxyPresetSchema>

const presetHeaders: Record<
  Exclude<TrustedProxyPreset, 'custom' | 'cloudflare_access'>,
  string
> = {
  generic: 'x-oore-user-email',
  warpgate: 'x-warpgate-username',
}

const trustedProxySchema = z
  .object({
    proxyPreset: trustedProxyPresetSchema,
    ownerEmail: z.email('Enter a valid owner email'),
    userEmailHeader: z.string().optional(),
    trustedProxyCidrs: z.string().optional(),
    sharedSecret: z.string().optional(),
    cloudflareTeamDomain: z.string().optional(),
    cloudflareAudience: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (values.proxyPreset === 'cloudflare_access') {
      if (!values.cloudflareTeamDomain?.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['cloudflareTeamDomain'],
          message: 'Enter your Cloudflare Access team domain',
        })
      }
      if (!values.cloudflareAudience?.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['cloudflareAudience'],
          message: 'Enter the application audience tag',
        })
      }
    } else if (!values.userEmailHeader?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['userEmailHeader'],
        message: 'Header name is required',
      })
    } else if (!values.sharedSecret?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['sharedSecret'],
        message: 'Generate or enter a shared secret',
      })
    }
  })

type TrustedProxyForm = z.infer<typeof trustedProxySchema>

export const Route = createLazyFileRoute('/setup/trusted-proxy')({
  component: SetupTrustedProxyStep,
  errorComponent: SetupStepError,
})

function parseCidrs(raw: string | undefined): Array<string> {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function generateSharedSecret(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function headerForPreset(preset: TrustedProxyPreset): string | undefined {
  return preset === 'custom' || preset === 'cloudflare_access'
    ? undefined
    : presetHeaders[preset]
}

function SetupTrustedProxyStep() {
  const navigate = useNavigate()
  const sessionToken = useSetupStore((s) => s.sessionToken)
  const setupInstanceId = useSetupStore((s) => s.instanceId)
  const configureMutation = useSetupTrustedProxyConfigure()
  const { data: status } = useSetupStatus()
  const prefill = loadTrustedProxySetupPrefill(setupInstanceId)
  const prefillPreset = prefill?.proxyPreset ?? 'generic'
  const prefillHeader =
    prefill?.userEmailHeader ??
    headerForPreset(prefillPreset) ??
    presetHeaders.generic

  const form = useForm<TrustedProxyForm>({
    resolver: zodResolver(trustedProxySchema),
    defaultValues: {
      proxyPreset: prefillPreset,
      ownerEmail: prefill?.ownerEmail ?? '',
      userEmailHeader: prefillHeader,
      trustedProxyCidrs: '',
      sharedSecret: '',
      cloudflareTeamDomain: '',
      cloudflareAudience: '',
    },
    mode: 'onBlur',
  })

  useSetupModeGuard(status, 'trusted_proxy')
  const proxyPreset = form.watch('proxyPreset')

  const errorMessage = configureMutation.error
    ? getApiErrorMessage(configureMutation.error, {
        invalid_input:
          'Trusted proxy settings are invalid. Check owner email, header name, and CIDR values.',
        mode_restricted:
          'Switch setup mode to Remote (Trusted Proxy) before configuring this step.',
        session_expired:
          'Your setup session has expired. Restart setup with a fresh bootstrap token.',
        invalid_session:
          'Your setup session is invalid. Restart setup from the token step.',
      })
    : null

  function onSubmit(values: TrustedProxyForm) {
    if (!sessionToken) return

    configureMutation.mutate(
      {
        sessionToken,
        proofProvider:
          values.proxyPreset === 'cloudflare_access'
            ? 'cloudflare_access'
            : 'shared_secret',
        userEmailHeader: values.userEmailHeader?.trim(),
        setupOwnerEmail: values.ownerEmail.trim().toLowerCase(),
        trustedProxyCidrs: parseCidrs(values.trustedProxyCidrs),
        sharedSecret: values.sharedSecret?.trim() || undefined,
        cloudflareTeamDomain: values.cloudflareTeamDomain?.trim() || undefined,
        cloudflareAudience: values.cloudflareAudience?.trim() || undefined,
      },
      {
        onSuccess: () => {
          void navigate({
            to: '/setup/owner',
            viewTransition: { types: ['setup-forward'] },
          })
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <PageMeta title="Setup Trusted Proxy" />
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Access provider</h2>
        <p className="text-sm text-muted-foreground">
          Choose how the service in front of Oore proves each user identity.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="ownerEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial owner email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="owner@example.com"
                    autoComplete="email"
                    disabled={configureMutation.isPending}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  The first owner claim must arrive from this same
                  proxy-authenticated email.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="proxyPreset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proxy preset</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      const preset = value as TrustedProxyPreset
                      field.onChange(preset)
                      const header = headerForPreset(preset)
                      if (header) {
                        form.setValue('userEmailHeader', header, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    }}
                    disabled={configureMutation.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose proxy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloudflare_access">
                        Cloudflare Access
                      </SelectItem>
                      <SelectItem value="generic">Generic proxy</SelectItem>
                      <SelectItem value="warpgate">Warpgate</SelectItem>
                      <SelectItem value="custom">Custom header</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Cloudflare Access uses a signed identity token. Other choices
                  use a trusted header and shared secret.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {proxyPreset !== 'cloudflare_access' ? (
            <FormField
              control={form.control}
              name="userEmailHeader"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User email header</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="x-oore-user-email"
                      onChange={(event) => {
                        const nextHeader = event.target.value
                        field.onChange(nextHeader)
                        const currentPreset = form.getValues('proxyPreset')
                        const presetHeader = headerForPreset(currentPreset)
                        if (
                          presetHeader &&
                          nextHeader.trim().toLowerCase() !== presetHeader
                        ) {
                          form.setValue('proxyPreset', 'custom', {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      }}
                      disabled={configureMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {proxyPreset === 'cloudflare_access' ? (
            <>
              <FormField
                control={form.control}
                name="cloudflareTeamDomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cloudflare Access team domain</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="your-team.cloudflareaccess.com"
                        autoCapitalize="none"
                        autoCorrect="off"
                        disabled={configureMutation.isPending}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Copy the team domain from Cloudflare Zero Trust settings.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cloudflareAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application audience tag</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Application Audience (AUD) Tag"
                        autoCapitalize="none"
                        autoCorrect="off"
                        disabled={configureMutation.isPending}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Open the Access application overview and copy its AUD tag.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <AlertTitle>Finish the Cloudflare CORS setting</AlertTitle>
                <AlertDescription>
                  In the Access application, open Advanced settings, then CORS
                  settings. Turn on Bypass OPTIONS requests to origin. Oore
                  answers these requests with its exact allowed frontend
                  origins. Keep the tunnel pointed at Oore on loopback.
                </AlertDescription>
              </Alert>
            </>
          ) : null}

          {proxyPreset !== 'cloudflare_access' ? (
            <FormField
              control={form.control}
              name="trustedProxyCidrs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trusted proxy CIDRs (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="10.0.0.0/24, 100.64.0.0/10"
                      disabled={configureMutation.isPending}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Leave empty when the proxy reaches oored over loopback.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {proxyPreset !== 'cloudflare_access' ? (
            <FormField
              control={form.control}
              name="sharedSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shared secret</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Optional defense-in-depth secret"
                      disabled={configureMutation.isPending}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setValue('sharedSecret', generateSharedSecret(), {
                        shouldDirty: true,
                      })
                    }
                    disabled={configureMutation.isPending}
                    className="w-full"
                  >
                    Generate random secret
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Save this value now. After configuration, the secret is
                    write-only.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Failed to configure trusted proxy</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={configureMutation.isPending}
          >
            {configureMutation.isPending ? 'Saving...' : 'Continue to owner'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
