/*
  Warnings:

  - A unique constraint covering the columns `[customAlias]` on the table `Url` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Url` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Url" ADD COLUMN     "customAlias" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "strategy" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Url_customAlias_key" ON "Url"("customAlias");
