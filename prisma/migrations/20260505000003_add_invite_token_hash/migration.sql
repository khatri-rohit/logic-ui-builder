-- Add secure token storage columns to OrgInvitation
ALTER TABLE "OrgInvitation" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "OrgInvitation" ADD COLUMN "tokenPrefix" TEXT;

-- Create index for tokenPrefix + status lookups
CREATE INDEX "OrgInvitation_tokenPrefix_status_idx" ON "OrgInvitation"("tokenPrefix", "status");

-- Populate tokenHash and tokenPrefix for existing PENDING invites using pgcrypto bcrypt
UPDATE "OrgInvitation"
SET "tokenHash" = crypt("token", gen_salt('bf', 10)),
    "tokenPrefix" = LEFT("token", 8)
WHERE "status" = 'PENDING';

-- For non-PENDING invites, set tokenPrefix to a placeholder so the index is useful
UPDATE "OrgInvitation"
SET "tokenPrefix" = 'legacy'
WHERE "tokenPrefix" IS NULL;
