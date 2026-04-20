import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth'
import { loginUser } from '@/server/services/auth.service'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; password: string }>(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0].message)
  }

  try {
    const { token, user } = await loginUser(parsed.data.email, parsed.data.password)

    const res = ok({ user })
    setAuthCookie(res, token)
    return res
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Login failed'
    return err(message, 401)
  }
}
