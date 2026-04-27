import { prisma } from '@/lib/prisma'

export async function getStoreSettings() {
  return prisma.store.findFirst()
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
    shippingThreshold: number
    shippingDomesticRate: number
    shippingInternationalRate: number
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
    shippingThreshold: store.shippingThreshold,
    shippingDomesticRate: store.shippingDomesticRate,
    shippingInternationalRate: store.shippingInternationalRate,
    domesticTaxRate: store.domesticTaxRate,
    internationalTaxRate: store.internationalTaxRate,
  }
}
