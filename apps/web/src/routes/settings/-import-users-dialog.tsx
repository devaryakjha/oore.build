import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useInviteUser } from '@/hooks/use-auth'
import { toast } from '@/lib/toast'
import { parseUserCsv } from './-user-csv'

const importUsersSchema = z.object({
  file: z.instanceof(File, { message: 'Choose a CSV file.' }),
})

type ImportUsersForm = z.infer<typeof importUsersSchema>

interface ImportResult {
  failed: Array<{ email: string; message: string; row: number }>
  imported: number
  skipped: number
}

export default function ImportUsersDialog({
  existingEmails,
  onOpenChange,
  open,
}: {
  existingEmails: Set<string>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const inviteMutation = useInviteUser()
  const [result, setResult] = useState<ImportResult | null>(null)
  const form = useForm<ImportUsersForm>({
    resolver: zodResolver(importUsersSchema),
    defaultValues: { file: undefined },
  })

  async function submit({ file }: ImportUsersForm) {
    setResult(null)
    const parsed = parseUserCsv(await file.text())
    if (parsed.errors.length > 0) {
      form.setError('root', {
        message: parsed.errors
          .map((error) =>
            error.row ? `Row ${error.row}: ${error.message}` : error.message,
          )
          .join(' '),
      })
      return
    }
    if (parsed.rows.length === 0) {
      form.setError('root', { message: 'The CSV file has no users to import.' })
      return
    }

    const skipped = parsed.rows.filter((row) =>
      existingEmails.has(row.email.toLowerCase()),
    )
    const importRows = parsed.rows.filter(
      (row) =>
        row.role !== 'owner' && !existingEmails.has(row.email.toLowerCase()),
    )
    const ownerRows = parsed.rows.filter(
      (row) => row.role === 'owner' && !existingEmails.has(row.email.toLowerCase()),
    )
    const outcomes = await Promise.allSettled(
      importRows.map((row) =>
        inviteMutation.mutateAsync({ email: row.email, role: row.role }),
      ),
    )
    const failed = outcomes.flatMap((outcome, index) => {
      if (outcome.status === 'fulfilled') return []
      const row = importRows[index]
      return [
        {
          email: row.email,
          message:
            outcome.reason instanceof Error
              ? outcome.reason.message
              : 'The invite failed.',
          row: row.row,
        },
      ]
    })
    const imported = importRows.length - failed.length
    const ownerFailures = ownerRows.map((row) => ({
      email: row.email,
      message: 'Only the existing owner can have the owner role.',
      row: row.row,
    }))
    setResult({
      imported,
      skipped: skipped.length,
      failed: [...failed, ...ownerFailures],
    })

    if (failed.length === 0 && ownerFailures.length === 0) {
      toast.success(
        imported > 0
          ? `${imported} user${imported === 1 ? '' : 's'} imported`
          : `${skipped.length} existing user${skipped.length === 1 ? '' : 's'} skipped`,
      )
      form.reset()
      onOpenChange(false)
    }
  }

  function resetDialog() {
    setResult(null)
    form.clearErrors()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) resetDialog()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import users</DialogTitle>
          <DialogDescription>CSV format: email,role</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      accept=".csv,text/csv"
                      type="file"
                      onChange={(event) => {
                        field.onChange(event.target.files?.[0])
                        form.clearErrors()
                        setResult(null)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root?.message ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            ) : null}

            {result && result.failed.length > 0 ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Imported {result.imported}. Failed {result.failed.length}.{' '}
                  Skipped {result.skipped}.{' '}
                  {result.failed
                    .map(
                      (failure) =>
                        `Row ${failure.row} (${failure.email}): ${failure.message}`,
                    )
                    .join(' ')}
                </AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? (
                  <>
                    <Spinner className="size-4" />
                    Importing...
                  </>
                ) : (
                  'Import users'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
