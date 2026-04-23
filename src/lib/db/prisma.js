import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function normalizePgConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');

    if (sslmode && ['prefer', 'require', 'verify-ca'].includes(sslmode)) {
      url.searchParams.set('sslmode', 'verify-full');
      return url.toString();
    }
  } catch {
    // Keep the original value when parsing fails.
  }

  return connectionString;
}

function getPrismaAdapter() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  return globalForPrisma.prismaAdapter || new PrismaPg({ connectionString: normalizePgConnectionString(connectionString) });
}

const adapter = getPrismaAdapter();

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAdapter = adapter;
}
