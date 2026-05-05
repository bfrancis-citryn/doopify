import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import { exportCustomerData } from '@/server/services/customer.service'

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const bundle = await exportCustomerData(id)
    if (!bundle) return err('Customer not found', 404)

    await recordAuditLogBestEffort({
      action: 'customer.data_exported',
      actor: auditActorFromUser(auth.user),
      resource: { type: 'Customer', id },
      summary: `Customer data exported for ${id}`,
      snapshot: { customerId: id, exportedAt: bundle.exportedAt },
    })

    return ok(bundle)
  } catch (error) {
    console.error('[GET /api/customers/[id]/export]', error)
    return err('Failed to export customer data', 500)
  }
}
