-- AlterTable
ALTER TABLE "Url" ADD COLUMN "strategy" TEXT NOT NULL DEFAULT 'random';

-- CreateIndex
CREATE INDEX "Url_originalUrl_idx" ON "Url"("originalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Url_originalUrl_strategy_key" ON "Url"("originalUrl", "strategy");
