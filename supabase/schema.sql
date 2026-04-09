-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- CUSTOMERS
-- =====================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  height_inches INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);

-- =====================
-- LOCATIONS
-- =====================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  tour_type TEXT NOT NULL CHECK (tour_type IN ('paved', 'mtb')),
  skill_levels TEXT[] DEFAULT NULL, -- NULL means all levels
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO locations (name, tour_type, skill_levels) VALUES
  -- Paved
  ('Sanford Historic Riverfront Tour',                     'paved', NULL),
  ('Spring to Spring Trail Tour – Blue Spring State Park', 'paved', NULL),
  -- MTB: First Time
  ('Lake Druid Park, Orlando',                             'mtb', ARRAY['first_time']),
  ('Soldiers Creek Park, Longwood (First Time)',            'mtb', ARRAY['first_time']),
  -- MTB: Beginner
  ('Markham Woods Trail, Lake Mary',                       'mtb', ARRAY['beginner']),
  ('Little Big Econ Jones East – Snow Hill Rd, Chuluota',  'mtb', ARRAY['beginner']),
  ('Soldiers Creek Park, Longwood',                        'mtb', ARRAY['beginner']),
  -- MTB: Intermediate
  ('Mount Dora Mountain Bike Trail, Mount Dora',           'mtb', ARRAY['intermediate']),
  ('Chuck Lennon Mountain Bike Trailhead, DeLeon Springs', 'mtb', ARRAY['intermediate']),
  ('River Bend, Ormond Beach',                             'mtb', ARRAY['intermediate']),
  ('Doris Leeper Spruce Creek MTB Trailhead, Port Orange', 'mtb', ARRAY['intermediate']),
  -- MTB: Advanced
  ('Santos Trailhead, Ocala',                              'mtb', ARRAY['advanced']),
  ('Graham Swamp East Trailhead MTB, Palm Coast',          'mtb', ARRAY['advanced']);

-- =====================
-- TOURS
-- =====================
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('paved', 'mtb')),
  base_duration_hours INTEGER NOT NULL DEFAULT 2,
  base_price_no_bike INTEGER NOT NULL DEFAULT 8900, -- in cents
  base_price_with_bike INTEGER NOT NULL DEFAULT 18900, -- in cents
  additional_hour_price INTEGER NOT NULL DEFAULT 5000, -- in cents
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tours (name, type, base_duration_hours, base_price_no_bike, base_price_with_bike) VALUES
  ('Paved Trail Guided Tour',          'paved', 2,  11500, 11500),
  ('Mountain Bike Trail Guided Tour',  'mtb',   2,   8900, 18900);

-- =====================
-- INVENTORY
-- =====================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO inventory (item, quantity) VALUES
  ('electric_bike', 2),
  ('gopro', 3),
  ('standard_bike', 10);

-- =====================
-- BOOKINGS
-- =====================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Booking details
  trail_type TEXT NOT NULL CHECK (trail_type IN ('paved', 'mtb')),
  skill_level TEXT CHECK (skill_level IN ('first_time', 'beginner', 'intermediate', 'advanced')),
  date DATE NOT NULL,
  time_slot TEXT NOT NULL, -- e.g. "09:00"
  duration_hours INTEGER NOT NULL DEFAULT 2,

  -- Bike rental
  bike_rental TEXT NOT NULL DEFAULT 'none' CHECK (bike_rental IN ('none', 'standard', 'electric')),
  rider_height_inches INTEGER,

  -- Add-ons (stored as JSONB for flexibility)
  addons JSONB DEFAULT '{}',
  -- Example: {"gopro": true, "pickup_dropoff": true, "electric_upgrade": true}

  -- Pricing (all in cents)
  base_price INTEGER NOT NULL,
  addons_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL,

  -- Integrations
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  cal_booking_uid TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'refunded')),
  waiver_accepted BOOLEAN DEFAULT FALSE,
  waiver_accepted_at TIMESTAMPTZ,

  -- Marketing data
  zip_code TEXT,
  marketing_source TEXT,

  -- n8n webhook tracking
  webhook_sent BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_stripe_session ON bookings(stripe_session_id);

-- =====================
-- ADDON PRICING (reference table)
-- =====================
CREATE TABLE IF NOT EXISTS addon_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  addon_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- in cents
  limited_by_inventory TEXT, -- references inventory.item if limited
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO addon_pricing (addon_key, name, description, price, limited_by_inventory) VALUES
  ('gopro', 'GoPro Package', 'Capture your adventure with a GoPro camera', 4900, 'gopro'),
  ('pickup_dropoff', 'Pickup + Dropoff', 'Door-to-door transportation service', 7500, NULL),
  ('electric_upgrade', 'Electric Bike Upgrade', 'Upgrade to an electric bike for an easier ride', 2500, 'electric_bike');

-- =====================
-- UPDATED_AT TRIGGER
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_pricing ENABLE ROW LEVEL SECURITY;

-- Public read access for reference tables
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Public read tours" ON tours FOR SELECT USING (true);
CREATE POLICY "Public read addon_pricing" ON addon_pricing FOR SELECT USING (true);

-- Service role has full access (for API routes)
CREATE POLICY "Service role full access customers" ON customers USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access bookings" ON bookings USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access inventory" ON inventory USING (auth.role() = 'service_role');
