-- Migration: Add marketing source and ZIP code fields to bookings
-- Run in Supabase SQL editor after migration 004

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS marketing_source TEXT;
