import { env } from '@/lib/env'

export function getJobRunnerSecret() {
  return env.JOB_RUNNER_SECRET ?? env.WEBHOOK_RETRY_SECRET ?? null
}

export function isJobRunnerAuthorized(req: Request) {
  const secret = getJobRunnerSecret()
  if (!secret) return false

  const authorization = req.headers.get('authorization')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null
  const headerSecret = req.headers.get('x-job-runner-secret')
  const legacyHeaderSecret = req.headers.get('x-webhook-retry-secret')

  return bearer === secret || headerSecret === secret || legacyHeaderSecret === secret
}
