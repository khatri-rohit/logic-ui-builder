-- Revoke EXECUTE on rls_auto_enable from anon and authenticated roles
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- Create deny-all RLS policies for anon and authenticated roles on all user tables
-- These policies are defense-in-depth since the app uses Prisma (postgres role)
-- which bypasses RLS. They protect against accidental Data API exposure.

CREATE POLICY "Deny anon/authenticated access"
  ON public."User"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."Project"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."Generation"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."AppSession"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."AuthAuditEvent"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."Subscription"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."UsagePeriod"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."Organisation"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."OrgMembership"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."OrgInvitation"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."RazorpayWebhookEvent"
  FOR ALL
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny anon/authenticated access"
  ON public."ClerkWebhookEvent"
  FOR ALL
  TO anon, authenticated
  USING (false);
