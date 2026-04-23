import { err, ok } from '@/lib/api'
import { getStorefrontCollectionSummaries } from '@/server/services/collection.service'

export async function GET() {
  try {
    const collections = await getStorefrontCollectionSummaries()
    return ok(collections)
  } catch (error) {
    console.error('[GET /api/storefront/collections]', error)
    return err('Failed to fetch collections', 500)
  }
}
