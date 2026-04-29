export type ShippingRateQuote = {
  id: string
  source: 'MANUAL' | 'EASYPOST' | 'SHIPPO'
  carrier?: string
  service?: string
  displayName: string
  amountCents: number
  currency: string
  estimatedDays?: number
  providerRateId?: string
  metadata?: Record<string, unknown>
}

export type ShippingRateAddress = {
  name?: string | null
  phone?: string | null
  email?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  country?: string | null
}

export type ShippingRateParcel = {
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
}

export type ShippingRateRequest = {
  apiKey: string
  originAddress: ShippingRateAddress
  destinationAddress: ShippingRateAddress
  parcel: ShippingRateParcel
  currency: string
}
