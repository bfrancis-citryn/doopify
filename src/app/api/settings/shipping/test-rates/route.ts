import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { centsToDollars, dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  buildShippingSetupStatus,
  getShippingSetupStore,
} from '@/server/shipping/shipping-setup.service'
import {
  buildDefaultShippingAddressForRates,
  getShippingRatesForCheckout,
  ShippingRateSetupError,
} from '@/server/shipping/shipping-rate.service'

const testRatesSchema = z.object({
  subtotal: z.number().min(0),
  destinationCountry: z.string().trim().min(2).max(3),
  destinationProvince: z.string().trim().max(120).optional().nullable(),
})

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

    const quotes = await getShippingRatesForCheckout({
      storeId: store.id,
      subtotalCents: dollarsToCents(parsed.data.subtotal),
      shippingAddress: buildDefaultShippingAddressForRates({
        country: parsed.data.destinationCountry,
        province: parsed.data.destinationProvince ?? null,
      }),
    })

    return ok({
      mode: setupStatus.mode,
      status: setupStatus,
      quotes: quotes.map((quote) => ({
        ...quote,
        amount: centsToDollars(quote.amountCents),
      })),
    })
  } catch (error) {
    if (error instanceof ShippingRateSetupError) {
      return err(error.message, 400)
    }
    console.error('[POST /api/settings/shipping/test-rates]', error)
    return err('Failed to test shipping rates', 500)
  }
}
