-- AlterTable
ALTER TABLE "UsagePeriod" ADD COLUMN     "rolloverGenerations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsagePeriod" ADD COLUMN     "periodGenerationLimit" INTEGER;
ALTER TABLE "UsagePeriod" ADD COLUMN     "periodProjectLimit" INTEGER;
