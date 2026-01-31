'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PipelineEditor } from './pipeline-editor'
import { usePipelineConfig, savePipelineConfig, deletePipelineConfig, validatePipelineConfig } from '@/lib/api/pipelines'
import type { ConfigFormat } from '@/lib/api/types'
import { toast } from 'sonner'
import {
  Settings01Icon,
  FloppyDiskIcon,
  Delete01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

const DEFAULT_YAML_CONFIG = `workflows:
  default:
    name: Default Build
    max_build_duration: 60
    environment:
      flutter: stable
    scripts:
      - name: Install dependencies
        script: flutter pub get
      - name: Run tests
        script: flutter test
      - name: Build app
        script: flutter build apk
    artifacts:
      - build/app/outputs/**/*.apk
`

const DEFAULT_HUML_CONFIG = `%HUML v0.2.0
workflows::
  default::
    name: "Default Build"
    max_build_duration: 60
    environment::
      flutter: "stable"
    scripts::
      - ::
        name: "Install dependencies"
        script: "flutter pub get"
      - ::
        name: "Run tests"
        script: "flutter test"
      - ::
        name: "Build app"
        script: "flutter build apk"
    artifacts:: "build/app/outputs/**/*.apk"
`

interface PipelineConfigCardProps {
  repositoryId: string
}

export function PipelineConfigCard({ repositoryId }: PipelineConfigCardProps) {
  const { data: config, isLoading, error, mutate } = usePipelineConfig(repositoryId)

  // Editor content for each format
  const [yamlContent, setYamlContent] = useState('')
  const [humlContent, setHumlContent] = useState('')
  const [activeFormat, setActiveFormat] = useState<ConfigFormat>('yaml')

  // Validation state
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    error?: string
    workflows?: string[]
  } | null>(null)

  // Action states
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Track if content has changed
  const [isDirty, setIsDirty] = useState(false)

  // Initialize content from config
  useEffect(() => {
    if (config) {
      if (config.config_format === 'yaml') {
        setYamlContent(config.config_content)
        setActiveFormat('yaml')
      } else {
        setHumlContent(config.config_content)
        setActiveFormat('huml')
      }
      setIsDirty(false)
      setValidationResult(null)
    } else if (!isLoading && !error) {
      // No config exists, set defaults
      setYamlContent(DEFAULT_YAML_CONFIG)
      setHumlContent(DEFAULT_HUML_CONFIG)
    }
  }, [config, isLoading, error])

  // Debounced validation
  const validateContent = useCallback(async (content: string, format: ConfigFormat) => {
    if (!content.trim()) {
      setValidationResult({ valid: false, error: 'Configuration cannot be empty' })
      return
    }

    setValidating(true)
    try {
      const result = await validatePipelineConfig({
        name: null,
        config_content: content,
        config_format: format,
      })
      setValidationResult(result)
    } catch (err) {
      setValidationResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Validation failed',
      })
    } finally {
      setValidating(false)
    }
  }, [])

  // Validate on content change (debounced)
  useEffect(() => {
    if (!isDirty) return

    const content = activeFormat === 'yaml' ? yamlContent : humlContent
    const timer = setTimeout(() => {
      validateContent(content, activeFormat)
    }, 500)

    return () => clearTimeout(timer)
  }, [yamlContent, humlContent, activeFormat, isDirty, validateContent])

  const handleContentChange = (value: string) => {
    if (activeFormat === 'yaml') {
      setYamlContent(value)
    } else {
      setHumlContent(value)
    }
    setIsDirty(true)
  }

  const handleSave = async () => {
    const content = activeFormat === 'yaml' ? yamlContent : humlContent

    if (!content.trim()) {
      toast.error('Configuration cannot be empty')
      return
    }

    setSaving(true)
    try {
      await savePipelineConfig(repositoryId, {
        name: null,
        config_content: content,
        config_format: activeFormat,
      })
      await mutate()
      setIsDirty(false)
      toast.success('Pipeline configuration saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePipelineConfig(repositoryId)
      await mutate()
      setYamlContent(DEFAULT_YAML_CONFIG)
      setHumlContent(DEFAULT_HUML_CONFIG)
      setIsDirty(false)
      setValidationResult(null)
      toast.success('Pipeline configuration deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete configuration')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const canSave = isDirty && validationResult?.valid && !saving

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Settings01Icon} className="h-4 w-4" />
              Pipeline Configuration
            </CardTitle>
            <CardDescription>
              Configure build workflows for this repository
            </CardDescription>
          </div>
          {config && (
            <Badge variant="secondary">
              Configured
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <>
            <Tabs value={activeFormat} onValueChange={(v) => setActiveFormat(v as ConfigFormat)}>
              <TabsList>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="huml">HUML</TabsTrigger>
              </TabsList>

              <TabsContent value="yaml" className="mt-4">
                <PipelineEditor
                  value={yamlContent}
                  onChange={handleContentChange}
                  format="yaml"
                  height="350px"
                />
              </TabsContent>

              <TabsContent value="huml" className="mt-4">
                <PipelineEditor
                  value={humlContent}
                  onChange={handleContentChange}
                  format="huml"
                  height="350px"
                />
              </TabsContent>
            </Tabs>

            {/* Validation feedback */}
            {validating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                Validating...
              </div>
            )}

            {validationResult && !validating && (
              <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
                <HugeiconsIcon
                  icon={validationResult.valid ? CheckmarkCircle02Icon : AlertCircleIcon}
                  className="h-4 w-4"
                />
                <AlertDescription>
                  {validationResult.valid ? (
                    <span>
                      Valid configuration with {validationResult.workflows?.length ?? 0} workflow{(validationResult.workflows?.length ?? 0) !== 1 ? 's' : ''}
                      {validationResult.workflows && validationResult.workflows.length > 0 && (
                        <span className="text-muted-foreground">
                          : {validationResult.workflows.join(', ')}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="font-mono text-xs">{validationResult.error}</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="gap-2 justify-between">
        <div>
          {config && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
        <Button onClick={handleSave} disabled={!canSave}>
          <HugeiconsIcon icon={FloppyDiskIcon} className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardFooter>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Pipeline Configuration"
        description="Are you sure you want to delete this pipeline configuration? Builds will fall back to using codemagic.yaml from the repository root."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </Card>
  )
}
