-- Server-only SECURITY DEFINER functions: take EXECUTE away from anon and authenticated.
--
-- REVOKE ... FROM PUBLIC is not enough on Supabase: the public schema's default
-- privileges grant EXECUTE to anon and authenticated directly, so every function
-- below was callable over RPC with the anon key, which is public. They run as their
-- owner (SECURITY DEFINER), so RLS does not stop them:
--
--   claim_analytics_deliveries  claims analytics_delivery_outbox rows (holds them in
--                               `processing` for 15 minutes, delaying GA4, Meta CAPI
--                               and the hub) and returns their payloads: customer data.
--   reserve_gift_card           takes an active gift card (by code) for any booking id.
--   redeem_gift_card            marks a reserved gift card redeemed, with any amount.
--   release_gift_card           puts a reserved gift card back to active.
--   increment_referral_uses     bumps a referral partner's uses_count.
--
-- The app calls all of them from the server with the service role
-- (getSupabaseAdmin()): lib/analytics-delivery.ts, app/api/create-checkout and
-- app/api/webhooks/stripe. Nothing in the browser calls them. claim_email_outbox
-- (035) already got the same REVOKE.

REVOKE ALL ON FUNCTION claim_analytics_deliveries(integer, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_analytics_deliveries(integer, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_analytics_deliveries(integer, text[]) TO service_role;

REVOKE ALL ON FUNCTION reserve_gift_card(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reserve_gift_card(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_gift_card(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION redeem_gift_card(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION redeem_gift_card(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_gift_card(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION release_gift_card(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION release_gift_card(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION release_gift_card(uuid) TO service_role;

REVOKE ALL ON FUNCTION increment_referral_uses(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_referral_uses(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_referral_uses(uuid) TO service_role;

-- Fail the migration if any of them is still callable by anon/authenticated, or if
-- the server lost it.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'claim_analytics_deliveries(integer, text[])',
    'reserve_gift_card(text, uuid)',
    'redeem_gift_card(uuid, integer)',
    'release_gift_card(uuid)',
    'increment_referral_uses(uuid)'
  ]::regprocedure[]
  LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE')
       OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION '% is still executable by anon or authenticated', fn;
    END IF;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION '% is no longer executable by service_role', fn;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
