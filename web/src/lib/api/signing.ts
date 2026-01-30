import useSWR, { mutate } from 'swr'
import { apiFetch, fetcher } from './client'

// ============================================================================
// Types
// ============================================================================

export type CertificateType = 'development' | 'distribution'
export type ProfileType = 'development' | 'adhoc' | 'appstore' | 'enterprise'
export type KeystoreType = 'jks' | 'pkcs12'

export interface IosSigningStatus {
  certificates_count: number
  profiles_count: number
  api_keys_count: number
  has_active_certificate: boolean
  has_active_profile: boolean
  has_api_key: boolean
}

export interface AndroidSigningStatus {
  keystores_count: number
  has_active_keystore: boolean
}

export interface SigningStatus {
  signing_enabled: boolean
  ios: IosSigningStatus
  android: AndroidSigningStatus
}

export interface IosCertificate {
  id: string
  repository_id: string
  name: string
  certificate_type: CertificateType
  common_name?: string
  team_id?: string
  expires_at?: string
  is_active: boolean
  created_at: string
}

export interface IosProfile {
  id: string
  repository_id: string
  name: string
  profile_type: ProfileType
  bundle_identifier?: string
  team_id?: string
  uuid: string
  app_id_name?: string
  expires_at?: string
  is_active: boolean
  created_at: string
}

export interface AndroidKeystore {
  id: string
  repository_id: string
  name: string
  key_alias: string
  keystore_type: KeystoreType
  is_active: boolean
  created_at: string
}

export interface AppStoreConnectApiKey {
  id: string
  repository_id: string
  name: string
  key_id: string
  issuer_id_masked: string
  is_active: boolean
  created_at: string
}

// ============================================================================
// Request Types
// ============================================================================

export interface UploadCertificateRequest {
  name: string
  certificate_type: CertificateType
  /** Base64-encoded p12 data */
  certificate_data_base64: string
  /** Password for the p12 file */
  password: string
}

export interface UploadProfileRequest {
  /** Base64-encoded mobileprovision data */
  profile_data_base64: string
  /** Optional name (defaults to profile's app_id_name) */
  name?: string
}

export interface UploadKeystoreRequest {
  name: string
  /** Base64-encoded keystore data */
  keystore_data_base64: string
  keystore_password: string
  key_alias: string
  key_password: string
  keystore_type?: KeystoreType
}

export interface UploadApiKeyRequest {
  name: string
  /** Apple's Key ID (10 alphanumeric characters) */
  key_id: string
  /** Apple's Issuer ID (UUID) */
  issuer_id: string
  /** Base64-encoded .p8 private key content */
  private_key_base64: string
}

// ============================================================================
// API Keys
// ============================================================================

const signingStatusKey = (repoId: string) =>
  `/api/repositories/${repoId}/signing/status`

const iosCertificatesKey = (repoId: string) =>
  `/api/repositories/${repoId}/signing/ios/certificates`

const iosProfilesKey = (repoId: string) =>
  `/api/repositories/${repoId}/signing/ios/profiles`

const androidKeystoresKey = (repoId: string) =>
  `/api/repositories/${repoId}/signing/android/keystores`

const iosApiKeysKey = (repoId: string) =>
  `/api/repositories/${repoId}/signing/ios/api-keys`

// ============================================================================
// Signing Status
// ============================================================================

export function useSigningStatus(repoId: string | null) {
  return useSWR<SigningStatus>(
    repoId ? signingStatusKey(repoId) : null,
    fetcher
  )
}

// ============================================================================
// iOS Certificates
// ============================================================================

export function useIosCertificates(repoId: string | null) {
  return useSWR<IosCertificate[]>(
    repoId ? iosCertificatesKey(repoId) : null,
    fetcher
  )
}

export async function uploadIosCertificate(
  repoId: string,
  data: UploadCertificateRequest
): Promise<IosCertificate> {
  const result = await apiFetch<IosCertificate>(iosCertificatesKey(repoId), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await mutate(iosCertificatesKey(repoId))
  await mutate(signingStatusKey(repoId))
  return result
}

export async function deleteIosCertificate(
  repoId: string,
  certId: string
): Promise<void> {
  await apiFetch(`${iosCertificatesKey(repoId)}/${certId}`, {
    method: 'DELETE',
  })
  await mutate(iosCertificatesKey(repoId))
  await mutate(signingStatusKey(repoId))
}

// ============================================================================
// iOS Profiles
// ============================================================================

export function useIosProfiles(repoId: string | null) {
  return useSWR<IosProfile[]>(
    repoId ? iosProfilesKey(repoId) : null,
    fetcher
  )
}

export async function uploadIosProfile(
  repoId: string,
  data: UploadProfileRequest
): Promise<IosProfile> {
  const result = await apiFetch<IosProfile>(iosProfilesKey(repoId), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await mutate(iosProfilesKey(repoId))
  await mutate(signingStatusKey(repoId))
  return result
}

export async function deleteIosProfile(
  repoId: string,
  profileId: string
): Promise<void> {
  await apiFetch(`${iosProfilesKey(repoId)}/${profileId}`, {
    method: 'DELETE',
  })
  await mutate(iosProfilesKey(repoId))
  await mutate(signingStatusKey(repoId))
}

// ============================================================================
// Android Keystores
// ============================================================================

export function useAndroidKeystores(repoId: string | null) {
  return useSWR<AndroidKeystore[]>(
    repoId ? androidKeystoresKey(repoId) : null,
    fetcher
  )
}

export async function uploadAndroidKeystore(
  repoId: string,
  data: UploadKeystoreRequest
): Promise<AndroidKeystore> {
  const result = await apiFetch<AndroidKeystore>(androidKeystoresKey(repoId), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await mutate(androidKeystoresKey(repoId))
  await mutate(signingStatusKey(repoId))
  return result
}

export async function deleteAndroidKeystore(
  repoId: string,
  keystoreId: string
): Promise<void> {
  await apiFetch(`${androidKeystoresKey(repoId)}/${keystoreId}`, {
    method: 'DELETE',
  })
  await mutate(androidKeystoresKey(repoId))
  await mutate(signingStatusKey(repoId))
}

// ============================================================================
// App Store Connect API Keys
// ============================================================================

export function useAppStoreConnectApiKeys(repoId: string | null) {
  return useSWR<AppStoreConnectApiKey[]>(
    repoId ? iosApiKeysKey(repoId) : null,
    fetcher
  )
}

export async function uploadAppStoreConnectApiKey(
  repoId: string,
  data: UploadApiKeyRequest
): Promise<AppStoreConnectApiKey> {
  const result = await apiFetch<AppStoreConnectApiKey>(iosApiKeysKey(repoId), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await mutate(iosApiKeysKey(repoId))
  await mutate(signingStatusKey(repoId))
  return result
}

export async function deleteAppStoreConnectApiKey(
  repoId: string,
  keyId: string
): Promise<void> {
  await apiFetch(`${iosApiKeysKey(repoId)}/${keyId}`, {
    method: 'DELETE',
  })
  await mutate(iosApiKeysKey(repoId))
  await mutate(signingStatusKey(repoId))
}
