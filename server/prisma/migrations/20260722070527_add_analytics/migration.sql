-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "urlId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "country" TEXT,
    "city" TEXT,
    "ipHash" TEXT NOT NULL,
    "referrer" TEXT,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analytics_urlId_timestamp_idx" ON "Analytics"("urlId", "timestamp");

-- CreateIndex
CREATE INDEX "Analytics_urlId_browser_idx" ON "Analytics"("urlId", "browser");

-- CreateIndex
CREATE INDEX "Analytics_urlId_country_idx" ON "Analytics"("urlId", "country");

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
