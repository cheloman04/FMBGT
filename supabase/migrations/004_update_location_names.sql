-- Migration 004: Update location names to match new trail data
-- Run this in the Supabase SQL editor

-- Paved
UPDATE locations SET name = 'Sanford Historic Riverfront Tour'
  WHERE name = 'Sanford Historic Downtown';

UPDATE locations SET name = 'Spring to Spring Trail Tour – Blue Spring State Park'
  WHERE name = 'Blue Spring State Park';

-- MTB First Time
UPDATE locations SET name = 'Lake Druid Park, Orlando'
  WHERE name = 'Orlando Mountain Bike Park';

-- Split Soldiers Creek into two separate entries (first_time + beginner)
-- First: update existing row to first_time only
UPDATE locations SET
  name = 'Soldiers Creek Park, Longwood (First Time)',
  skill_levels = ARRAY['first_time']
  WHERE name = 'Soldiers Creek Park' AND skill_levels @> ARRAY['first_time'];

-- Then insert a new beginner-only entry
INSERT INTO locations (name, tour_type, skill_levels)
SELECT 'Soldiers Creek Park, Longwood', 'mtb', ARRAY['beginner']
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE name = 'Soldiers Creek Park, Longwood'
);

-- MTB Beginner
UPDATE locations SET name = 'Markham Woods Trail, Lake Mary'
  WHERE name = 'Markham Woods Park';

UPDATE locations SET name = 'Little Big Econ Jones East – Snow Hill Rd, Chuluota'
  WHERE name = 'Snow Hill';

-- MTB Intermediate
UPDATE locations SET name = 'Mount Dora Mountain Bike Trail, Mount Dora'
  WHERE name = 'Mount Dora Mountain Bike Park';

UPDATE locations SET name = 'Chuck Lennon Mountain Bike Trailhead, DeLeon Springs'
  WHERE name = 'Shuck Lennon Mountain Bike Park';

UPDATE locations SET name = 'River Bend, Ormond Beach'
  WHERE name = 'Riverbend';

UPDATE locations SET name = 'Doris Leeper Spruce Creek MTB Trailhead, Port Orange'
  WHERE name = 'Spruce Creek';

-- MTB Advanced
UPDATE locations SET name = 'Santos Trailhead, Ocala'
  WHERE name = 'Santos Trailhead';

UPDATE locations SET name = 'Graham Swamp East Trailhead MTB, Palm Coast'
  WHERE name = 'Graham Swamp';
