'use client'

import { use, useState, useRef, ChangeEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/empty-state'
import { CardSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDate, formatDistanceToNow } from '@/lib/format'
import { toast } from 'sonner'
import {
  ArrowLeft02Icon,
  Delete01Icon,
  SecurityCheckIcon,
  SmartPhone01Icon,
  Key01Icon,
  FileSecurityIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  CloudIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  useSigningStatus,
  useIosCertificates,
  useIosProfiles,
  useAndroidKeystores,
  useAppStoreConnectApiKeys,
  uploadIosCertificate,
  uploadIosProfile,
  uploadAndroidKeystore,
  uploadAppStoreConnectApiKey,
  deleteIosCertificate,
  deleteIosProfile,
  deleteAndroidKeystore,
  deleteAppStoreConnectApiKey,
  type IosCertificate,
  type IosProfile,
  type AndroidKeystore,
  type AppStoreConnectApiKey,
  type CertificateType,
} from '@/lib/api/signing'

export default function SigningSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const { data: status, isLoading: statusLoading } = useSigningStatus(id)
  const { data: certificates, isLoading: certsLoading } = useIosCertificates(id)
  const { data: profiles, isLoading: profilesLoading } = useIosProfiles(id)
  const { data: apiKeys, isLoading: apiKeysLoading } = useAppStoreConnectApiKeys(id)
  const { data: keystores, isLoading: keystoresLoading } = useAndroidKeystores(id)

  // Certificate upload state
  const [uploadingCert, setUploadingCert] = useState(false)
  const [certName, setCertName] = useState('')
  const [certType, setCertType] = useState<CertificateType>('distribution')
  const [certPassword, setCertPassword] = useState('')
  const certFileRef = useRef<HTMLInputElement>(null)

  // Profile upload state
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const profileFileRef = useRef<HTMLInputElement>(null)

  // API key upload state
  const [uploadingApiKey, setUploadingApiKey] = useState(false)
  const [apiKeyName, setApiKeyName] = useState('')
  const [appleKeyId, setAppleKeyId] = useState('')
  const [appleIssuerId, setAppleIssuerId] = useState('')
  const apiKeyFileRef = useRef<HTMLInputElement>(null)

  // Keystore upload state
  const [uploadingKeystore, setUploadingKeystore] = useState(false)
  const [keystoreName, setKeystoreName] = useState('')
  const [keystorePassword, setKeystorePassword] = useState('')
  const [keyAlias, setKeyAlias] = useState('')
  const [keyPassword, setKeyPassword] = useState('')
  const keystoreFileRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [deleteDialog, setDeleteDialog] = useState<{
    type: 'certificate' | 'profile' | 'api-key' | 'keystore'
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isLoading = statusLoading || certsLoading || profilesLoading || apiKeysLoading || keystoresLoading

  // File to base64 helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix (e.g., "data:application/octet-stream;base64,")
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Certificate upload handler
  const handleCertificateUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!certName.trim()) {
      toast.error('Please enter a certificate name')
      return
    }

    if (!certPassword) {
      toast.error('Please enter the certificate password')
      return
    }

    setUploadingCert(true)
    try {
      const base64 = await fileToBase64(file)
      await uploadIosCertificate(id, {
        name: certName.trim(),
        certificate_type: certType,
        certificate_data_base64: base64,
        password: certPassword,
      })
      toast.success('Certificate uploaded successfully')
      setCertName('')
      setCertPassword('')
      if (certFileRef.current) certFileRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload certificate')
    } finally {
      setUploadingCert(false)
    }
  }

  // Profile upload handler
  const handleProfileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingProfile(true)
    try {
      const base64 = await fileToBase64(file)
      await uploadIosProfile(id, {
        profile_data_base64: base64,
        name: profileName.trim() || undefined,
      })
      toast.success('Provisioning profile uploaded successfully')
      setProfileName('')
      if (profileFileRef.current) profileFileRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload profile')
    } finally {
      setUploadingProfile(false)
    }
  }

  // API key upload handler
  const handleApiKeyUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!apiKeyName.trim()) {
      toast.error('Please enter a name for the API key')
      return
    }

    if (!appleKeyId.trim()) {
      toast.error('Please enter the Apple Key ID')
      return
    }

    if (!appleIssuerId.trim()) {
      toast.error('Please enter the Apple Issuer ID')
      return
    }

    setUploadingApiKey(true)
    try {
      const base64 = await fileToBase64(file)
      await uploadAppStoreConnectApiKey(id, {
        name: apiKeyName.trim(),
        key_id: appleKeyId.trim(),
        issuer_id: appleIssuerId.trim(),
        private_key_base64: base64,
      })
      toast.success('API key uploaded successfully')
      setApiKeyName('')
      setAppleKeyId('')
      setAppleIssuerId('')
      if (apiKeyFileRef.current) apiKeyFileRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload API key')
    } finally {
      setUploadingApiKey(false)
    }
  }

  // Keystore upload handler
  const handleKeystoreUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!keystoreName.trim()) {
      toast.error('Please enter a keystore name')
      return
    }

    if (!keystorePassword) {
      toast.error('Please enter the keystore password')
      return
    }

    if (!keyAlias.trim()) {
      toast.error('Please enter the key alias')
      return
    }

    if (!keyPassword) {
      toast.error('Please enter the key password')
      return
    }

    setUploadingKeystore(true)
    try {
      const base64 = await fileToBase64(file)
      await uploadAndroidKeystore(id, {
        name: keystoreName.trim(),
        keystore_data_base64: base64,
        keystore_password: keystorePassword,
        key_alias: keyAlias.trim(),
        key_password: keyPassword,
      })
      toast.success('Keystore uploaded successfully')
      setKeystoreName('')
      setKeystorePassword('')
      setKeyAlias('')
      setKeyPassword('')
      if (keystoreFileRef.current) keystoreFileRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload keystore')
    } finally {
      setUploadingKeystore(false)
    }
  }

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteDialog) return

    setDeleting(true)
    try {
      if (deleteDialog.type === 'certificate') {
        await deleteIosCertificate(id, deleteDialog.id)
        toast.success('Certificate deleted')
      } else if (deleteDialog.type === 'profile') {
        await deleteIosProfile(id, deleteDialog.id)
        toast.success('Provisioning profile deleted')
      } else if (deleteDialog.type === 'api-key') {
        await deleteAppStoreConnectApiKey(id, deleteDialog.id)
        toast.success('API key deleted')
      } else if (deleteDialog.type === 'keystore') {
        await deleteAndroidKeystore(id, deleteDialog.id)
        toast.success('Keystore deleted')
      }
      setDeleteDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/repositories/${id}`} />} aria-label="Back to repository">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  const iosConfigured = (status?.ios.has_active_certificate && status?.ios.has_active_profile) || status?.ios.has_api_key
  const androidConfigured = status?.android.has_active_keystore

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/repositories/${id}`} />} aria-label="Back to repository">
            <HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Code Signing</h1>
            <p className="text-muted-foreground">
              Manage iOS certificates, provisioning profiles, and Android keystores
            </p>
          </div>
        </div>
      </div>

      {/* Signing Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={SecurityCheckIcon} className="h-5 w-5" />
            Signing Status
          </CardTitle>
          <CardDescription>Current code signing configuration status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={SmartPhone01Icon} className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">iOS Signing</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.ios.certificates_count ?? 0} cert(s), {status?.ios.profiles_count ?? 0} profile(s), {status?.ios.api_keys_count ?? 0} API key(s)
                  </p>
                </div>
              </div>
              {iosConfigured ? (
                <Badge variant="default" className="gap-1">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <HugeiconsIcon icon={AlertCircleIcon} className="h-3 w-3" />
                  Not configured
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={SmartPhone01Icon} className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Android Signing</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.android.keystores_count ?? 0} keystore(s)
                  </p>
                </div>
              </div>
              {androidConfigured ? (
                <Badge variant="default" className="gap-1">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <HugeiconsIcon icon={AlertCircleIcon} className="h-3 w-3" />
                  Not configured
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* iOS Certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Key01Icon} className="h-5 w-5" />
            iOS Certificates
          </CardTitle>
          <CardDescription>
            Upload p12 distribution or development certificates for iOS code signing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Certificate list */}
          {certificates && certificates.length > 0 ? (
            <div className="space-y-2">
              {certificates.map((cert: IosCertificate) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HugeiconsIcon icon={Key01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{cert.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {cert.certificate_type}
                        </Badge>
                        {cert.is_active && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cert.common_name && <span>{cert.common_name}</span>}
                        {cert.team_id && <span> ({cert.team_id})</span>}
                        {cert.expires_at && (
                          <span className="ml-2">Expires: {formatDate(cert.expires_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteDialog({ type: 'certificate', id: cert.id, name: cert.name })}
                    aria-label={`Delete ${cert.name}`}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<HugeiconsIcon icon={Key01Icon} className="h-10 w-10" />}
              title="No certificates"
              description="Upload a p12 certificate to sign iOS apps."
              className="py-8"
            />
          )}

          <Separator />

          {/* Certificate upload form */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Upload Certificate</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cert-name">Certificate Name</Label>
                <Input
                  id="cert-name"
                  placeholder="e.g., Distribution Certificate"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-type">Certificate Type</Label>
                <select
                  id="cert-type"
                  value={certType}
                  onChange={(e) => setCertType(e.target.value as CertificateType)}
                  className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs"
                >
                  <option value="distribution">Distribution</option>
                  <option value="development">Development</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-password">Certificate Password</Label>
              <Input
                id="cert-password"
                type="password"
                placeholder="p12 file password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <Input
                ref={certFileRef}
                type="file"
                accept=".p12,.pfx"
                onChange={handleCertificateUpload}
                disabled={uploadingCert || !certName.trim() || !certPassword}
                className="max-w-xs"
              />
              {uploadingCert && (
                <span className="text-sm text-muted-foreground">Uploading...</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* iOS Provisioning Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={FileSecurityIcon} className="h-5 w-5" />
            iOS Provisioning Profiles
          </CardTitle>
          <CardDescription>
            Upload mobileprovision files for iOS app distribution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile list */}
          {profiles && profiles.length > 0 ? (
            <div className="space-y-2">
              {profiles.map((profile: IosProfile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HugeiconsIcon icon={FileSecurityIcon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{profile.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {profile.profile_type}
                        </Badge>
                        {profile.is_active && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {profile.bundle_identifier && <span>{profile.bundle_identifier}</span>}
                        {profile.team_id && <span className="ml-2">Team: {profile.team_id}</span>}
                        {profile.expires_at && (
                          <span className="ml-2">Expires: {formatDate(profile.expires_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteDialog({ type: 'profile', id: profile.id, name: profile.name })}
                    aria-label={`Delete ${profile.name}`}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<HugeiconsIcon icon={FileSecurityIcon} className="h-10 w-10" />}
              title="No provisioning profiles"
              description="Upload a mobileprovision file to distribute iOS apps."
              className="py-8"
            />
          )}

          <Separator />

          {/* Profile upload form */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Upload Provisioning Profile</h4>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Profile Name (optional)</Label>
              <Input
                id="profile-name"
                placeholder="Leave empty to use profile's App ID Name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <Input
                ref={profileFileRef}
                type="file"
                accept=".mobileprovision"
                onChange={handleProfileUpload}
                disabled={uploadingProfile}
                className="max-w-xs"
              />
              {uploadingProfile && (
                <span className="text-sm text-muted-foreground">Uploading...</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Store Connect API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={CloudIcon} className="h-5 w-5" />
            App Store Connect API Keys
          </CardTitle>
          <CardDescription>
            Upload API keys for automatic iOS signing. This is an alternative to manual certificate and profile management.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Automatic vs Manual Signing</p>
            <p>
              With API keys, xcodebuild can automatically manage provisioning profiles during builds.
              Create an API key in{' '}
              <a href="https://appstoreconnect.apple.com/access/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                App Store Connect
              </a>
              {' '}(Users and Access → Keys).
            </p>
          </div>

          {/* API key list */}
          {apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-2">
              {apiKeys.map((apiKey: AppStoreConnectApiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HugeiconsIcon icon={CloudIcon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{apiKey.name}</p>
                        {apiKey.is_active && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Key ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{apiKey.key_id}</code>
                        <span className="ml-2">Issuer: <code className="text-xs bg-muted px-1 py-0.5 rounded">{apiKey.issuer_id_masked}</code></span>
                        <span className="ml-2">Added {formatDistanceToNow(apiKey.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteDialog({ type: 'api-key', id: apiKey.id, name: apiKey.name })}
                    aria-label={`Delete ${apiKey.name}`}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<HugeiconsIcon icon={CloudIcon} className="h-10 w-10" />}
              title="No API keys"
              description="Upload an App Store Connect API key for automatic provisioning."
              className="py-8"
            />
          )}

          <Separator />

          {/* API key upload form */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Upload API Key</h4>
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                placeholder="e.g., CI/CD API Key"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="apple-key-id">Key ID</Label>
                <Input
                  id="apple-key-id"
                  placeholder="e.g., ABC123XYZ0"
                  value={appleKeyId}
                  onChange={(e) => setAppleKeyId(e.target.value)}
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">10 alphanumeric characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apple-issuer-id">Issuer ID</Label>
                <Input
                  id="apple-issuer-id"
                  placeholder="e.g., 12345678-1234-1234-1234-123456789012"
                  value={appleIssuerId}
                  onChange={(e) => setAppleIssuerId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">UUID from App Store Connect</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Input
                ref={apiKeyFileRef}
                type="file"
                accept=".p8"
                onChange={handleApiKeyUpload}
                disabled={uploadingApiKey || !apiKeyName.trim() || !appleKeyId.trim() || !appleIssuerId.trim()}
                className="max-w-xs"
              />
              {uploadingApiKey && (
                <span className="text-sm text-muted-foreground">Uploading...</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload the .p8 private key file downloaded from App Store Connect. This file can only be downloaded once.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Android Keystores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Key01Icon} className="h-5 w-5" />
            Android Keystores
          </CardTitle>
          <CardDescription>
            Upload JKS or PKCS12 keystores for Android app signing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Keystore list */}
          {keystores && keystores.length > 0 ? (
            <div className="space-y-2">
              {keystores.map((keystore: AndroidKeystore) => (
                <div
                  key={keystore.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HugeiconsIcon icon={Key01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{keystore.name}</p>
                        <Badge variant="outline" className="text-xs uppercase">
                          {keystore.keystore_type}
                        </Badge>
                        {keystore.is_active && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Key alias: <code className="text-xs bg-muted px-1 py-0.5 rounded">{keystore.key_alias}</code>
                        <span className="ml-2">Added {formatDistanceToNow(keystore.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteDialog({ type: 'keystore', id: keystore.id, name: keystore.name })}
                    aria-label={`Delete ${keystore.name}`}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<HugeiconsIcon icon={Key01Icon} className="h-10 w-10" />}
              title="No keystores"
              description="Upload a JKS or PKCS12 keystore to sign Android apps."
              className="py-8"
            />
          )}

          <Separator />

          {/* Keystore upload form */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Upload Keystore</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="keystore-name">Keystore Name</Label>
                <Input
                  id="keystore-name"
                  placeholder="e.g., Release Keystore"
                  value={keystoreName}
                  onChange={(e) => setKeystoreName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keystore-password">Keystore Password</Label>
                <Input
                  id="keystore-password"
                  type="password"
                  placeholder="Keystore password"
                  value={keystorePassword}
                  onChange={(e) => setKeystorePassword(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="key-alias">Key Alias</Label>
                <Input
                  id="key-alias"
                  placeholder="e.g., upload"
                  value={keyAlias}
                  onChange={(e) => setKeyAlias(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-password">Key Password</Label>
                <Input
                  id="key-password"
                  type="password"
                  placeholder="Key password"
                  value={keyPassword}
                  onChange={(e) => setKeyPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Input
                ref={keystoreFileRef}
                type="file"
                accept=".jks,.keystore,.p12,.pfx"
                onChange={handleKeystoreUpload}
                disabled={uploadingKeystore || !keystoreName.trim() || !keystorePassword || !keyAlias.trim() || !keyPassword}
                className="max-w-xs"
              />
              {uploadingKeystore && (
                <span className="text-sm text-muted-foreground">Uploading...</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
        title={`Delete ${deleteDialog?.type === 'certificate' ? 'Certificate' : deleteDialog?.type === 'profile' ? 'Provisioning Profile' : deleteDialog?.type === 'api-key' ? 'API Key' : 'Keystore'}`}
        description={`Are you sure you want to delete "${deleteDialog?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
