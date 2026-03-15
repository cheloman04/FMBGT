-- Migration 001: Atomic inventory enforcement via BEFORE INSERT trigger
-- Run this in Supabase SQL Editor after the base schema.sql

CREATE OR REPLACE FUNCTION check_inventory_before_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_total    INTEGER;
  v_reserved INTEGER;
BEGIN
  -- Skip inventory check for cancelled/refunded bookings
  IF NEW.status IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  -- Electric bike (rental or upgrade)
  IF NEW.bike_rental = 'electric' OR (NEW.addons->>'electric_upgrade')::boolean IS TRUE THEN
    SELECT quantity INTO v_total
      FROM inventory WHERE item = 'electric_bike' FOR UPDATE;

    SELECT COUNT(*) INTO v_reserved
      FROM bookings
      WHERE date = NEW.date
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('pending', 'confirmed')
        AND (bike_rental = 'electric' OR (addons->>'electric_upgrade')::boolean IS TRUE);

    IF v_reserved >= v_total THEN
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

  -- Standard / electric bike slot (total bike fleet)
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

CREATE TRIGGER enforce_inventory_on_booking
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_inventory_before_booking();
