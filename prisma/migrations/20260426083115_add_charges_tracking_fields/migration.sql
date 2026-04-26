-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "chargeFailureAt" TIMESTAMP(3),
ADD COLUMN     "chargeFailureReason" TEXT,
ADD COLUMN     "chargeFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chargeHaltCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chargeRetries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chargeSuccessAt" TIMESTAMP(3),
ADD COLUMN     "chargeSuccesses" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Subscription_razorpayPlanId_idx" ON "Subscription"("razorpayPlanId");
