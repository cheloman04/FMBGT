-- Add multi-participant support to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS participant_info JSONB;

-- participant_info stores additional riders (2-N) as JSON array:
-- [{ "name": "Jane", "bike_rental": "standard", "height_inches": 66 }, ...]
