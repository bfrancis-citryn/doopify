import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import {
  disconnectProvider,
  getStripeProviderStatusSnapshot,
  getProviderStatus,
  parseSupportedProvider,
} from '@/server/services/provider-connection.service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ provider: string }>
}

export async function GET(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { provider: providerParam } = await context.params
  const provider = parseSupportedProvider(providerParam)
  if (!provider) {
    return err('Unsupported provider', 404)
  }

  try {
    const status = await getProviderStatus(provider)
    const stripeProviderStatus =
      provider === 'STRIPE' ? await getStripeProviderStatusSnapshot() : null
    return ok({ provider, status, stripeProviderStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load provider status'
    console.error('[GET /api/settings/providers/[provider]]', message)
    return err('Failed to load provider status', 500)
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { provider: providerParam } = await context.params
  const provider = parseSupportedProvider(providerParam)
  if (!provider) {
    return err('Unsupported provider', 404)
  }

  try {
    const before = await getProviderStatus(provider)
    const status = await disconnectProvider(provider)
    await recordAuditLogBestEffort({
      action: 'provider.disconnected',
      actor: auditActorFromUser(auth.user),
      resource: { type: 'ProviderConnection', id: provider },
      summary: `${provider} provider was disconnected`,
      snapshot: {
        outcome: 'disconnected',
        provider,
        previousState: before.state,
        previousSource: before.source,
        newState: status.state,
        newSource: status.source,
        category: status.category,
      },
      redactions: ['provider credential values', 'API keys', 'passwords', 'webhook secrets'],
    })
    return ok({ provider, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect provider'
    console.error('[DELETE /api/settings/providers/[provider]]', message)
    return err(message, 400)
  }
}

