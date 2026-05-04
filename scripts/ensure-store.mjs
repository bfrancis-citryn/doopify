/**
 * Minimal store bootstrap — creates the store row if it does not exist.
 * Uses the PrismaPg adapter that matches the app runtime.
 *
 * Usage: node scripts/ensure-store.mjs
 * Env: DATABASE_URL (read from .env / .env.local via dotenv)
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

// Load .env and .env.local into process.env before importing Prisma.
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const rawVal = trimmed.slice(eq + 1).trim()
    const value = rawVal.startsWith('"') && rawVal.endsWith('"')
      ? rawVal.slice(1, -1)
      : rawVal.startsWith("'") && rawVal.endsWith("'")
        ? rawVal.slice(1, -1)
        : rawVal
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const cwd = process.cwd()
loadEnvFile(join(cwd, '.env'))
loadEnvFile(join(cwd, '.env.local'))

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  const storeName = process.env.DOOPIFY_STORE_NAME || 'Doopify Store'
  const storeEmail = process.env.DOOPIFY_STORE_EMAIL || process.env.DOOPIFY_ADMIN_EMAIL || 'owner@example.com'

  const existing = await prisma.store.findFirst()
  if (existing) {
    console.log(`Store already exists: "${existing.name}" (id: ${existing.id})`)
    return
  }

  const store = await prisma.store.create({
    data: {
      name: storeName,
      email: storeEmail,
    },
  })

  console.log(`Store created: "${store.name}" (id: ${store.id})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
