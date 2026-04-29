import { prisma } from '@/lib/prisma'
import { centsToDollars } from '@/lib/money'

export async function getStoreSettings() {
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
      taxRules: {
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}

export async function updateStoreSettings(
  storeId: string,
  data: Partial<{
    name: string
    email: string
    phone: string
    domain: string
    currency: string
    timezone: string
    logoUrl: string
    primaryColor: string
    secondaryColor: string
    address1: string
    city: string
    province: string
    postalCode: string
    country: string
    shippingThresholdCents: number
    shippingDomesticRateCents: number
    shippingInternationalRateCents: number
    domesticTaxRate: number
    internationalTaxRate: number
  }>
) {
  return prisma.store.update({
    where: { id: storeId },
    data,
  })
}

export async function getPublicStorefrontSettings() {
  const store = await getStoreSettings()
  if (!store) return null

  return {
    name: store.name,
    email: store.email,
    currency: store.currency,
    logoUrl: store.logoUrl,
    primaryColor: store.primaryColor,
    secondaryColor: store.secondaryColor,
    shippingThreshold: store.shippingThresholdCents == null ? null : centsToDollars(store.shippingThresholdCents),
    shippingDomesticRate: centsToDollars(store.shippingDomesticRateCents),
    shippingInternationalRate: centsToDollars(store.shippingInternationalRateCents),
    domesticTaxRate: store.domesticTaxRate,
    internationalTaxRate: store.internationalTaxRate,
  }
}
