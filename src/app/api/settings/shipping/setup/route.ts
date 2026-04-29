import { z } from 'zod'

import { centsToDollars, dollarsToCents } from '@/lib/money'
import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  buildShippingSetupStatus,
  getShippingSetupStore,
  updateShippingSetup,
} from '@/server/shipping/shipping-setup.service'

const setupPatchSchema = z.object({
  shippingMode: z.enum(['MANUAL', 'LIVE_RATES', 'HYBRID']).optional(),
  shippingLiveProvider: z.enum(['EASYPOST', 'SHIPPO']).nullable().optional(),
  shippingOriginName: z.string().max(120).nullable().optional(),
  shippingOriginPhone: z.string().max(64).nullable().optional(),
  shippingOriginAddress1: z.string().max(160).nullable().optional(),
  shippingOriginAddress2: z.string().max(160).nullable().optional(),
  shippingOriginCity: z.string().max(120).nullable().optional(),
  shippingOriginProvince: z.string().max(120).nullable().optional(),
  shippingOriginPostalCode: z.string().max(32).nullable().optional(),
  shippingOriginCountry: z.string().max(3).nullable().optional(),
  defaultPackageWeightOz: z.number().int().min(1).max(999999).nullable().optional(),
  defaultPackageLengthIn: z.number().positive().max(9999).nullable().optional(),
  defaultPackageWidthIn: z.number().positive().max(9999).nullable().optional(),
  defaultPackageHeightIn: z.number().positive().max(9999).nullable().optional(),
  defaultLabelFormat: z.string().max(24).nullable().optional(),
  defaultLabelSize: z.string().max(24).nullable().optional(),
  shippingFallbackEnabled: z.boolean().optional(),
  shippingThreshold: z.number().min(0).nullable().optional(),
  shippingDomesticRate: z.number().min(0).optional(),
  shippingInternationalRate: z.number().min(0).optional(),
})

function normalizeOptional(value: string | null | undefined) {
  if (value == null) return null
  const normalized = value.trim()
  return normalized || null
}

function serializeSetupSnapshot(store: any) {
  return {
    shippingMode: store.shippingMode,
    shippingLiveProvider: store.shippingLiveProvider,
    shippingOriginName: store.shippingOriginName,
    shippingOriginPhone: store.shippingOriginPhone,
    shippingOriginAddress1: store.shippingOriginAddress1,
    shippingOriginAddress2: store.shippingOriginAddress2,
    shippingOriginCity: store.shippingOriginCity,
    shippingOriginProvince: store.shippingOriginProvince,
    shippingOriginPostalCode: store.shippingOriginPostalCode,
    shippingOriginCountry: store.shippingOriginCountry,
    defaultPackageWeightOz: store.defaultPackageWeightOz,
    defaultPackageLengthIn: store.defaultPackageLengthIn,
    defaultPackageWidthIn: store.defaultPackageWidthIn,
    defaultPackageHeightIn: store.defaultPackageHeightIn,
    defaultLabelFormat: store.defaultLabelFormat,
    defaultLabelSize: store.defaultLabelSize,
    shippingFallbackEnabled: store.shippingFallbackEnabled,
    shippingThreshold: store.shippingThresholdCents == null ? null : centsToDollars(store.shippingThresholdCents),
    shippingDomesticRate: centsToDollars(store.shippingDomesticRateCents),
    shippingInternationalRate: centsToDollars(store.shippingInternationalRateCents),
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = setupPatchSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping setup payload is invalid', parsed.error.flatten())
  }

  try {
    const store = await getShippingSetupStore()
    if (!store) return err('Store not configured', 404)

    const updated = await updateShippingSetup(store.id, {
      ...(parsed.data.shippingMode !== undefined ? { shippingMode: parsed.data.shippingMode } : {}),
      ...(parsed.data.shippingLiveProvider !== undefined
        ? { shippingLiveProvider: parsed.data.shippingLiveProvider }
        : {}),
      ...(parsed.data.shippingOriginName !== undefined
        ? { shippingOriginName: normalizeOptional(parsed.data.shippingOriginName) }
        : {}),
      ...(parsed.data.shippingOriginPhone !== undefined
        ? { shippingOriginPhone: normalizeOptional(parsed.data.shippingOriginPhone) }
        : {}),
      ...(parsed.data.shippingOriginAddress1 !== undefined
        ? { shippingOriginAddress1: normalizeOptional(parsed.data.shippingOriginAddress1) }
        : {}),
      ...(parsed.data.shippingOriginAddress2 !== undefined
        ? { shippingOriginAddress2: normalizeOptional(parsed.data.shippingOriginAddress2) }
        : {}),
      ...(parsed.data.shippingOriginCity !== undefined
        ? { shippingOriginCity: normalizeOptional(parsed.data.shippingOriginCity) }
        : {}),
      ...(parsed.data.shippingOriginProvince !== undefined
        ? { shippingOriginProvince: normalizeOptional(parsed.data.shippingOriginProvince) }
        : {}),
      ...(parsed.data.shippingOriginPostalCode !== undefined
        ? { shippingOriginPostalCode: normalizeOptional(parsed.data.shippingOriginPostalCode) }
        : {}),
      ...(parsed.data.shippingOriginCountry !== undefined
        ? { shippingOriginCountry: normalizeOptional(parsed.data.shippingOriginCountry)?.toUpperCase() ?? null }
        : {}),
      ...(parsed.data.defaultPackageWeightOz !== undefined
        ? { defaultPackageWeightOz: parsed.data.defaultPackageWeightOz }
        : {}),
      ...(parsed.data.defaultPackageLengthIn !== undefined
        ? { defaultPackageLengthIn: parsed.data.defaultPackageLengthIn }
        : {}),
      ...(parsed.data.defaultPackageWidthIn !== undefined
        ? { defaultPackageWidthIn: parsed.data.defaultPackageWidthIn }
        : {}),
      ...(parsed.data.defaultPackageHeightIn !== undefined
        ? { defaultPackageHeightIn: parsed.data.defaultPackageHeightIn }
        : {}),
      ...(parsed.data.defaultLabelFormat !== undefined
        ? { defaultLabelFormat: normalizeOptional(parsed.data.defaultLabelFormat)?.toUpperCase() ?? null }
        : {}),
      ...(parsed.data.defaultLabelSize !== undefined
        ? { defaultLabelSize: normalizeOptional(parsed.data.defaultLabelSize) }
        : {}),
      ...(parsed.data.shippingFallbackEnabled !== undefined
        ? { shippingFallbackEnabled: parsed.data.shippingFallbackEnabled }
        : {}),
      ...(parsed.data.shippingThreshold !== undefined
        ? {
            shippingThresholdCents:
              parsed.data.shippingThreshold == null ? null : dollarsToCents(parsed.data.shippingThreshold),
          }
        : {}),
      ...(parsed.data.shippingDomesticRate !== undefined
        ? { shippingDomesticRateCents: dollarsToCents(parsed.data.shippingDomesticRate) }
        : {}),
      ...(parsed.data.shippingInternationalRate !== undefined
        ? { shippingInternationalRateCents: dollarsToCents(parsed.data.shippingInternationalRate) }
        : {}),
    })

    const status = await buildShippingSetupStatus(updated)
    return ok({
      setup: serializeSetupSnapshot(updated),
      status,
    })
  } catch (error) {
    console.error('[PATCH /api/settings/shipping/setup]', error)
    const message = error instanceof Error ? error.message : 'Failed to update shipping setup'
    return err(message, 400)
  }
}
