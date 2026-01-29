'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { SetupStatus } from '@/lib/api/types'
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  GithubIcon,
  GitlabIcon,
  Key01Icon,
  ShieldKeyIcon,
  TestTube01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'

interface SetupStatusCardProps {
  status: SetupStatus | undefined
  isLoading: boolean
}

interface SetupItemProps {
  title: string
  description: string
  configured: boolean
  href: string
  icon: typeof GithubIcon
}

function SetupItem({ title, description, configured, href, icon }: SetupItemProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            configured ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
          )}
        >
          <HugeiconsIcon icon={icon} className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {configured ? (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mr-1 h-3 w-3" />
            Configured
          </Badge>
        ) : (
          <Button nativeButton={false} render={<Link href={href} />} variant="outline" size="sm">
            Setup
            <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function SetupStatusCard({ status, isLoading }: SetupStatusCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
          <CardDescription>Configure your integrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
          <CardDescription>Failed to load setup status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            <span>Could not connect to server</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const items = [
    {
      title: 'Encryption',
      description: status.encryption_configured
        ? 'Credentials are encrypted'
        : 'Required for storing secrets',
      configured: status.encryption_configured,
      href: '/settings',
      icon: Key01Icon,
    },
    {
      title: 'Admin Token',
      description: status.admin_token_configured
        ? 'Authentication enabled'
        : 'Protect your dashboard',
      configured: status.admin_token_configured,
      href: '/settings',
      icon: ShieldKeyIcon,
    },
    {
      title: 'GitHub',
      description: status.github.configured
        ? `${status.github.app_name} (${status.github.installations_count || 0} installations)`
        : 'Connect your GitHub App',
      configured: status.github.configured,
      href: '/settings/github',
      icon: GithubIcon,
    },
    {
      title: 'GitLab',
      description:
        status.gitlab.length > 0
          ? `${status.gitlab.length} instance(s) connected`
          : 'Connect GitLab OAuth',
      configured: status.gitlab.length > 0,
      href: '/settings/gitlab',
      icon: GitlabIcon,
    },
  ]

  const configuredCount = items.filter((i) => i.configured).length
  const progress = (configuredCount / items.length) * 100

  return (
    <Card>
      <CardHeader>
        {status.demo_mode && (
          <Badge variant="outline" className="w-fit mb-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            <HugeiconsIcon icon={TestTube01Icon} className="mr-1 h-3 w-3" />
            Demo Mode
          </Badge>
        )}
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Setup Progress</CardTitle>
            <CardDescription>
              {status.demo_mode
                ? 'Using simulated data for testing'
                : configuredCount === items.length
                  ? 'All integrations configured'
                  : `${configuredCount} of ${items.length} integrations configured`}
            </CardDescription>
          </div>
          <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {items.map((item) => (
            <SetupItem key={item.title} {...item} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
