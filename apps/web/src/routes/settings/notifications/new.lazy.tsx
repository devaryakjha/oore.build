import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/lib/toast'
import { useCreateNotificationChannel } from '@/hooks/use-notification-channels'
import { PageMeta } from '@/lib/seo'
import PageLayout from '@/components/page-layout'
import PageHeader from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { getApiErrorMessage } from '@/lib/api-client/api-error'
import {
  createNotificationChannelRequest,
  createNotificationChannelSchema,
  NotificationChannelFormFields,
  notificationChannelDefaults,
  type NotificationChannelFormValues,
} from './-notification-form'

export const Route = createLazyFileRoute('/settings/notifications/new')({
  component: NewNotificationChannelPage,
})

function NewNotificationChannelPage() {
  const navigate = useNavigate()
  const createMutation = useCreateNotificationChannel()
  const form = useForm<NotificationChannelFormValues>({
    resolver: zodResolver(createNotificationChannelSchema),
    defaultValues: notificationChannelDefaults,
    mode: 'onBlur',
  })

  function onSubmit(values: NotificationChannelFormValues) {
    createMutation.mutate(createNotificationChannelRequest(values), {
      onSuccess: () => {
        toast.success('Notification channel created')
        void navigate({ to: '/settings/notifications' })
      },
      onError: (error) => toast.error(getApiErrorMessage(error, {})),
    })
  }

  return (
    <PageLayout width="wide">
      <PageMeta title="New notification channel" noindex />
      <PageHeader
        title="New notification channel"
        description="Configure a notification channel to receive build and runner status updates."
      />

      <Card size="sm" aria-labelledby="channel-config-title">
        <CardHeader>
          <CardTitle id="channel-config-title">Channel configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <NotificationChannelFormFields form={form} />
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create channel'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void navigate({ to: '/settings/notifications' })
                  }
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
