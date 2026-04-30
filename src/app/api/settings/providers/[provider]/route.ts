import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import {
  disconnectProvider,
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
    return ok({ provider, status })
  } catch (error) {
    console.error('[GET /api/settings/providers/[provider]]', error)
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
    const status = await disconnectProvider(provider)
    return ok({ provider, status })
  } catch (error) {
    console.error('[DELETE /api/settings/providers/[provider]]', error)
    const message = error instanceof Error ? error.message : 'Failed to disconnect provider'
    return err(message, 400)
  }
}

