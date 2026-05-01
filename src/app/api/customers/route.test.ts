import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCustomers: vi.fn(),
  createCustomer: vi.fn(),
  addCustomerAddress: vi.fn(),
  getCustomer: vi.fn(),
}))

vi.mock('@/server/services/customer.service', () => ({
  getCustomers: mocks.getCustomers,
  createCustomer: mocks.createCustomer,
  addCustomerAddress: mocks.addCustomerAddress,
  getCustomer: mocks.getCustomer,
}))

import { POST } from './route'

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a manual customer and persists optional addresses', async () => {
    mocks.createCustomer.mockResolvedValue({ id: 'cust_1', email: 'sam@example.com' })
    mocks.addCustomerAddress.mockResolvedValue({})
    mocks.getCustomer.mockResolvedValue({
      id: 'cust_1',
      email: 'sam@example.com',
      addresses: [{ id: 'addr_1', address1: '123 Main St', isDefault: true }],
    })

    const response = await POST(
      new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sam@example.com',
          firstName: 'Sam',
          lastName: 'Harper',
          shippingAddress: '123 Main St',
          billingAddress: '900 Billing Ln',
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.createCustomer).toHaveBeenCalledWith({
      email: 'sam@example.com',
      firstName: 'Sam',
      lastName: 'Harper',
      phone: undefined,
      acceptsMarketing: undefined,
      tags: undefined,
      note: undefined,
    })
    expect(mocks.addCustomerAddress).toHaveBeenCalledTimes(2)
    expect(await response.json()).toEqual({
      success: true,
      data: {
        id: 'cust_1',
        email: 'sam@example.com',
        addresses: [{ id: 'addr_1', address1: '123 Main St', isDefault: true }],
      },
    })
  })

  it('returns unique-email safe error message', async () => {
    mocks.createCustomer.mockRejectedValue(new Error('Unique constraint failed'))

    const response = await POST(
      new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'existing@example.com' }),
      })
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: 'A customer with this email already exists',
    })
  })
})
