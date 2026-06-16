-- Gift cards — fixed-amount, single-use, admin-minted vouchers.
-- Distinct from referral_partners (which are PERCENTAGE-based partner codes).
-- A gift card carries a DOLLAR value; at checkout it reduces the booking total
-- by min(amount_cents, total). Single-use: any leftover value is forfeited.
-- Product decisions (2026-06-16): manual mint in admin, no online purchase,
-- single-use, and NO expiration (expires_at stays NULL).

CREATE TABLE IF NOT EXISTS gift_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  amount_cents          INTEGER NOT NULL CHECK (amount_cents > 0),
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'reserved', 'redeemed', 'void')),
  recipient_name        TEXT,
  recipient_email       TEXT,
  purchaser_name        TEXT,
  notes                 TEXT,
  -- Redemption tracking (single-use)
  reserved_booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  redeemed_booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  redeemed_amount_cents INTEGER,
  reserved_at           TIMESTAMPTZ,
  redeemed_at           TIMESTAMPTZ,
  -- NULL = never expires (current product decision). Kept nullable for future use.
  expires_at            TIMESTAMPTZ,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gift_cards IS 'Fixed-amount, single-use, admin-minted gift cards. Applied as a dollar reduction to a booking total.';
COMMENT ON COLUMN gift_cards.amount_cents IS 'Face value of the card in cents.';
COMMENT ON COLUMN gift_cards.status IS 'active -> reserved (held at checkout) -> redeemed (committed on payment/confirmation); void = cancelled by admin.';
COMMENT ON COLUMN gift_cards.redeemed_amount_cents IS 'Amount actually applied = min(amount_cents, booking total). Leftover is forfeited (single-use).';
COMMENT ON COLUMN gift_cards.expires_at IS 'NULL = never expires (current product decision).';

-- Link a booking to the gift card that funded (part of) it.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS gift_card_id UUID REFERENCES gift_cards(id) ON DELETE SET NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_gift_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_cards_updated_at ON gift_cards;
CREATE TRIGGER gift_cards_updated_at
  BEFORE UPDATE ON gift_cards
  FOR EACH ROW EXECUTE FUNCTION update_gift_cards_updated_at();

-- ── Atomic redemption helpers ───────────────────────────────────────────────
-- reserve_gift_card is the concurrency guard: two simultaneous checkouts cannot
-- both move the same card out of 'active'. The loser gets 0 rows (NULL) back.

CREATE OR REPLACE FUNCTION reserve_gift_card(p_code TEXT, p_booking_id UUID)
RETURNS gift_cards AS $$
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

-- Commit a held card once the booking is actually paid/confirmed.
CREATE OR REPLACE FUNCTION redeem_gift_card(p_booking_id UUID, p_amount_cents INTEGER)
RETURNS gift_cards AS $$
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

-- Release a held card back to active (checkout abandoned/expired).
CREATE OR REPLACE FUNCTION release_gift_card(p_booking_id UUID)
RETURNS gift_cards AS $$
  UPDATE gift_cards
  SET status = 'active',
      reserved_booking_id = NULL,
      reserved_at = NULL,
      updated_at = now()
  WHERE reserved_booking_id = p_booking_id
    AND status = 'reserved'
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS: service role only (admin API + checkout use the service role key)
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON gift_cards;
CREATE POLICY "Service role full access"
  ON gift_cards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Lookups
CREATE INDEX IF NOT EXISTS idx_gift_cards_code_upper ON gift_cards (upper(code));
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards (status);
CREATE INDEX IF NOT EXISTS idx_bookings_gift_card_id ON bookings (gift_card_id);
