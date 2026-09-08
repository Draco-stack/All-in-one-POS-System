import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    const paramsToAdd = ['connection_limit=5', 'pool_timeout=10', 'connect_timeout=10'];
    for (const param of paramsToAdd) {
      const key = param.split('=')[0];
      if (!url.includes(key)) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${param}`;
      }
    }
  }
  return url;
}

const rawDbUrl = getDatabaseUrl();

const rawPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  ...(rawDbUrl ? { datasources: { db: { url: rawDbUrl } } } : {}),
});

// Periodic ping to keep TCP socket active and prevent idle socket connection resets (code 104)
if (process.env.DATABASE_URL) {
  const pingInterval = setInterval(async () => {
    try {
      await rawPrisma.$queryRaw`SELECT 1`;
    } catch {
      // Silently catch error; auto-reconnect handles reconnection on next active query
    }
  }, 25000);

  if (pingInterval.unref) {
    pingInterval.unref();
  }
}

// Extend Prisma client with query retry logic for transient PostgreSQL connection resets
const extendedPrisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
          try {
            return await query(args);
          } catch (error: any) {
            attempts++;
            const errorStr = String(error?.message || error?.cause || error || '');
            const isConnectionReset =
              errorStr.includes('Connection reset by peer') ||
              errorStr.includes('ConnectionReset') ||
              errorStr.includes('code: 104') ||
              errorStr.includes('P1001') ||
              errorStr.includes('P1017') ||
              errorStr.includes('P2024') ||
              errorStr.includes('ECONNRESET') ||
              errorStr.includes('Closed connection') ||
              errorStr.includes('socket hung up');

            if (isConnectionReset && attempts < maxAttempts) {
              console.warn(
                `[Prisma] Connection reset detected on ${String(model)}.${String(operation)} (Attempt ${attempts}/${maxAttempts}). Reconnecting...`
              );
              try {
                await rawPrisma.$disconnect();
                await rawPrisma.$connect();
              } catch (reconnErr) {
                console.error('[Prisma] Reconnect attempt failed:', reconnErr);
              }
              await new Promise((res) => setTimeout(res, 200 * attempts));
              continue;
            }
            throw error;
          }
        }
      },
    },
  },
});

const globalForPrisma = globalThis as unknown as {
  prisma: typeof extendedPrisma | undefined;
};

export const prisma = globalForPrisma.prisma ?? extendedPrisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;


