import { afterEach, describe, expect, it, vi } from 'vitest'

import { shippoProviderAdapter } from './shippo'

function createResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shippoProviderAdapter.purchaseLabel', () => {
  it('maps a successful Shippo transaction payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse({
          status: 'SUCCESS',
          object_id: 'tx_1',
          shipment: 'shipment_1',
          carrier: 'USPS',
          servicelevel_name: 'Priority Mail',
          label_url: 'https://labels.example.com/tx_1.pdf',
          tracking_number: 'TRACK123',
          tracking_url_provider: 'https://track.example.com/TRACK123',
          amount: '6.42',
          currency: 'USD',
          rate: {
            object_id: 'rate_1',
            amount: '6.42',
            currency: 'USD',
          },
        })
      )
    )

    const result = await shippoProviderAdapter.purchaseLabel({
      apiKey: 'shippo_test_key',
      rateId: 'rate_1',
      shipmentId: 'shipment_1',
      request: {} as never,
    })

    expect(result).toMatchObject({
      providerShipmentId: 'shipment_1',
      providerRateId: 'rate_1',
      providerLabelId: 'tx_1',
      carrier: 'USPS',
      service: 'Priority Mail',
      trackingNumber: 'TRACK123',
      labelAmountCents: 642,
      currency: 'USD',
    })
  })

  it('surfaces merchant-safe reason when Shippo transaction fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse({
          status: 'ERROR',
          shipment: 'shipment_1',
          messages: [{ code: 'address_invalid', text: 'Destination address is invalid' }],
        })
      )
    )

    await expect(
      shippoProviderAdapter.purchaseLabel({
        apiKey: 'shippo_test_key',
        rateId: 'rate_1',
        shipmentId: 'shipment_1',
        request: {} as never,
      })
    ).rejects.toThrow('Shippo label purchase failed: Provider rejected the address.')

    expect(errorSpy).toHaveBeenCalled()
  })
})
