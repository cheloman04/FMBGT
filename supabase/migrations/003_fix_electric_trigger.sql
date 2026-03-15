-- Migration 003: Fix electric bike inventory trigger to count participant_info JSONB
-- The original trigger (001) only checked the lead rider's bike_rental column.
-- With multi-participant bookings, additional riders' electric choices are stored
-- in participant_info JSONB as [{ "bike_rental": "electric", ... }, ...].
-- This migration replaces the trigger function to count ALL electric riders per booking.
-- Run this in Supabase SQL Editor after 001 and 002.

CREATE OR REPLACE FUNCTION check_inventory_before_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_total            INTEGER;
  v_reserved         INTEGER;
  v_electric_in_new  INTEGER;
BEGIN
  -- Skip inventory check for cancelled/refunded bookings
  IF NEW.status IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  -- Count electric riders in the NEW booking (lead + additional participants)
  v_electric_in_new := 0;
  IF NEW.bike_rental = 'electric' THEN
    v_electric_in_new := v_electric_in_new + 1;
  END IF;
  IF NEW.participant_info IS NOT NULL THEN
    SELECT v_electric_in_new + COUNT(*)
      INTO v_electric_in_new
      FROM jsonb_array_elements(NEW.participant_info) AS p
      WHERE p->>'bike_rental' = 'electric';
  END IF;

  -- Electric bike check (includes all riders in every booking on that date)
  IF v_electric_in_new > 0 OR (NEW.addons->>'electric_upgrade')::boolean IS TRUE THEN
    SELECT quantity INTO v_total
      FROM inventory WHERE item = 'electric_bike' FOR UPDATE;

    -- Count all electric riders from existing bookings on same date
    SELECT COALESCE(SUM(
      -- Lead rider
      CASE WHEN b.bike_rental = 'electric' THEN 1 ELSE 0 END
      +
      -- Additional riders from participant_info JSONB
      COALESCE(
        (SELECT COUNT(*) FROM jsonb_array_elements(b.participant_info) AS p
         WHERE p->>'bike_rental' = 'electric'),
        0
      )
      +
      -- Legacy electric_upgrade addon (paved tours, pre-participant_info era)
      CASE WHEN (b.addons->>'electric_upgrade')::boolean IS TRUE THEN 1 ELSE 0 END
    ), 0)
    INTO v_reserved
    FROM bookings b
    WHERE b.date = NEW.date
      AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status IN ('pending', 'confirmed');

    IF (v_reserved + v_electric_in_new) > v_total THEN
      RAISE EXCEPTION 'inventory_exhausted:electric_bike';
    END IF;
  END IF;

  -- GoPro
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

  -- Standard / electric bike slot (total bike fleet — lead rider only for slot count)
  IF NEW.bike_rental IN ('standard', 'electric') THEN
    SELECT quantity INTO v_total
      FROM inventory WHERE item = 'standard_bike' FOR UPDATE;

    SELECT COUNT(*) INTO v_reserved
      FROM bookings
      WHERE date = NEW.date
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('pending', 'confirmed')
        AND bike_rental IN ('standard', 'electric');

    IF v_reserved >= v_total THEN
      RAISE EXCEPTION 'inventory_exhausted:standard_bike';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists from 001; replacing the function is sufficient.
-- If trigger was dropped, recreate it:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_inventory_on_booking'
  ) THEN
    CREATE TRIGGER enforce_inventory_on_booking
      BEFORE INSERT ON bookings
      FOR EACH ROW EXECUTE FUNCTION check_inventory_before_booking();
  END IF;
END $$;
