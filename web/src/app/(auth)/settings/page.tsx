'use client'

import Link from 'next/link'
import { useSetupStatus } from '@/lib/api/setup'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/shared/loading-skeleton'
import {
  Settings01Icon,
  GithubIcon,
  GitlabIcon,
  Key01Icon,
  ShieldKeyIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'

interface SettingCardProps {
  title: string
  description: string
  configured: boolean
  icon: typeof GithubIcon
  href?: string
  details?: string
  serverOnly?: boolean
}

function SettingCard({ title, description, configured, icon, href, details, serverOnly }: SettingCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              configured ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
            )}
          >
            <HugeiconsIcon icon={icon} className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            configured
              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          )}
        >
          <HugeiconsIcon
            icon={configured ? CheckmarkCircle02Icon : Cancel01Icon}
            className="mr-1 h-3 w-3"
          />
          {configured ? 'Configured' : 'Not Configured'}
        </Badge>
      </CardHeader>
      <CardContent>
        {details && (
          <p className="text-sm text-muted-foreground mb-4">{details}</p>
        )}
        {serverOnly ? (
          <p className="text-sm text-muted-foreground">
            Configured via server environment variables.
          </p>
        ) : href ? (
          <Button nativeButton={false} render={<Link href={href} />} variant={configured ? 'outline' : 'default'}>
            {configured ? 'Manage' : 'Configure'}
            <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { data: status, isLoading } = useSetupStatus()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your Oore instance
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Oore instance
        </p>
      </div>

      <Card className="border-muted bg-muted/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={InformationCircleIcon} className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Server Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The encryption key and admin token are configured via environment variables on the server.
            See the <code className="text-primary">/etc/oore/oore.env</code> file or the documentation
            for more information.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <SettingCard
          title="Encryption"
          description="AES-256-GCM encryption for credentials"
          configured={status?.encryption_configured ?? false}
          icon={Key01Icon}
          serverOnly
          details={
            status?.encryption_configured
              ? 'OAuth tokens and secrets are encrypted at rest.'
              : 'Set OORE_ENCRYPTION_KEY environment variable to enable encryption.'
          }
        />

        <SettingCard
          title="Admin Token"
          description="Protect your dashboard"
          configured={status?.admin_token_configured ?? false}
          icon={ShieldKeyIcon}
          serverOnly
          details={
            status?.admin_token_configured
              ? 'API endpoints require authentication.'
              : 'Set OORE_ADMIN_TOKEN environment variable to require authentication.'
          }
        />

        <SettingCard
          title="GitHub"
          description="GitHub App integration"
          configured={status?.github.configured ?? false}
          icon={GithubIcon}
          href="/settings/github"
          details={
            status?.github.configured
              ? `${status.github.app_name} - ${status.github.installations_count ?? 0} installations`
              : 'Connect a GitHub App to receive webhooks and access repositories.'
          }
        />

        <SettingCard
          title="GitLab"
          description="GitLab OAuth integration"
          configured={(status?.gitlab.length ?? 0) > 0}
          icon={GitlabIcon}
          href="/settings/gitlab"
          details={
            (status?.gitlab.length ?? 0) > 0
              ? `${status?.gitlab.length} instance(s) connected`
              : 'Connect GitLab to receive webhooks and access projects.'
          }
        />
      </div>
    </div>
  )
}
