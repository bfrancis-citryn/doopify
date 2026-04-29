import { type ShippingLiveProvider, type ShippingMode } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type ShippingSettingsUpdate = Partial<{
  shippingMode: ShippingMode
  shippingLiveProvider: ShippingLiveProvider | null
  shippingThresholdCents: number | null
  shippingDomesticRateCents: number
  shippingInternationalRateCents: number
}>

export async function getShippingSettingsStore() {
  return prisma.store.findFirst({
    include: {
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
