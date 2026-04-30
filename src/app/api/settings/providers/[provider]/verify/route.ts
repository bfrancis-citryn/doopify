import { err, ok } from '@/lib/api'
import { requireOwner } from '@/server/auth/require-auth'
import {
  parseSupportedProvider,
  verifyProviderConnection,
} from '@/server/services/provider-connection.service'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ provider: string }>
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const { provider: providerParam } = await context.params
  const provider = parseSupportedProvider(providerParam)
  if (!provider) {
    return err('Unsupported provider', 404)
  }

  try {
    const result = await verifyProviderConnection(provider)
    if (!result.verification.ok) {
      return err(result.verification.message, 400)
    }

    return ok({
      provider,
      status: result.status,
      verification: result.verification,
    })
  } catch (error) {
    console.error('[POST /api/settings/providers/[provider]/verify]', error)
    const message = error instanceof Error ? error.message : 'Failed to verify provider connection'
    return err(message, 400)
  }
}

