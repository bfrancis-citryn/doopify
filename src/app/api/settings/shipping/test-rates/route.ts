import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { centsToDollars, dollarsToCents } from '@/lib/money'
import { buildCheckoutPricingWithDecisionsCents } from '@/server/checkout/pricing'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  buildShippingSetupStatus,
  getShippingSetupStore,
} from '@/server/shipping/shipping-setup.service'

const testRatesSchema = z.object({
  subtotal: z.number().min(0),
  destinationCountry: z.string().trim().min(2).max(3),
  destinationProvince: z.string().trim().max(120).optional().nullable(),
})

function mapShippingDecisionLabel(decision: ReturnType<typeof buildCheckoutPricingWithDecisionsCents>['shippingDecision']) {
  if (decision.source === 'threshold') return 'Free shipping threshold'
  if (decision.source === 'zone') {
    if (decision.zoneName && decision.rateName) return `${decision.zoneName} - ${decision.rateName}`
    if (decision.rateName) return decision.rateName
  }
  if (decision.source === 'fallback') return 'Fallback shipping rate'
  return 'No shipping charge'
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = testRatesSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping rate test payload is invalid', parsed.error.flatten())
  }

  try {
    const store = await getShippingSetupStore()
    if (!store) return err('Store not configured', 404)

    const setupStatus = await buildShippingSetupStatus(store)

    if (setupStatus.mode === 'LIVE_RATES' && !setupStatus.canUseLiveRates) {
      return err('Live rates are not ready yet. Connect provider and complete setup first.', 400)
    }

    if (!setupStatus.canUseManualRates && !setupStatus.canUseLiveRates) {
      return err('Shipping is not configured yet. Complete setup steps and try again.', 400)
    }

    const pricing = buildCheckoutPricingWithDecisionsCents(
      [
        {
          priceCents: dollarsToCents(parsed.data.subtotal),
          quantity: 1,
        },
      ],
      store.shippingThresholdCents,
      {
        shippingAddress: {
          country: parsed.data.destinationCountry,
          province: parsed.data.destinationProvince ?? undefined,
        },
        storeCountry: store.country,
        shippingRates: {
          domesticCents: store.shippingDomesticRateCents,
          internationalCents: store.shippingInternationalRateCents,
        },
        shippingZones: store.shippingZones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          countryCode: zone.countryCode,
          provinceCode: zone.provinceCode,
          isActive: zone.isActive,
          priority: zone.priority,
          rates: zone.rates.map((rate) => ({
            id: rate.id,
            name: rate.name,
            method: rate.method,
            amountCents: rate.amountCents,
            minSubtotalCents: rate.minSubtotalCents,
            maxSubtotalCents: rate.maxSubtotalCents,
            isActive: rate.isActive,
            priority: rate.priority,
          })),
        })),
      }
    )

    const quote = {
      source: 'MANUAL' as const,
      displayName: mapShippingDecisionLabel(pricing.shippingDecision),
      amountCents: pricing.shippingAmountCents,
      amount: centsToDollars(pricing.shippingAmountCents),
      currency: store.currency.toUpperCase(),
      decision: pricing.shippingDecision,
    }

    return ok({
      mode: setupStatus.mode,
      status: setupStatus,
      quote,
    })
  } catch (error) {
    console.error('[POST /api/settings/shipping/test-rates]', error)
    return err('Failed to test shipping rates', 500)
  }
}
