import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { env } from '@/lib/env'

function normalizePgConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)
    const sslmode = url.searchParams.get('sslmode')

    // pg 8 currently treats require/prefer/verify-ca like verify-full and warns.
    // Normalize the URL explicitly so builds and SSR don't emit noisy warnings.
    if (sslmode && ['prefer', 'require', 'verify-ca'].includes(sslmode)) {
      url.searchParams.set('sslmode', 'verify-full')
      return url.toString()
    }
  } catch {
    // Fall through to the original string if the URL cannot be parsed.
  }

  return connectionString
}

function getPrismaAdapter() {
  return (
    globalForPrisma.prismaAdapter ??
    new PrismaPg({
      connectionString: normalizePgConnectionString(env.DATABASE_URL),
    })
  )
}

function buildPrismaClient() {
  const adapter = getPrismaAdapter()

  const client = new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

  return { adapter, client }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaAdapter: PrismaPg | undefined
}

const { adapter, client } = globalForPrisma.prisma
  ? { adapter: getPrismaAdapter(), client: globalForPrisma.prisma }
  : buildPrismaClient()

export const prisma = client

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaAdapter = adapter
}
