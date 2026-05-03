import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import {
  buildDeploymentValidationReport,
  type DeploymentValidationFacts,
} from '@/server/services/deployment-validation.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  try {
    const isProduction = process.env.NODE_ENV === 'production'
    const mediaStorageProvider = process.env.MEDIA_STORAGE_PROVIDER ?? null
    const rateLimitStore = process.env.DOOPIFY_RATE_LIMIT_STORE ?? null
    const cspMode = process.env.CSP_MODE ?? null
    const webhookRetrySecretPresent = Boolean(process.env.WEBHOOK_RETRY_SECRET)

    const facts: DeploymentValidationFacts = {
      isProduction,

      encryptionKeyPresent: Boolean(process.env.ENCRYPTION_KEY),

      mediaStorageProvider,
      mediaS3RegionPresent: Boolean(process.env.MEDIA_S3_REGION),
      mediaS3BucketPresent: Boolean(process.env.MEDIA_S3_BUCKET),
      mediaS3AccessKeyIdPresent: Boolean(process.env.MEDIA_S3_ACCESS_KEY_ID),
      mediaS3SecretAccessKeyPresent: Boolean(process.env.MEDIA_S3_SECRET_ACCESS_KEY),
      mediaPublicBaseUrlPresent: Boolean(process.env.MEDIA_PUBLIC_BASE_URL),

      rateLimitStore,

      cspMode,

      webhookRetrySecretPresent,
      jobRunnerSecretPresent: Boolean(process.env.JOB_RUNNER_SECRET),
      abandonedCheckoutSecretPresent: Boolean(process.env.ABANDONED_CHECKOUT_SECRET),
    }

    const report = buildDeploymentValidationReport(facts)

    return ok({
      ...report,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/deployment-validation]', error)
    return err('Failed to gather deployment validation', 500)
  }
}
