-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "UserStatus" ADD VALUE 'LOCKED';

-- AlterEnum
ALTER TYPE "AuditEvent" ADD VALUE 'LOGIN_SUCCESS';
ALTER TYPE "AuditEvent" ADD VALUE 'LOGIN_FAILED';
ALTER TYPE "AuditEvent" ADD VALUE 'ACCOUNT_LOCKED';
ALTER TYPE "AuditEvent" ADD VALUE 'ACCOUNT_UNLOCKED';
ALTER TYPE "AuditEvent" ADD VALUE 'SESSION_CREATED';
ALTER TYPE "AuditEvent" ADD VALUE 'SESSION_REVOKED';
ALTER TYPE "AuditEvent" ADD VALUE 'REFRESH_TOKEN_ISSUED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockUntil" TIMESTAMP(3),
ADD COLUMN     "lastLoginIp" TEXT,
ADD COLUMN     "lastUserAgent" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_refreshTokenHash_idx" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
