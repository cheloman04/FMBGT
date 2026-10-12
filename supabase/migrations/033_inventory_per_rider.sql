-- Migration 033: count rental bikes per rider, not per booking
--
-- The fleet check counted ONE bike per booking, so a 3-rider booking used 1 of
-- the 10 bikes. Sanford tours now take several groups at the same time, so the
-- fleet has to be counted per rider. Rules (mirrored by bookingBikeCounts() in
-- lib/bike-counts.ts — keep them in sync):
--   * one bike per rider on 'standard' or 'electric' (electric bikes are part
--     of the fleet AND limited by their own electric_bike quantity)
--   * additional riders without their own bike_rental (manual bookings store
--     names only) ride what the lead rider rides
--   * the legacy addons.electric_upgrade turns the lead's standard bike electric
--
-- The trigger stays BEFORE INSERT; edits are validated in the app
-- (validateBookingInventory with excludeBookingId). GoPro is unchanged.
-- Run after migrations 001–032.

CREATE OR REPLACE FUNCTION booking_bike_counts(
  p_bike_rental      TEXT,
  p_participant_info JSONB,
  p_addons           JSONB,
  OUT bikes          INTEGER,
  OUT electric       INTEGER
) AS $$
DECLARE
  v_lead TEXT := COALESCE(p_bike_rental, 'none');
BEGIN
  bikes    := CASE WHEN v_lead IN ('standard', 'electric') THEN 1 ELSE 0 END;
  electric := CASE WHEN v_lead = 'electric' THEN 1 ELSE 0 END;

  IF p_participant_info IS NOT NULL AND jsonb_typeof(p_participant_info) = 'array' THEN
    SELECT bikes + COUNT(*) FILTER (WHERE riders.rental IN ('standard', 'electric')),
           electric + COUNT(*) FILTER (WHERE riders.rental = 'electric')
      INTO bikes, electric
      FROM (
        SELECT COALESCE(p->>'bike_rental', v_lead) AS rental
          FROM jsonb_array_elements(p_participant_info) AS p
      ) AS riders;
  END IF;

  IF (p_addons->>'electric_upgrade')::boolean IS TRUE AND v_lead <> 'electric' THEN
    electric := electric + 1;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION check_inventory_before_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_new      RECORD;
  v_used     RECORD;
  v_total    INTEGER;
  v_reserved INTEGER;
BEGIN
  -- Skip inventory check for cancelled/refunded bookings
  IF NEW.status IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_new FROM booking_bike_counts(NEW.bike_rental, NEW.participant_info, NEW.addons);

  IF v_new.bikes > 0 OR v_new.electric > 0 THEN
    -- Lock the fleet rows (fixed order) so concurrent inserts queue up.
    PERFORM 1 FROM inventory
      WHERE item IN ('electric_bike', 'standard_bike')
      ORDER BY item
      FOR UPDATE;

    SELECT COALESCE(SUM(c.bikes), 0) AS bikes, COALESCE(SUM(c.electric), 0) AS electric
      INTO v_used
      FROM bookings b
      CROSS JOIN LATERAL booking_bike_counts(b.bike_rental, b.participant_info, b.addons) AS c
      WHERE b.date = NEW.date
        AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND b.status IN ('pending', 'confirmed');

    IF v_new.electric > 0 THEN
      SELECT quantity INTO v_total FROM inventory WHERE item = 'electric_bike';
      IF (v_used.electric + v_new.electric) > v_total THEN
        RAISE EXCEPTION 'inventory_exhausted:electric_bike';
      END IF;
    END IF;

    IF v_new.bikes > 0 THEN
      SELECT quantity INTO v_total FROM inventory WHERE item = 'standard_bike';
      IF (v_used.bikes + v_new.bikes) > v_total THEN
        RAISE EXCEPTION 'inventory_exhausted:standard_bike';
      END IF;
    END IF;
  END IF;

  -- GoPro (one per booking)
  IF (NEW.addons->>'gopro')::boolean IS TRUE THEN
    SELECT quantity INTO v_total
      FROM inventory WHERE item = 'gopro' FOR UPDATE;

    SELECT COUNT(*) INTO v_reserved
      FROM bookings
      WHERE date = NEW.date
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('pending', 'confirmed')
        AND (addons->>'gopro')::boolean IS TRUE;

    IF v_reserved >= v_total THEN
      RAISE EXCEPTION 'inventory_exhausted:gopro';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
