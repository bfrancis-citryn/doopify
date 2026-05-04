import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getCustomers: vi.fn(),
  createCustomer: vi.fn(),
  addCustomerAddress: vi.fn(),
  getCustomer: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/customer.service', () => ({
  getCustomers: mocks.getCustomers,
  createCustomer: mocks.createCustomer,
  addCustomerAddress: mocks.addCustomerAddress,
  getCustomer: mocks.getCustomer,
}))

import { GET, POST } from './route'

const authedAdmin = { ok: true, user: { id: 'admin_1', role: 'OWNER' } }
const unauthorizedResponse = new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 })

function makePostRequest(body: object) {
  return new Request('http://localhost/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue(authedAdmin)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: unauthorizedResponse })

    const response = await GET(new Request('http://localhost/api/customers'))
    expect(response.status).toBe(401)
  })

  it('returns customer list for authenticated admin', async () => {
    mocks.getCustomers.mockResolvedValue({ customers: [], pagination: { page: 1, total: 0 } })

    const response = await GET(new Request('http://localhost/api/customers'))
    expect(response.status).toBe(200)
    expect(mocks.getCustomers).toHaveBeenCalled()
  })
})

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue(authedAdmin)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: unauthorizedResponse })

    const response = await POST(makePostRequest({ email: 'test@example.com' }))
    expect(response.status).toBe(401)
    expect(mocks.createCustomer).not.toHaveBeenCalled()
  })

  it('creates a manual customer and persists optional addresses', async () => {
    mocks.createCustomer.mockResolvedValue({ id: 'cust_1', email: 'sam@example.com' })
    mocks.addCustomerAddress.mockResolvedValue({})
    mocks.getCustomer.mockResolvedValue({
      id: 'cust_1',
      email: 'sam@example.com',
      addresses: [{ id: 'addr_1', address1: '123 Main St', isDefault: true }],
    })

    const response = await POST(makePostRequest({
      email: 'sam@example.com',
      firstName: 'Sam',
      lastName: 'Harper',
      shippingAddress: '123 Main St',
      billingAddress: '900 Billing Ln',
    }))

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

  it('returns friendly error message on duplicate email', async () => {
    mocks.createCustomer.mockRejectedValue(new Error('Unique constraint failed'))

    const response = await POST(makePostRequest({ email: 'existing@example.com' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'A customer with this email already exists',
    })
  })

  it('rejects invalid email', async () => {
    const response = await POST(makePostRequest({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
  })
})
