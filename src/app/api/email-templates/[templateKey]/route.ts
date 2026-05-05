import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'
import {
  getEmailTemplateSetting,
  isEditableTemplateKey,
  upsertEmailTemplateSetting,
} from '@/server/services/email-template-settings.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ templateKey: string }>
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  subject: z.string().max(500).optional(),
  preheader: z.string().max(500).optional(),
  headerTitle: z.string().max(200).optional(),
  bodyText: z.string().max(4000).optional(),
  buttonLabel: z.string().max(100).optional(),
  footerText: z.string().max(500).optional(),
  replyToEmail: z.string().email().nullable().optional(),
})

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { templateKey } = await params

  if (!isEditableTemplateKey(templateKey)) {
    return err('Template not found or not editable', 404)
  }

  try {
    const setting = await getEmailTemplateSetting(templateKey)
    return ok(setting)
  } catch (e) {
    console.error(`[GET /api/email-templates/${templateKey}]`, e)
    return err('Failed to load template settings', 500)
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { templateKey } = await params

  if (!isEditableTemplateKey(templateKey)) {
    return err('Template not found or not editable', 404)
  }

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const setting = await upsertEmailTemplateSetting(templateKey, parsed.data)
    await recordAuditLogBestEffort({
      action: 'email_template.updated',
      actor: auditActorFromUser(auth.user),
      resource: { type: 'EmailTemplateSetting', id: templateKey },
      summary: `Email template updated: ${templateKey}`,
      snapshot: {
        templateKey,
        updatedFields: Object.keys(parsed.data).sort(),
        enabled: setting.fields.enabled,
      },
      redactions: ['template_html', 'template_body'],
    })
    return ok(setting)
  } catch (e) {
    console.error(`[PATCH /api/email-templates/${templateKey}]`, e)
    return err('Failed to save template settings', 500)
  }
}
