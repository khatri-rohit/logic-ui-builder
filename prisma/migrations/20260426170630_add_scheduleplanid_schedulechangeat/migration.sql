-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "scheduledChangeAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPlanId" "PlanId";
