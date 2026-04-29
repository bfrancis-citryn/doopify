import { err, ok } from '@/lib/api'
import { recoverCheckoutByToken } from '@/server/services/abandoned-checkout.service'

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim()
  if (!token) {
    return err('token is required', 400)
  }

  try {
    const result = await recoverCheckoutByToken(token)

    if (!result.ok) {
      if (result.reason === 'INVALID_TOKEN') {
        return err('Invalid recovery token', 404)
      }
      if (result.reason === 'COMPLETED') {
        return err('Checkout has already been completed', 409)
      }
      if (result.reason === 'NOT_RECOVERABLE') {
        return err('Checkout is not recoverable', 400)
      }
      return err('Checkout recovery data is unavailable', 400)
    }

    return ok(result.checkout)
  } catch (error) {
    console.error('[GET /api/checkout/recover]', error)
    return err('Failed to recover checkout', 500)
  }
}
