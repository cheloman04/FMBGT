-- Referral partners with dynamic discount codes.
-- One code per partner; percentage is configurable by admin.
-- FAM-FMBGT is handled in application code and does NOT live here.

CREATE TABLE IF NOT EXISTS referral_partners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name        TEXT NOT NULL,
  discount_code       TEXT NOT NULL UNIQUE,
  discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  active              BOOLEAN NOT NULL DEFAULT true,
  uses_count          INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE referral_partners IS 'Partner referral discount codes managed by admin. Each partner gets one unique code.';
COMMENT ON COLUMN referral_partners.discount_code IS 'Format: XXX-FMBGT-NNN where XXX = first 3 letters of partner name';
COMMENT ON COLUMN referral_partners.uses_count IS 'Incremented each time the code is used at checkout';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_referral_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_partners_updated_at
  BEFORE UPDATE ON referral_partners
  FOR EACH ROW EXECUTE FUNCTION update_referral_partners_updated_at();

-- Atomic increment for uses_count (called after checkout session created)
CREATE OR REPLACE FUNCTION increment_referral_uses(partner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE referral_partners SET uses_count = uses_count + 1 WHERE id = partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: only service role can read/write (admin API uses service role key)
ALTER TABLE referral_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON referral_partners
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
