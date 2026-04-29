import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { listAbandonedCheckouts } from '@/server/services/abandoned-checkout.service'

function parsePage(value: string | null, fallback: number) {
  const parsed = Number(value ?? '')
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const data = await listAbandonedCheckouts({
      page: parsePage(searchParams.get('page'), 1),
      pageSize: Math.min(100, parsePage(searchParams.get('pageSize'), 20)),
      search: searchParams.get('search') ?? undefined,
    })

    return ok(data)
  } catch (error) {
    console.error('[GET /api/abandoned-checkouts]', error)
    return err('Failed to fetch abandoned checkouts', 500)
  }
}
