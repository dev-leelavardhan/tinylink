import { PrismaService } from '../../src/prisma/prisma.service';

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

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await truncateUrls(prisma);
  await resetShortCodeCounter(prisma);
}
