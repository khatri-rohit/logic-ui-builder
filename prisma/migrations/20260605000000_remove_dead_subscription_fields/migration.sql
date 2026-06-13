-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "cancelledAt",
DROP COLUMN IF EXISTS "trialStart",
DROP COLUMN IF EXISTS "trialEnd",
DROP COLUMN IF EXISTS "chargeSuccessAt",
DROP COLUMN IF EXISTS "chargeSuccesses";
