export type ShippingProviderConnectionResult = {
  ok: boolean
  message: string
  accountId?: string
  accountType?: string
}

export type ShippingProviderAdapter = {
  testConnection(input: { apiKey: string }): Promise<ShippingProviderConnectionResult>
}
