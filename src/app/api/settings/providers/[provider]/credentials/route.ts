import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import {
  parseSupportedProvider,
  saveProviderCredentials,
} from '@/server/services/provider-connection.service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ provider: string }>
}

const stripeSchema = z
  .object({
    publishableKey: z.string().min(1).optional(),
    secretKey: z.string().min(1).optional(),
    webhookSecret: z.string().min(1).optional(),
    mode: z.enum(['test', 'live']).optional(),
  })
  .refine(
    (input) =>
      Boolean(
        input.publishableKey ||
          input.secretKey ||
          input.webhookSecret ||
          input.mode
      ),
    {
      message: 'At least one Stripe credential field is required',
      path: ['publishableKey'],
    }
  )

const resendSchema = z.object({
  apiKey: z.string().min(1),
  webhookSecret: z.string().min(1).optional(),
  fromEmail: z.string().email().optional(),
})

const smtpSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  username: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email().optional(),
})

const shippingSchema = z.object({
  apiKey: z.string().min(1),
})

function validatePayload(provider: string, body: unknown) {
  if (provider === 'STRIPE') return stripeSchema.safeParse(body)
  if (provider === 'RESEND') return resendSchema.safeParse(body)
  if (provider === 'SMTP') return smtpSchema.safeParse(body)
  return shippingSchema.safeParse(body)
}

function credentialAuditSnapshot(provider: string, payload: Record<string, unknown>) {
  return {
    provider,
    submittedFields: Object.keys(payload).sort(),
    mode: typeof payload.mode === 'string' ? payload.mode : null,
    fromEmail: typeof payload.fromEmail === 'string' ? payload.fromEmail : null,
    host: typeof payload.host === 'string' ? payload.host : null,
    port: typeof payload.port === 'number' ? payload.port : null,
    secure: typeof payload.secure === 'boolean' ? payload.secure : null,
    containsSecretFields: Object.keys(payload).some((key) =>
      /secret|password|apiKey|publishableKey|secretKey|webhookSecret/i.test(key)
    ),
  }
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { provider: providerParam } = await context.params
  const provider = parseSupportedProvider(providerParam)
  if (!provider) {
    return err('Unsupported provider', 404)
  }

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = validatePayload(provider, body)
  if (!parsed.success) {
    return unprocessable('Provider credentials payload is invalid', parsed.error.flatten())
  }

  try {
    const status = await saveProviderCredentials(provider, parsed.data)
    await recordAuditLogBestEffort({
      action: 'provider.credentials_saved',
      actor: auditActorFromUser(auth.user),
      resource: { type: 'ProviderConnection', id: provider },
      summary: `${provider} provider credentials were saved`,
      snapshot: {
        outcome: 'saved',
        provider,
        state: status.state,
        source: status.source,
        category: status.category,
        fields: credentialAuditSnapshot(provider, parsed.data),
      },
      redactions: ['provider credential values', 'API keys', 'passwords', 'webhook secrets'],
    })
    return ok({ provider, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save provider credentials'
    console.error('[POST /api/settings/providers/[provider]/credentials]', message)
    return err(message, 400)
  }
}

