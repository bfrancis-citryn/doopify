import type { ShippingProviderAdapter } from './types'

const SHIPPO_API_BASE = 'https://api.goshippo.com'

function truncate(text: string, max = 280) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

export const shippoProviderAdapter: ShippingProviderAdapter = {
  async testConnection(input) {
    try {
      const response = await fetch(`${SHIPPO_API_BASE}/carrier_accounts`, {
        method: 'GET',
        headers: {
          Authorization: `ShippoToken ${input.apiKey}`,
          Accept: 'application/json',
        },
      })

      const bodyText = await response.text()
      if (!response.ok) {
        return {
          ok: false,
          message: `Shippo authentication failed (${response.status}): ${truncate(bodyText || 'Request failed')}`,
        }
      }

      let payload: Record<string, unknown> | null = null
      try {
        payload = JSON.parse(bodyText) as Record<string, unknown>
      } catch {
        payload = null
      }

      const firstResult =
        Array.isArray(payload?.results) && payload.results.length > 0
          ? (payload.results[0] as Record<string, unknown>)
          : null

      return {
        ok: true,
        message: 'Shippo connection successful.',
        accountId:
          typeof payload?.id === 'string'
            ? payload.id
            : typeof firstResult?.object_id === 'string'
              ? firstResult.object_id
              : undefined,
        accountType: typeof firstResult?.carrier === 'string' ? firstResult.carrier : undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected connection failure'
      return {
        ok: false,
        message: `Shippo connection test failed: ${message}`,
      }
    }
  },
}
