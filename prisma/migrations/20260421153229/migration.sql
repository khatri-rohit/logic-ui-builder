/*
  Warnings:

  - You are about to drop the `ThumbnailCaptureJob` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ThumbnailCaptureJob" DROP CONSTRAINT "ThumbnailCaptureJob_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ThumbnailCaptureJob" DROP CONSTRAINT "ThumbnailCaptureJob_userId_fkey";

-- DropTable
DROP TABLE "ThumbnailCaptureJob";

-- DropEnum
DROP TYPE "ThumbnailCaptureStatus";

-- DropEnum
DROP TYPE "ThumbnailCaptureTrigger";
