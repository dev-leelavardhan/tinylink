import { Queue } from 'bullmq';
import { PrismaService } from '../../src/prisma/prisma.service';

const ANALYTICS_QUEUE_NAME = 'analytics';

export async function truncateUrls(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Url" RESTART IDENTITY CASCADE',
  );
}

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
  await truncateUrls(prisma);
  await resetShortCodeCounter(prisma);
}
