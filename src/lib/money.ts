const MINOR_UNIT_SCALE = 100

function parseMoneyInput(value: number | string) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      throw new Error('Money value is required')
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid money value: ${value}`)
    }
    return parsed
  }

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid money value: ${value}`)
  }

  return value
}

export function assertValidCents(value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`Invalid cents value: ${value}`)
  }
  return value
}

export function dollarsToCents(value: number | string) {
  const parsed = parseMoneyInput(value)
  return assertValidCents(Math.round(parsed * MINOR_UNIT_SCALE))
}

export function centsToDollars(cents: number) {
  return assertValidCents(cents) / MINOR_UNIT_SCALE
}

export function formatCents(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(centsToDollars(cents))
}

export function toMinorUnit(value: number | string) {
  return dollarsToCents(value)
}

export function fromMinorUnit(value: number) {
  return centsToDollars(value)
}
