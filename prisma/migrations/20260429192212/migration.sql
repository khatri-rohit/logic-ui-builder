-- DropForeignKey
ALTER TABLE "OrgInvitation" DROP CONSTRAINT "OrgInvitation_invitedBy_fkey";

-- AlterTable
ALTER TABLE "OrgInvitation" ALTER COLUMN "invitedBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
