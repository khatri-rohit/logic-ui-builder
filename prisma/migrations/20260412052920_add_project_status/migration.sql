-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'GENERATING', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING';
