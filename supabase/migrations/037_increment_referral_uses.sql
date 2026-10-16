-- increment_referral_uses, which 025 defines but never reached production.
--
-- Production (nhgpxegozgljqebxqtnq) got the rest of 025 (referral_partners, its RLS
-- policy and the updated_at trigger) but not this function. app/api/create-checkout
-- calls it after creating a Stripe session with a partner code, without awaiting the
-- result, so the missing function failed silently and uses_count could never move.
-- Checked on 2026-10-16: no booking carries a discount code yet, so no use was lost
-- and there is nothing to backfill.
--
-- Same body and parameter name as 025 (PostgREST matches `partner_id` by name), plus
-- a fixed search_path, and closed to anon/authenticated: REVOKE ... FROM PUBLIC is not
-- enough on Supabase, because the public schema's default privileges grant EXECUTE to
-- them directly (see 036).
--
-- Applied to production (nhgpxegozgljqebxqtnq) on 2026-10-16, after a rehearsal with
-- rollback, and verified with has_function_privilege and real calls per role:
-- service_role runs it, anon and authenticated get permission denied.

CREATE OR REPLACE FUNCTION increment_referral_uses(partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_partners SET uses_count = uses_count + 1 WHERE id = partner_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_referral_uses(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_referral_uses(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_referral_uses(uuid) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'increment_referral_uses(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'increment_referral_uses(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'increment_referral_uses is executable by anon or authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'increment_referral_uses(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'increment_referral_uses is not executable by service_role';
  END IF;
END;
$$;

-- PostgREST only sees the new function after a schema reload.
NOTIFY pgrst, 'reload schema';
