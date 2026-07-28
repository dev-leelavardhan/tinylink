/*
  Warnings:

  - A unique constraint covering the columns `[refreshTokenId]` on the table `Session` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "refreshTokenId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenId_key" ON "Session"("refreshTokenId");
