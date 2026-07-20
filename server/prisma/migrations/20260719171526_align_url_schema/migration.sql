-- DropIndex
DROP INDEX "Url_originalUrl_idx";

-- AlterTable
ALTER TABLE "Url" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Url_expiresAt_idx" ON "Url"("expiresAt");

-- CreateIndex
CREATE INDEX "Url_disabled_idx" ON "Url"("disabled");
