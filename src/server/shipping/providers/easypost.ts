import type { ShippingProviderAdapter } from './types'

const EASYPOST_API_BASE = 'https://api.easypost.com/v2'

function buildBasicAuthToken(apiKey: string) {
  return Buffer.from(`${apiKey}:`).toString('base64')
}

function truncate(text: string, max = 280) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

export const easypostProviderAdapter: ShippingProviderAdapter = {
  async testConnection(input) {
    try {
      const response = await fetch(`${EASYPOST_API_BASE}/users`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${buildBasicAuthToken(input.apiKey)}`,
          Accept: 'application/json',
        },
      })

      const bodyText = await response.text()
      if (!response.ok) {
        return {
          ok: false,
          message: `EasyPost authentication failed (${response.status}): ${truncate(bodyText || 'Request failed')}`,
        }
      }

      let payload: Record<string, unknown> | null = null
      try {
        payload = JSON.parse(bodyText) as Record<string, unknown>
      } catch {
        payload = null
      }

      return {
        ok: true,
        message: 'EasyPost connection successful.',
        accountId: typeof payload?.id === 'string' ? payload.id : undefined,
        accountType: typeof payload?.object === 'string' ? payload.object : undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected connection failure'
      return {
        ok: false,
        message: `EasyPost connection test failed: ${message}`,
      }
    }
  },
}
