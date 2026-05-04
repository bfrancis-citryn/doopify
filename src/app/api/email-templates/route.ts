import { ok, err } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  EDITABLE_TEMPLATE_KEYS,
  getEmailTemplateSetting,
} from '@/server/services/email-template-settings.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const settings = await Promise.all(
      EDITABLE_TEMPLATE_KEYS.map((key) => getEmailTemplateSetting(key))
    )
    return ok({ templates: settings })
  } catch (e) {
    console.error('[GET /api/email-templates]', e)
    return err('Failed to load email template settings', 500)
  }
}
