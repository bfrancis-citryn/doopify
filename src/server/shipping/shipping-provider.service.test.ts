import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    integration: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    integrationSecret: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, '')),
  easypostTestConnection: vi.fn(),
  easypostGetRates: vi.fn(),
  shippoTestConnection: vi.fn(),
  shippoGetRates: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/utils/crypto', () => ({
  encrypt: mocks.encrypt,
  decrypt: mocks.decrypt,
}))
vi.mock('./providers/easypost', () => ({
  easypostProviderAdapter: {
    testConnection: mocks.easypostTestConnection,
    getRates: mocks.easypostGetRates,
  },
}))
vi.mock('./providers/shippo', () => ({
  shippoProviderAdapter: {
    testConnection: mocks.shippoTestConnection,
    getRates: mocks.shippoGetRates,
  },
}))

import {
  connectShippingProvider,
  disconnectShippingProvider,
  getShippingProviderConnectionStatus,
  providerToIntegrationType,
  testShippingProviderConnection,
} from './shipping-provider.service'

describe('shipping provider service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback(mocks.prisma))
  })

  it('maps provider to integration type', () => {
    expect(providerToIntegrationType('EASYPOST')).toBe('SHIPPING_EASYPOST')
    expect(providerToIntegrationType('SHIPPO')).toBe('SHIPPING_SHIPPO')
  })

  it('connects provider credentials using encrypted integration secrets', async () => {
    mocks.prisma.integration.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'int_1',
        type: 'SHIPPING_EASYPOST',
        status: 'ACTIVE',
        updatedAt: new Date('2026-04-29T18:40:00.000Z'),
        secrets: [{ key: 'API_KEY', value: 'enc:ep_test_key' }],
      })
    mocks.prisma.integration.create.mockResolvedValue({ id: 'int_1' })
    mocks.prisma.integrationSecret.upsert.mockResolvedValue({ id: 'sec_1' })

    const status = await connectShippingProvider({
      provider: 'EASYPOST',
      apiKey: 'ep_test_key',
    })

    expect(mocks.encrypt).toHaveBeenCalledWith('ep_test_key')
    expect(mocks.prisma.integrationSecret.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'API_KEY',
          value: 'enc:ep_test_key',
        }),
        update: expect.objectContaining({
          value: 'enc:ep_test_key',
        }),
      })
    )
    expect(status).toMatchObject({
      provider: 'EASYPOST',
      connected: true,
      hasCredentials: true,
    })
  })

  it('disconnects provider and reports inactive status', async () => {
    mocks.prisma.integration.findFirst
      .mockResolvedValueOnce({
        id: 'int_2',
        type: 'SHIPPING_SHIPPO',
        status: 'ACTIVE',
        updatedAt: new Date('2026-04-29T18:41:00.000Z'),
        secrets: [{ key: 'API_KEY', value: 'enc:shippo_test_key' }],
      })
      .mockResolvedValueOnce({
        id: 'int_2',
        type: 'SHIPPING_SHIPPO',
        status: 'INACTIVE',
        updatedAt: new Date('2026-04-29T18:41:30.000Z'),
        secrets: [{ key: 'API_KEY', value: 'enc:shippo_test_key' }],
      })
    mocks.prisma.integration.update.mockResolvedValue({ id: 'int_2', status: 'INACTIVE' })
    mocks.prisma.integration.updateMany.mockResolvedValue({ count: 0 })
    mocks.prisma.integrationSecret.deleteMany.mockResolvedValue({ count: 1 })

    const status = await disconnectShippingProvider({
      provider: 'SHIPPO',
      clearCredentials: true,
    })

    expect(mocks.prisma.integration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'int_2' },
        data: { status: 'INACTIVE' },
      })
    )
    expect(mocks.prisma.integrationSecret.deleteMany).toHaveBeenCalled()
    expect(status).toMatchObject({
      provider: 'SHIPPO',
      integrationStatus: 'INACTIVE',
      connected: false,
    })
  })

  it('tests provider connection using decrypted saved credentials', async () => {
    mocks.prisma.integration.findFirst
      .mockResolvedValueOnce({
        id: 'int_1',
        type: 'SHIPPING_EASYPOST',
        status: 'ACTIVE',
        updatedAt: new Date('2026-04-29T18:42:00.000Z'),
        secrets: [{ key: 'API_KEY', value: 'enc:ep_test_key' }],
      })
      .mockResolvedValueOnce({
        id: 'int_1',
        type: 'SHIPPING_EASYPOST',
        status: 'ACTIVE',
        updatedAt: new Date('2026-04-29T18:42:00.000Z'),
        secrets: [{ key: 'API_KEY', value: 'enc:ep_test_key' }],
      })
    mocks.easypostTestConnection.mockResolvedValue({
      ok: true,
      message: 'EasyPost connection successful.',
      accountId: 'user_123',
    })

    const payload = await testShippingProviderConnection('EASYPOST')

    expect(mocks.decrypt).toHaveBeenCalledWith('enc:ep_test_key')
    expect(mocks.easypostTestConnection).toHaveBeenCalledWith({
      apiKey: 'ep_test_key',
    })
    expect(payload).toMatchObject({
      provider: 'EASYPOST',
      result: {
        ok: true,
      },
    })
  })

  it('reports disconnected provider when no active credentials exist', async () => {
    mocks.prisma.integration.findFirst.mockResolvedValue({
      id: 'int_3',
      type: 'SHIPPING_EASYPOST',
      status: 'INACTIVE',
      updatedAt: new Date('2026-04-29T18:43:00.000Z'),
      secrets: [],
    })

    const status = await getShippingProviderConnectionStatus('EASYPOST')
    expect(status).toMatchObject({
      integrationStatus: 'INACTIVE',
      connected: false,
      hasCredentials: false,
    })
  })
})
