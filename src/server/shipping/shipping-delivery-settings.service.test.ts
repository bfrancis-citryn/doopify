import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    store: {
      findFirst: vi.fn(),
    },
    shippingPackage: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import { createShippingPackage, updateShippingPackage } from './shipping-delivery-settings.service'

describe('shipping-delivery-settings.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.store.findFirst.mockResolvedValue({ id: 'store_1' })
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma)
    )
  })

  it('createShippingPackage enforces single default package when created as default', async () => {
    mocks.prisma.shippingPackage.create.mockResolvedValue({
      id: 'pkg_new',
      storeId: 'store_1',
      isDefault: true,
    })
    mocks.prisma.shippingPackage.updateMany.mockResolvedValue({ count: 1 })

    await createShippingPackage({
      name: 'My Box',
      type: 'BOX',
      length: 10,
      width: 8,
      height: 4,
      dimensionUnit: 'IN',
      emptyPackageWeight: 12,
      weightUnit: 'OZ',
      isDefault: true,
      isActive: true,
    })

    expect(mocks.prisma.shippingPackage.updateMany).toHaveBeenCalledWith({
      where: {
        storeId: 'store_1',
        id: { not: 'pkg_new' },
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    })
  })

  it('createShippingPackage does not touch other packages when new package is not default', async () => {
    mocks.prisma.shippingPackage.create.mockResolvedValue({
      id: 'pkg_new',
      storeId: 'store_1',
      isDefault: false,
    })

    await createShippingPackage({
      name: 'My Box',
      type: 'BOX',
      length: 10,
      width: 8,
      height: 4,
      dimensionUnit: 'IN',
      emptyPackageWeight: 12,
      weightUnit: 'OZ',
      isDefault: false,
      isActive: true,
    })

    expect(mocks.prisma.shippingPackage.updateMany).not.toHaveBeenCalled()
  })

  it('updateShippingPackage enforces single default package when updated to default', async () => {
    mocks.prisma.shippingPackage.findFirst.mockResolvedValue({
      id: 'pkg_existing',
      storeId: 'store_1',
      isDefault: false,
    })
    mocks.prisma.shippingPackage.update.mockResolvedValue({
      id: 'pkg_existing',
      storeId: 'store_1',
      isDefault: true,
    })
    mocks.prisma.shippingPackage.updateMany.mockResolvedValue({ count: 1 })

    await updateShippingPackage('pkg_existing', {
      isDefault: true,
      name: 'Updated',
    })

    expect(mocks.prisma.shippingPackage.updateMany).toHaveBeenCalledWith({
      where: {
        storeId: 'store_1',
        id: { not: 'pkg_existing' },
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    })
  })

  it('updateShippingPackage throws when package does not belong to store', async () => {
    mocks.prisma.shippingPackage.findFirst.mockResolvedValue(null)

    await expect(
      updateShippingPackage('missing', {
        name: 'Nope',
      })
    ).rejects.toThrow('Package not found')
  })
})
