-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 030: Manual (off-platform / cash) bookings + per-booking waiver link
--
-- Lets the admin create a CONFIRMED booking WITHOUT Stripe — for deals closed in
-- cash off-platform — and attach a legally-binding waiver after the fact through a
-- tokenized public signing page that works in person (kiosk) OR sent by email/SMS.
--
-- Adds to bookings:
--   booking_source     — 'online' (default, existing checkout flow) | 'manual'
--   payment_method     — how a manual booking was paid: 'cash' | 'zelle' | ...
--                        (NULL on legacy/online rows = paid through Stripe)
--   created_by_admin   — email of the admin who created the manual booking (audit)
--   admin_notes        — free-text notes about the off-platform deal
--   waiver_link_token  — unguessable token for the public /waiver/<token> page
--
-- Cash amount collected is stored in the existing bookings.deposit_paid_cents
-- (the "actually collected" field), so Fin Log / dashboards stay consistent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_source    TEXT NOT NULL DEFAULT 'online'
    CHECK (booking_source IN ('online', 'manual')),
  ADD COLUMN IF NOT EXISTS payment_method    TEXT
    CHECK (payment_method IS NULL
           OR payment_method IN ('stripe', 'cash', 'gift_card', 'zelle', 'venmo', 'other')),
  ADD COLUMN IF NOT EXISTS created_by_admin  TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes       TEXT,
  ADD COLUMN IF NOT EXISTS waiver_link_token UUID;

-- One booking per token; only enforce uniqueness where a token exists.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_waiver_link_token_idx
  ON bookings (waiver_link_token)
  WHERE waiver_link_token IS NOT NULL;

-- Fast lookup of manual bookings for the admin list.
CREATE INDEX IF NOT EXISTS bookings_manual_source_idx
  ON bookings (booking_source)
  WHERE booking_source = 'manual';

COMMENT ON COLUMN bookings.booking_source    IS 'online = public Stripe checkout | manual = admin-created cash/off-platform booking';
COMMENT ON COLUMN bookings.payment_method    IS 'Manual booking payment channel (cash/zelle/...); NULL on online rows (Stripe)';
COMMENT ON COLUMN bookings.created_by_admin  IS 'Admin email that created a manual booking';
COMMENT ON COLUMN bookings.admin_notes       IS 'Admin free-text notes about an off-platform deal';
COMMENT ON COLUMN bookings.waiver_link_token IS 'Unguessable token for the public /waiver/<token> signing page';
