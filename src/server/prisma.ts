import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    const paramsToAdd = [
      'pgbouncer=true',
      'connection_limit=3',
      'pool_timeout=20',
      'connect_timeout=20',
      'socket_timeout=30',
    ];
    for (const param of paramsToAdd) {
      const key = param.split('=')[0];
      if (!url.includes(key + '=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${param}`;
      }
    }
  }
  return url;
}

const rawDbUrl = getDatabaseUrl();

const rawPrisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
  ...(rawDbUrl ? { datasources: { db: { url: rawDbUrl } } } : {}),
});

// Gracefully handle Prisma internal engine errors without unhandled crash logs
rawPrisma.$on('error' as never, (e: any) => {
  const msg = String(e?.message || '');
  if (
    msg.includes('Connection reset by peer') ||
    msg.includes('ConnectionReset') ||
    msg.includes('code: 104') ||
    msg.includes('closed the connection') ||
    msg.includes('closed connection') ||
    msg.includes('P1001') ||
    msg.includes('P1017')
  ) {
    // Expected transient socket close from remote pooler idle timeout (pooled.db.prisma.io).
    // Reconnection is automatically handled by the query/transaction retry layers.
    console.warn('[Prisma Pool] Transient idle socket closed by pooler; will reconnect on query.');
  } else {
    console.error('[Prisma Engine Error]', msg);
  }
});

rawPrisma.$on('warn' as never, (e: any) => {
  console.warn('[Prisma Engine Warning]', e?.message || e);
});

// Periodic lightweight ping to keep connection warm
if (process.env.DATABASE_URL) {
  const pingInterval = setInterval(async () => {
    try {
      await rawPrisma.$queryRaw`SELECT 1`;
    } catch {
      // Reconnect cleanly if pool dropped connection during idle period
      try {
        await rawPrisma.$disconnect();
        await rawPrisma.$connect();
      } catch {
        // Silently ignore; next user query will reconnect with retries
      }
    }
  }, 15000);

  if (pingInterval.unref) {
    pingInterval.unref();
  }
}

function isConnectionResetError(error: any): boolean {
  const errorStr = String(error?.message || error?.cause || error || '');
  return (
    errorStr.includes('Connection reset by peer') ||
    errorStr.includes('ConnectionReset') ||
    errorStr.includes('code: 104') ||
    errorStr.includes('P1001') ||
    errorStr.includes('P1017') ||
    errorStr.includes('P2024') ||
    errorStr.includes('ECONNRESET') ||
    errorStr.includes('Closed connection') ||
    errorStr.includes('closed the connection') ||
    errorStr.includes('socket hung up')
  );
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
            if (isConnectionResetError(error) && attempts < maxAttempts) {
              console.warn(
                `[Prisma] Connection reset detected on ${String(model)}.${String(operation)} (Attempt ${attempts}/${maxAttempts}). Reconnecting...`
              );
              try {
                await rawPrisma.$disconnect();
                await rawPrisma.$connect();
              } catch (reconnErr) {
                console.error('[Prisma] Reconnect attempt failed:', reconnErr);
              }
              await new Promise((res) => setTimeout(res, 150 * attempts));
              continue;
            }
            throw error;
          }
        }
      },
    },
  },
});

// Wrap $transaction with connection retry logic as well
const originalTransaction = (extendedPrisma as any).$transaction.bind(extendedPrisma);
(extendedPrisma as any).$transaction = async function (fnOrArray: any, options?: any) {
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      return await originalTransaction(fnOrArray, options);
    } catch (error: any) {
      attempts++;
      if (isConnectionResetError(error) && attempts < maxAttempts) {
        console.warn(
          `[Prisma] Connection reset detected during $transaction (Attempt ${attempts}/${maxAttempts}). Reconnecting...`
        );
        try {
          await rawPrisma.$disconnect();
          await rawPrisma.$connect();
        } catch (reconnErr) {
          console.error('[Prisma] Reconnect attempt failed:', reconnErr);
        }
        await new Promise((res) => setTimeout(res, 150 * attempts));
        continue;
      }
      throw error;
    }
  }
};

const globalForPrisma = globalThis as unknown as {
  prisma: typeof extendedPrisma | undefined;
};

export const prisma = globalForPrisma.prisma ?? extendedPrisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;


