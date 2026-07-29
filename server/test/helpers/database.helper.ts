import { Queue } from 'bullmq';
import { PrismaService } from '../../src/prisma/prisma.service';

const ANALYTICS_QUEUE_NAME = 'analytics';

export async function resetShortCodeCounter(
  prisma: PrismaService,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    "SELECT setval('short_code_counter', 1, false)",
  );
}

export async function flushAnalyticsQueue(redisUrl: string): Promise<void> {
  const queue = new Queue(ANALYTICS_QUEUE_NAME, {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: null,
    },
  });

  try {
    await queue.drain(true);
  } finally {
    await queue.close();
  }
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Retry TRUNCATE to handle deadlocks from concurrent queue processing
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          "Analytics",
          "Identifier",
          "VerificationOtp",
          "AuditLog",
          "Session",
          "Url",
          "User"
        RESTART IDENTITY CASCADE
      `);
      await resetShortCodeCounter(prisma);
      return;
    } catch (err: unknown) {
      if (
        attempt < 3 &&
        err instanceof Error &&
        err.message.includes('deadlock')
      ) {
        // Brief pause before retry on deadlock
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      throw err;
    }
  }
}
