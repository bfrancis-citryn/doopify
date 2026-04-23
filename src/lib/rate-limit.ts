type WindowState = {
  count: number
  expiresAt: number
}

const globalForRateLimit = globalThis as unknown as {
  doopifyRateLimitStore?: Map<string, WindowState>
}

const store = globalForRateLimit.doopifyRateLimitStore ?? new Map<string, WindowState>()

if (!globalForRateLimit.doopifyRateLimitStore) {
  globalForRateLimit.doopifyRateLimitStore = store
}

export function consumeRateLimit(
  key: string,
  {
    limit,
    windowMs,
  }: {
    limit: number
    windowMs: number
  }
) {
  const now = Date.now()

  for (const [entryKey, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(entryKey)
    }
  }

  const current = store.get(key)
  if (!current || current.expiresAt <= now) {
    const next = { count: 1, expiresAt: now + windowMs }
    store.set(key, next)
    return {
      allowed: true,
      remaining: Math.max(0, limit - next.count),
      retryAfterMs: windowMs,
    }
  }

  current.count += 1
  store.set(key, current)

  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: Math.max(0, current.expiresAt - now),
  }
}
