/*
  Warnings:

  - You are about to drop the column `used` on the `VerificationOtp` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "AuditEvent" AS ENUM ('OTP_GENERATED', 'OTP_RESENT', 'OTP_VERIFIED', 'OTP_EXPIRED', 'OTP_FAILED', 'OTP_RATE_LIMITED', 'OTP_MAX_ATTEMPTS', 'OTP_RESEND_COOLDOWN', 'EMAIL_VERIFICATION_SUCCESS', 'EMAIL_VERIFICATION_FAILED');

-- AlterTable
ALTER TABLE "VerificationOtp" DROP COLUMN "used",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" "VerificationType" NOT NULL DEFAULT 'EMAIL_VERIFICATION',
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" "AuditEvent" NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "VerificationOtp_userId_type_idx" ON "VerificationOtp"("userId", "type");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
