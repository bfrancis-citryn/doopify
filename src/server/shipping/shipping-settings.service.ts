import { type ShippingLiveProvider, type ShippingMode, type ShippingProviderUsage } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type ShippingSettingsUpdate = Partial<{
  shippingMode: ShippingMode
  shippingLiveProvider: ShippingLiveProvider | null
  shippingProviderUsage: ShippingProviderUsage
  shippingThresholdCents: number | null
  shippingDomesticRateCents: number
  shippingInternationalRateCents: number
}>

export async function getShippingSettingsStore() {
  return prisma.store.findFirst({
    include: {
      shippingPackages: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      shippingLocations: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      shippingManualRates: {
        orderBy: [{ createdAt: 'asc' }],
      },
      shippingFallbackRates: {
        orderBy: [{ createdAt: 'asc' }],
      },
      shippingZones: {
        include: {
          rates: {
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}

export async function updateShippingSettings(storeId: string, input: ShippingSettingsUpdate) {
  return prisma.store.update({
    where: { id: storeId },
    data: input,
    include: {
      shippingPackages: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      shippingLocations: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      shippingManualRates: {
        orderBy: [{ createdAt: 'asc' }],
      },
      shippingFallbackRates: {
        orderBy: [{ createdAt: 'asc' }],
      },
      shippingZones: {
        include: {
          rates: {
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}
