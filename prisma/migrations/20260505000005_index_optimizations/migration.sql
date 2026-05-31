-- Drop redundant index on OrgInvitation.token (unique constraint already covers it)
DROP INDEX IF EXISTS "OrgInvitation_token_idx";

-- Add missing foreign-key indexes for frequent lookup paths
CREATE INDEX IF NOT EXISTS "OrgInvitation_invitedBy_idx" ON "OrgInvitation"("invitedBy");
CREATE INDEX IF NOT EXISTS "OrgMembership_invitedBy_idx" ON "OrgMembership"("invitedBy");
