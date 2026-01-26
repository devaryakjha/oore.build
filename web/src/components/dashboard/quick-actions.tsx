'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Add01Icon,
  GithubIcon,
  GitlabIcon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button nativeButton={false} render={<Link href="/repositories/new" />} variant="outline" className="justify-start">
          <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
        <Button nativeButton={false} render={<Link href="/settings/github" />} variant="outline" className="justify-start">
          <HugeiconsIcon icon={GithubIcon} className="mr-2 h-4 w-4" />
          Configure GitHub
        </Button>
        <Button nativeButton={false} render={<Link href="/settings/gitlab" />} variant="outline" className="justify-start">
          <HugeiconsIcon icon={GitlabIcon} className="mr-2 h-4 w-4" />
          Configure GitLab
        </Button>
        <Button nativeButton={false} render={<Link href="/settings" />} variant="outline" className="justify-start">
          <HugeiconsIcon icon={Settings01Icon} className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </CardContent>
    </Card>
  )
}
