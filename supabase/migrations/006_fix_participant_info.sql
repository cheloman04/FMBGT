-- Migration 006: Fix participant_info JSONB scalar issue + defensive trigger
--
-- Root cause: the create-checkout route used JSON.stringify() to insert
-- participant_info, which stored a JSONB *string* (scalar) instead of a
-- JSONB *array*. The trigger then called jsonb_array_elements() on that
-- scalar and raised "cannot extract elements from a scalar".
--
-- This migration:
--   1. Fixes any existing rows where participant_info is a JSONB string
--      (converts the inner string back to a real JSONB value)
--   2. Rewrites the trigger function to be defensive — skips extraction
--      if participant_info is not a JSON array
--
-- Run after migrations 001–005.

-- Step 1: Fix existing bad data
--   If participant_info is a JSONB string (type = 'string'), the stored value
--   is something like '"[{\"name\":\"Jane\"}]"'. We extract the inner text
--   with `#>> '{}'` and re-cast to JSONB to get the actual array.
UPDATE bookings
SET participant_info = (participant_info #>> '{}')::jsonb
WHERE participant_info IS NOT NULL
  AND jsonb_typeof(participant_info) = 'string';

-- Step 2: Replace trigger function with a defensive version
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
  IF NEW.participant_info IS NOT NULL AND jsonb_typeof(NEW.participant_info) = 'array' THEN
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
      -- Additional riders from participant_info JSONB (only if it is an array)
      COALESCE(
        CASE WHEN b.participant_info IS NOT NULL AND jsonb_typeof(b.participant_info) = 'array' THEN
          (SELECT COUNT(*) FROM jsonb_array_elements(b.participant_info) AS p
           WHERE p->>'bike_rental' = 'electric')
        ELSE 0 END,
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
