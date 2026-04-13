import { PrismaClient } from '@prisma/client'

/**
 * PrismaClient singleton for Next.js development.
 *
 * In production, a new PrismaClient is created once (module is loaded once).
 * In development (with HMR), we store the client on `globalThis` to prevent
 * creating a new client on every hot-reload, which would exhaust DB connections.
 *
 * @see https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
