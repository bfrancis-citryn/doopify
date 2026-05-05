/**
 * Weight unit normalization for shipping rate matching.
 *
 * All weight-based rate matching uses ounces (oz) as the canonical unit.
 * ShippingManualRate.minWeight and maxWeight are stored in oz.
 * Provider label requests use parcel.weightOz.
 */

const UNIT_ALIASES: Record<string, string> = {
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
}

function normalizeUnit(unit: string | null | undefined): string {
  const raw = String(unit || 'oz').trim().toLowerCase()
  return UNIT_ALIASES[raw] ?? 'oz'
}

/**
 * Convert a variant weight value to ounces for rate matching.
 * Returns 0 for missing, zero, or non-finite weights.
 */
export function convertVariantWeightToOz(
  weight: number | null | undefined,
  unit: string | null | undefined
): number {
  if (!Number.isFinite(weight) || Number(weight) <= 0) return 0

  const normalizedUnit = normalizeUnit(unit)
  const w = Number(weight)

  switch (normalizedUnit) {
    case 'lb':
      return w * 16
    case 'g':
      return w * 0.0352739619
    case 'kg':
      return w * 35.2739619
    default:
      return w
  }
}

/**
 * Aggregate total cart weight in ounces from resolved line items.
 * Items without a weight contribute 0 oz.
 */
export function totalCartWeightOz(
  items: Array<{ weightOz?: number | null; quantity: number }>
): number {
  return items.reduce(
    (sum, item) => sum + Number(item.weightOz || 0) * Number(item.quantity || 0),
    0
  )
}
