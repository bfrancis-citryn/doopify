import { ok, err } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  isEditableTemplateKey,
  resetEmailTemplateSetting,
} from '@/server/services/email-template-settings.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ templateKey: string }>
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { templateKey } = await params

  if (!isEditableTemplateKey(templateKey)) {
    return err('Template not found or not editable', 404)
  }

  try {
    const setting = await resetEmailTemplateSetting(templateKey)
    return ok(setting)
  } catch (e) {
    console.error(`[POST /api/email-templates/${templateKey}/reset]`, e)
    return err('Failed to reset template settings', 500)
  }
}
