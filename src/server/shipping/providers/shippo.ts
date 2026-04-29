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

function resolveShippoLabelFileType(input: { labelFormat?: string; labelSize?: string }) {
  const format = String(input.labelFormat ?? 'PDF')
    .trim()
    .toUpperCase()
  const size = String(input.labelSize ?? '4x6')
    .trim()
    .toLowerCase()

  if (format === 'PNG') return 'PNG'
  if (format === 'ZPL') return 'ZPLII'
  if (size === '8.5x11') return 'PDF'
  return 'PDF_4x6'
}

function normalizeLifecycleStatus(value: unknown) {
  const status = String(value ?? '')
    .trim()
    .toUpperCase()
  if (!status) return 'UNKNOWN' as const
  if (status.includes('DELIVER')) return 'DELIVERED' as const
  if (status.includes('TRANSIT')) return 'IN_TRANSIT' as const
  if (status.includes('PRE_TRANSIT') || status.includes('LABEL')) return 'PRE_TRANSIT' as const
  if (status.includes('FAIL') || status.includes('RETURN') || status.includes('EXCEPTION')) return 'FAILURE' as const
  return 'UNKNOWN' as const
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
  async purchaseLabel(input) {
    const response = await fetch(`${SHIPPO_API_BASE}/transactions/`, {
      method: 'POST',
      headers: {
        Authorization: `ShippoToken ${input.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        rate: input.rateId,
        async: false,
        label_file_type: resolveShippoLabelFileType({
          labelFormat: input.labelFormat,
          labelSize: input.labelSize,
        }),
      }),
    })

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(`Shippo label purchase failed (${response.status}): ${truncate(bodyText || 'Request failed')}`)
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      payload = null
    }

    const status = String(payload?.status ?? '').toUpperCase()
    if (status && status !== 'SUCCESS' && status !== 'QUEUED') {
      const message = typeof payload?.messages === 'string' ? payload.messages : 'Transaction was not successful'
      throw new Error(`Shippo label purchase failed: ${message}`)
    }

    const rate = payload?.rate as Record<string, unknown> | undefined

    return {
      providerShipmentId: typeof payload?.shipment === 'string' ? payload.shipment : undefined,
      providerRateId: typeof rate?.object_id === 'string' ? rate.object_id : input.rateId,
      providerLabelId: typeof payload?.object_id === 'string' ? payload.object_id : undefined,
      carrier: typeof payload?.carrier === 'string' ? payload.carrier : undefined,
      service: typeof payload?.servicelevel_name === 'string' ? payload.servicelevel_name : undefined,
      status: status || 'PURCHASED',
      labelUrl: typeof payload?.label_url === 'string' ? payload.label_url : undefined,
      trackingNumber: typeof payload?.tracking_number === 'string' ? payload.tracking_number : undefined,
      trackingUrl: typeof payload?.tracking_url_provider === 'string' ? payload.tracking_url_provider : undefined,
      rateAmountCents: normalizeMoneyToCents(rate?.amount) ?? undefined,
      labelAmountCents: normalizeMoneyToCents(payload?.amount ?? rate?.amount) ?? undefined,
      currency: String(payload?.currency ?? rate?.currency ?? input.request.currency ?? 'USD').toUpperCase(),
      rawResponse: payload ?? undefined,
    }
  },
  async getTrackingStatus(input) {
    const carrier = String(input.carrier ?? '')
      .trim()
      .toLowerCase()
    const trackingNumber = String(input.trackingNumber ?? '').trim()

    if (!carrier || !trackingNumber) {
      throw new Error('Shippo tracking lookup requires carrier and tracking number')
    }

    const response = await fetch(
      `${SHIPPO_API_BASE}/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `ShippoToken ${input.apiKey}`,
          Accept: 'application/json',
        },
      }
    )

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(
        `Shippo tracking status request failed (${response.status}): ${truncate(bodyText || 'Request failed')}`
      )
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      payload = null
    }

    const trackingStatus = payload?.tracking_status as Record<string, unknown> | undefined
    const providerStatus =
      typeof trackingStatus?.status === 'string'
        ? trackingStatus.status
        : typeof payload?.status === 'string'
          ? payload.status
          : 'unknown'
    const trackingUrl =
      typeof payload?.tracking_url_provider === 'string'
        ? payload.tracking_url_provider
        : typeof payload?.tracking_url === 'string'
          ? payload.tracking_url
          : undefined
    const deliveredAt =
      normalizeLifecycleStatus(providerStatus) === 'DELIVERED'
        ? typeof trackingStatus?.status_date === 'string'
          ? trackingStatus.status_date
          : typeof payload?.eta === 'string'
            ? payload.eta
            : undefined
        : undefined

    return {
      providerStatus,
      lifecycleStatus: normalizeLifecycleStatus(providerStatus),
      deliveredAt,
      trackingNumber,
      trackingUrl,
      rawResponse: payload ?? undefined,
    }
  },
}
