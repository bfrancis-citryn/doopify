import type { ShippingProviderAdapter } from './types'
import type { ShippingRateQuote } from '@/server/shipping/shipping-rate.types'

const EASYPOST_API_BASE = 'https://api.easypost.com/v2'

function buildBasicAuthToken(apiKey: string) {
  return Buffer.from(`${apiKey}:`).toString('base64')
}

function truncate(text: string, max = 280) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

function normalizeMoneyToCents(value: unknown) {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.trim()) : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
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
  async getRates(input) {
    const response = await fetch(`${EASYPOST_API_BASE}/shipments`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${buildBasicAuthToken(input.apiKey)}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        shipment: {
          from_address: {
            name: input.originAddress.name ?? undefined,
            phone: input.originAddress.phone ?? undefined,
            street1: input.originAddress.address1,
            street2: input.originAddress.address2 ?? undefined,
            city: input.originAddress.city,
            state: input.originAddress.province ?? undefined,
            zip: input.originAddress.postalCode,
            country: input.originAddress.country,
          },
          to_address: {
            name: input.destinationAddress.name ?? undefined,
            phone: input.destinationAddress.phone ?? undefined,
            street1: input.destinationAddress.address1,
            street2: input.destinationAddress.address2 ?? undefined,
            city: input.destinationAddress.city,
            state: input.destinationAddress.province ?? undefined,
            zip: input.destinationAddress.postalCode,
            country: input.destinationAddress.country,
          },
          parcel: {
            weight: input.parcel.weightOz,
            length: input.parcel.lengthIn,
            width: input.parcel.widthIn,
            height: input.parcel.heightIn,
          },
        },
      }),
    })

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(`EasyPost rates request failed (${response.status}): ${truncate(bodyText || 'Request failed')}`)
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      payload = null
    }

    const rates = Array.isArray(payload?.rates) ? payload.rates : []
    const normalizedQuotes = rates
      .map((rate) => {
        const item = rate as Record<string, unknown>
        const amountCents = normalizeMoneyToCents(item.rate)
        if (amountCents == null) return null

        const providerRateId = typeof item.id === 'string' ? item.id : undefined
        const carrier = typeof item.carrier === 'string' ? item.carrier : undefined
        const service = typeof item.service === 'string' ? item.service : undefined
        const deliveryDaysRaw = item.delivery_days
        const estimatedDays =
          typeof deliveryDaysRaw === 'number'
            ? Math.round(deliveryDaysRaw)
            : typeof deliveryDaysRaw === 'string' && Number.isFinite(Number(deliveryDaysRaw))
              ? Math.round(Number(deliveryDaysRaw))
              : undefined

        return {
          id: providerRateId ?? `easypost:${carrier ?? 'carrier'}:${service ?? 'service'}:${amountCents}`,
          source: 'EASYPOST' as const,
          carrier,
          service,
          displayName: [carrier, service].filter(Boolean).join(' - ') || 'EasyPost rate',
          amountCents,
          currency: String(item.currency ?? input.currency ?? 'USD').toUpperCase(),
          estimatedDays,
          providerRateId,
          metadata: {
            shipmentId: payload?.id,
          },
        } satisfies ShippingRateQuote
      })
      .filter((quote) => quote != null)
      .sort((a, b) => a.amountCents - b.amountCents)

    return normalizedQuotes as ShippingRateQuote[]
  },
}
