-- CreateEnum
CREATE TYPE "ThumbnailCaptureStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ThumbnailCaptureTrigger" AS ENUM ('USER_ACTION', 'GENERATION_COMPLETE');

-- CreateTable
CREATE TABLE "ThumbnailCaptureJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ThumbnailCaptureStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "ThumbnailCaptureTrigger" NOT NULL DEFAULT 'USER_ACTION',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "thumbnailUrl" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThumbnailCaptureJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThumbnailCaptureJob_idempotencyKey_key" ON "ThumbnailCaptureJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ThumbnailCaptureJob_projectId_status_idx" ON "ThumbnailCaptureJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "ThumbnailCaptureJob_projectId_createdAt_idx" ON "ThumbnailCaptureJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ThumbnailCaptureJob_status_createdAt_idx" ON "ThumbnailCaptureJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ThumbnailCaptureJob_userId_createdAt_idx" ON "ThumbnailCaptureJob"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ThumbnailCaptureJob" ADD CONSTRAINT "ThumbnailCaptureJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThumbnailCaptureJob" ADD CONSTRAINT "ThumbnailCaptureJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
