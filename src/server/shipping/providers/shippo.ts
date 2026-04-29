import type { ShippingProviderAdapter } from './types'
import type { ShippingRateQuote } from '@/server/shipping/shipping-rate.types'

const SHIPPO_API_BASE = 'https://api.goshippo.com'

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
  async getRates(input) {
    const response = await fetch(`${SHIPPO_API_BASE}/shipments/`, {
      method: 'POST',
      headers: {
        Authorization: `ShippoToken ${input.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        address_from: {
          name: input.originAddress.name ?? undefined,
          phone: input.originAddress.phone ?? undefined,
          street1: input.originAddress.address1,
          street2: input.originAddress.address2 ?? undefined,
          city: input.originAddress.city,
          state: input.originAddress.province ?? undefined,
          zip: input.originAddress.postalCode,
          country: input.originAddress.country,
        },
        address_to: {
          name: input.destinationAddress.name ?? undefined,
          phone: input.destinationAddress.phone ?? undefined,
          street1: input.destinationAddress.address1,
          street2: input.destinationAddress.address2 ?? undefined,
          city: input.destinationAddress.city,
          state: input.destinationAddress.province ?? undefined,
          zip: input.destinationAddress.postalCode,
          country: input.destinationAddress.country,
        },
        parcels: [
          {
            length: input.parcel.lengthIn,
            width: input.parcel.widthIn,
            height: input.parcel.heightIn,
            distance_unit: 'in',
            weight: input.parcel.weightOz,
            mass_unit: 'oz',
          },
        ],
        async: false,
      }),
    })

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(`Shippo rates request failed (${response.status}): ${truncate(bodyText || 'Request failed')}`)
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      payload = null
    }

    const rates = Array.isArray(payload?.rates) ? payload.rates : []
    const quotes = rates
      .map((rate) => {
        const item = rate as Record<string, unknown>
        const amountCents = normalizeMoneyToCents(item.amount)
        if (amountCents == null) return null

        const providerRateId = typeof item.object_id === 'string' ? item.object_id : undefined
        const provider = item.provider as Record<string, unknown> | undefined
        const serviceLevel = item.servicelevel as Record<string, unknown> | undefined
        const carrier = typeof provider?.carrier === 'string' ? provider.carrier : undefined
        const service = typeof serviceLevel?.name === 'string' ? serviceLevel.name : undefined
        const estimatedDaysRaw = item.estimated_days
        const estimatedDays =
          typeof estimatedDaysRaw === 'number'
            ? Math.round(estimatedDaysRaw)
            : typeof estimatedDaysRaw === 'string' && Number.isFinite(Number(estimatedDaysRaw))
              ? Math.round(Number(estimatedDaysRaw))
              : undefined

        return {
          id: providerRateId ?? `shippo:${carrier ?? 'carrier'}:${service ?? 'service'}:${amountCents}`,
          source: 'SHIPPO' as const,
          carrier,
          service,
          displayName: [carrier, service].filter(Boolean).join(' - ') || 'Shippo rate',
          amountCents,
          currency: String(item.currency ?? input.currency ?? 'USD').toUpperCase(),
          estimatedDays,
          providerRateId,
          metadata: {
            shipmentId: payload?.object_id,
          },
        } satisfies ShippingRateQuote
      })
      .filter((quote) => quote != null)
      .sort((a, b) => a.amountCents - b.amountCents)

    return quotes as ShippingRateQuote[]
  },
}
