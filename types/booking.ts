export type TrailType = 'paved' | 'mtb';
export type LeadStatus = 'lead' | 'converted' | 'lost' | 'archived';
export type SignerRole = 'participant' | 'guardian';

export interface WaiverParticipant {
  name: string;
  is_minor: boolean;
  guardian_name?: string;
  guardian_relationship?: string; // 'parent' | 'legal_guardian' | 'other'
}

export interface WaiverSigner {
  signer_name: string;
  signer_email?: string;
  role: SignerRole;
  participants_covered: string[];   // names of participants this signature covers
  guardian_relationship?: string;
  signature_data_url: string;       // base64 PNG from canvas
  pdf_data_url: string;             // base64 PDF generated client-side
  agreed_at: string;                // ISO timestamp
  signature_url?: string;           // Supabase Storage URL (set after upload)
  pdf_url?: string;                 // Supabase Storage URL (set after upload)
}
export type SkillLevel = 'first_time' | 'beginner' | 'intermediate' | 'advanced';
export type BikeRental = 'none' | 'standard' | 'electric';
export type DurationHours = 2 | 3 | 4;
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';

export interface Location {
  id: string;
  name: string;
  tour_type: TrailType;
  skill_levels: SkillLevel[] | null;
  active: boolean;
}

export interface Tour {
  id: string;
  name: string;
  type: TrailType;
  base_duration_hours: number;
  base_price_no_bike: number;
  base_price_with_bike: number;
  additional_hour_price: number;
  active: boolean;
}

export interface AddonPricing {
  id: string;
  addon_key: string;
  name: string;
  description: string;
  price: number; // in cents
  limited_by_inventory: string | null;
  active: boolean;
}

export interface Addons {
  gopro?: boolean;
  pickup_dropoff?: boolean;
  electric_upgrade?: boolean;
}

export interface AdditionalParticipant {
  name: string;
  bike_rental?: BikeRental;  // MTB only; paved always 'standard'
  height_inches?: number;    // required if renting (or paved)
}

export interface Customer {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  height_inches?: number;
  zip_code?: string;
  marketing_source?: string;
}

export interface AttributionPayload {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  flow?: string;
  sequence_key?: string;
  template_key?: string;
  step_key?: string;
  enrollment_id?: string;
  trail_type?: TrailType;
  cta?: string;
  captured_at?: string;
}

export interface PriceBreakdown {
  base_price: number;         // in cents - total base for all participants
  duration_surcharge: number; // in cents - total duration surcharge for all participants
  addons_price: number;       // in cents - total addons for all participants
  subtotal: number;           // in cents - pre-tax subtotal
  tax_amount: number;         // in cents - Florida state tax
  total: number;              // in cents
  currency: 'usd';
  participant_count?: number; // for display
  is_live_test_mode?: boolean;
}

export interface InventoryStatus {
  item: string;
  quantity: number;
  available: number; // quantity - reserved on date
}

// The booking state managed in the multi-step form
export interface BookingState {
  // Step 1
  trail_type?: TrailType;

  // Step 2
  skill_level?: SkillLevel;

  // Step 3
  location_id?: string;
  location_name?: string;

  // Step 4
  bike_rental?: BikeRental;
  rider_height_inches?: number;
  participant_count?: number;                        // total riders incl. lead (default 1)
  additional_participants?: AdditionalParticipant[]; // riders 2..N

  // Step 5
  date?: string; // ISO date string YYYY-MM-DD
  time_slot?: string; // "09:00"

  // Step 6
  duration_hours?: DurationHours;

  // Step 7
  addons?: Addons;

  // Step 8
  waiver_accepted?: boolean;
  waiver_participants?: WaiverParticipant[];
  waiver_signers?: WaiverSigner[];         // excluded from localStorage (large base64)
  waiver_session_id?: string;              // returned by /api/waivers/store

  // Customer info (collected at lead capture step, pre-filled at payment)
  customer?: Customer;

  // Lead tracking
  lead_id?: string;
  lead_session_id?: string;

  // UTM attribution (captured silently from URL on first visit)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  first_touch_attribution?: AttributionPayload;
  last_touch_attribution?: AttributionPayload;
  live_test_mode?: boolean;
  live_test_token?: string;

  // Computed
  price_breakdown?: PriceBreakdown;

  // Post-booking
  booking_id?: string;
  stripe_session_id?: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  tour_id: string;
  location_id: string;
  trail_type: TrailType;
  skill_level?: SkillLevel;
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: BikeRental;
  rider_height_inches?: number;
  addons: Addons;
  base_price: number;
  addons_price: number;
  total_price: number;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  cal_booking_uid?: string;
  status: BookingStatus;
  waiver_accepted: boolean;
  waiver_accepted_at?: string;
  created_at: string;
  updated_at: string;
  attribution_snapshot?: AttributionPayload | null;
}

// API Request/Response types
export interface CreateCheckoutRequest {
  booking_state: BookingState;
}

export interface CreateCheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export interface ValidateInventoryRequest {
  date: string;
  addons: Addons;
  bike_rental: BikeRental;
}

export interface ValidateInventoryResponse {
  valid: boolean;
  errors: string[];
  inventory: Record<string, InventoryStatus>;
}

export interface AvailabilityRequest {
  date_from: string;
  date_to: string;
}

export interface AvailabilitySlot {
  date: string;
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  slots: AvailabilitySlot[];
}
