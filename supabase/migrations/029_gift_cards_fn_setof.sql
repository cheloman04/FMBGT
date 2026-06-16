-- Fix: gift-card helper functions must RETURN SETOF so a 0-row match comes back
-- as an empty array. With the previous `RETURNS gift_cards` (scalar composite),
-- a no-match returned a single all-NULL row, which the client cannot distinguish
-- from a successful reservation — unacceptable on a money path.
-- Return type changes require DROP (CREATE OR REPLACE cannot change return type).

DROP FUNCTION IF EXISTS reserve_gift_card(TEXT, UUID);
DROP FUNCTION IF EXISTS redeem_gift_card(UUID, INTEGER);
DROP FUNCTION IF EXISTS release_gift_card(UUID);

CREATE FUNCTION reserve_gift_card(p_code TEXT, p_booking_id UUID)
RETURNS SETOF gift_cards AS $$
  UPDATE gift_cards
  SET status = 'reserved',
      reserved_booking_id = p_booking_id,
      reserved_at = now(),
      updated_at = now()
  WHERE upper(code) = upper(trim(p_code))
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE FUNCTION redeem_gift_card(p_booking_id UUID, p_amount_cents INTEGER)
RETURNS SETOF gift_cards AS $$
  UPDATE gift_cards
  SET status = 'redeemed',
      redeemed_booking_id = reserved_booking_id,
      redeemed_amount_cents = p_amount_cents,
      redeemed_at = now(),
      updated_at = now()
  WHERE reserved_booking_id = p_booking_id
    AND status = 'reserved'
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE FUNCTION release_gift_card(p_booking_id UUID)
RETURNS SETOF gift_cards AS $$
  UPDATE gift_cards
  SET status = 'active',
      reserved_booking_id = NULL,
      reserved_at = NULL,
      updated_at = now()
  WHERE reserved_booking_id = p_booking_id
    AND status = 'reserved'
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;
