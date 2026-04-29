import type { ShippingRateQuote, ShippingRateRequest } from '@/server/shipping/shipping-rate.types'

export type ShippingProviderConnectionResult = {
  ok: boolean
  message: string
  accountId?: string
  accountType?: string
}

export type ShippingProviderAdapter = {
  testConnection(input: { apiKey: string }): Promise<ShippingProviderConnectionResult>
  getRates(input: ShippingRateRequest): Promise<ShippingRateQuote[]>
}
