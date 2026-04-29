import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getBrandKit: vi.fn(),
  updateBrandKit: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/settings.service', () => ({
  getBrandKit: mocks.getBrandKit,
  updateBrandKit: mocks.updateBrandKit,
}))

import { GET, PATCH } from './route'

describe('settings brand kit route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/settings/brand-kit requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/settings/brand-kit'))
    expect(response.status).toBe(401)
    expect(mocks.getBrandKit).not.toHaveBeenCalled()
  })

  it('PATCH /api/settings/brand-kit requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/brand-kit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: '#000000' }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.updateBrandKit).not.toHaveBeenCalled()
  })

  it('VIEWER cannot update brand kit', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/brand-kit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: '#000000' }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.updateBrandKit).not.toHaveBeenCalled()
  })

  it('invalid color returns validation error', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', role: 'STAFF' },
    })
    mocks.updateBrandKit.mockRejectedValue(
      new ZodError([
        {
          code: 'custom',
          message: 'Must be a valid 6-digit hex color',
          path: ['primaryColor'],
        },
      ])
    )

    const response = await PATCH(
      new Request('http://localhost/api/settings/brand-kit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: 'blue' }),
      })
    )

    expect(response.status).toBe(422)
  })

  it('successful update returns updated brand kit', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.updateBrandKit.mockResolvedValue({
      name: 'Doopify Demo',
      primaryColor: '#101010',
      secondaryColor: '#ffffff',
      accentColor: '#2B6CF3',
      headingFont: 'inter',
      bodyFont: 'system',
      buttonStyle: 'solid',
      buttonRadius: 'md',
      buttonTextTransform: 'normal',
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/brand-kit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: '#101010' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.updateBrandKit).toHaveBeenCalledWith({ primaryColor: '#101010' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/checkout')
  })
})
