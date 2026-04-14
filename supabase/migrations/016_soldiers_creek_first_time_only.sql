-- Keep Soldiers Creek available only for first-time MTB riders.
-- The separate first-time entry remains active.
UPDATE locations
SET active = FALSE
WHERE name = 'Soldiers Creek Park, Longwood'
  AND tour_type = 'mtb'
  AND active = TRUE;
