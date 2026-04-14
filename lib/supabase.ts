import { createClient } from '@supabase/supabase-js';
import type { TrailType, SkillLevel, BikeRental, BookingStatus, Addons, LeadStatus } from '@/types/booking';

// Database types for Supabase — explicit inline types to avoid TS inference issues
export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          height_inches: number | null;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          email: string;
          phone?: string | null;
          height_inches?: number | null;
          stripe_customer_id?: string | null;
        };
        Update: {
          name?: string;
          email?: string;
          phone?: string | null;
          height_inches?: number | null;
          stripe_customer_id?: string | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          customer_id: string | null;
          tour_id: string | null;
          location_id: string | null;
          trail_type: TrailType;
          skill_level: SkillLevel | null;
          date: string;
          time_slot: string;
          duration_hours: number;
          bike_rental: BikeRental;
          rider_height_inches: number | null;
          addons: Addons;
          participant_count: number;
          participant_info: unknown | null;
          base_price: number;
          addons_price: number;
          total_price: number;
          waiver_session_id: string | null;
          booking_session_id: string | null;
          stripe_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          deposit_payment_intent_id: string | null;
          remaining_balance_payment_intent_id: string | null;
          deposit_amount: number | null;
          remaining_balance_amount: number | null;
          remaining_balance_due_at: string | null;
          deposit_payment_status: string | null;
          remaining_balance_status: string | null;
          stripe_payment_method_id: string | null;
          cal_booking_uid: string | null;
          status: BookingStatus;
          waiver_accepted: boolean;
          waiver_accepted_at: string | null;
          zip_code: string | null;
          marketing_source: string | null;
          webhook_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id?: string | null;
          tour_id?: string | null;
          location_id?: string | null;
          trail_type: TrailType;
          skill_level?: SkillLevel | null;
          date: string;
          time_slot: string;
          duration_hours: number;
          bike_rental: BikeRental;
          rider_height_inches?: number | null;
          addons?: Addons;
          participant_count?: number;
          participant_info?: unknown | null;
          base_price: number;
          addons_price: number;
          total_price: number;
          waiver_session_id?: string | null;
          booking_session_id?: string | null;
          stripe_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          deposit_payment_intent_id?: string | null;
          remaining_balance_payment_intent_id?: string | null;
          deposit_amount?: number | null;
          remaining_balance_amount?: number | null;
          remaining_balance_due_at?: string | null;
          deposit_payment_status?: string | null;
          remaining_balance_status?: string | null;
          stripe_payment_method_id?: string | null;
          cal_booking_uid?: string | null;
          status?: BookingStatus;
          waiver_accepted?: boolean;
          waiver_accepted_at?: string | null;
          zip_code?: string | null;
          marketing_source?: string | null;
          webhook_sent?: boolean;
        };
        Update: {
          status?: BookingStatus;
          waiver_session_id?: string | null;
          booking_session_id?: string | null;
          stripe_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          deposit_payment_intent_id?: string | null;
          remaining_balance_payment_intent_id?: string | null;
          deposit_amount?: number | null;
          remaining_balance_amount?: number | null;
          remaining_balance_due_at?: string | null;
          deposit_payment_status?: string | null;
          remaining_balance_status?: string | null;
          stripe_payment_method_id?: string | null;
          cal_booking_uid?: string | null;
          waiver_accepted?: boolean;
          waiver_accepted_at?: string | null;
          zip_code?: string | null;
          marketing_source?: string | null;
          webhook_sent?: boolean;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          zip_code: string | null;
          heard_about_us: string | null;
          selected_trail_type: TrailType | null;
          selected_skill_level: SkillLevel | null;
          selected_location_name: string | null;
          selected_bike: string | null;
          selected_date: string | null;
          selected_time_slot: string | null;
          selected_duration_hours: number | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          last_step_completed: string | null;
          last_activity_at: string;
          source: string;
          status: LeadStatus;
          booking_id: string | null;
          converted_at: string | null;
          lost_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          full_name: string;
          email: string;
          phone?: string | null;
          zip_code?: string | null;
          heard_about_us?: string | null;
          selected_trail_type?: TrailType | null;
          selected_skill_level?: SkillLevel | null;
          selected_location_name?: string | null;
          selected_bike?: string | null;
          selected_date?: string | null;
          selected_time_slot?: string | null;
          selected_duration_hours?: number | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          last_step_completed?: string | null;
          last_activity_at?: string;
          source?: string;
          status?: LeadStatus;
          booking_id?: string | null;
          converted_at?: string | null;
          lost_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
          phone?: string | null;
          zip_code?: string | null;
          heard_about_us?: string | null;
          selected_trail_type?: TrailType | null;
          selected_skill_level?: SkillLevel | null;
          selected_location_name?: string | null;
          selected_bike?: string | null;
          selected_date?: string | null;
          selected_time_slot?: string | null;
          selected_duration_hours?: number | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          last_step_completed?: string | null;
          last_activity_at?: string;
          source?: string;
          status?: LeadStatus;
          booking_id?: string | null;
          converted_at?: string | null;
          lost_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_booking_sessions: {
        Row: {
          id: string;
          lead_id: string;
          status: string;
          started_at: string;
          last_activity_at: string;
          exited_at: string | null;
          checkout_started_at: string | null;
          converted_at: string | null;
          abandonment_confirmed_at: string | null;
          abandoned_alert_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lead_id: string;
          status?: string;
          started_at?: string;
          last_activity_at?: string;
          exited_at?: string | null;
          checkout_started_at?: string | null;
          converted_at?: string | null;
          abandonment_confirmed_at?: string | null;
          abandoned_alert_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          last_activity_at?: string;
          exited_at?: string | null;
          checkout_started_at?: string | null;
          converted_at?: string | null;
          abandonment_confirmed_at?: string | null;
          abandoned_alert_sent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_followup_enrollments: {
        Row: {
          id: string;
          lead_id: string;
          trail_type: TrailType;
          sequence_key: string;
          status: string;
          enrolled_at: string;
          next_step_due_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          lost_at: string | null;
          stop_reason: string | null;
          webhook_triggered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lead_id: string;
          trail_type: TrailType;
          sequence_key?: string;
          status?: string;
          enrolled_at?: string;
          next_step_due_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          lost_at?: string | null;
          stop_reason?: string | null;
          webhook_triggered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          trail_type?: TrailType;
          sequence_key?: string;
          status?: string;
          enrolled_at?: string;
          next_step_due_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          lost_at?: string | null;
          stop_reason?: string | null;
          webhook_triggered_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_followup_steps: {
        Row: {
          id: string;
          enrollment_id: string;
          step_number: number;
          step_key: string;
          scheduled_for: string;
          sent_at: string | null;
          status: string;
          channel: string;
          template_key: string;
          skipped_at: string | null;
          cancelled_at: string | null;
          skip_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          enrollment_id: string;
          step_number: number;
          step_key: string;
          scheduled_for: string;
          sent_at?: string | null;
          status?: string;
          channel?: string;
          template_key: string;
          skipped_at?: string | null;
          cancelled_at?: string | null;
          skip_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          step_number?: number;
          step_key?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: string;
          channel?: string;
          template_key?: string;
          skipped_at?: string | null;
          cancelled_at?: string | null;
          skip_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          name: string;
          tour_type: TrailType;
          skill_levels: SkillLevel[] | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          tour_type: TrailType;
          skill_levels?: SkillLevel[] | null;
          active?: boolean;
        };
        Update: {
          name?: string;
          tour_type?: TrailType;
          skill_levels?: SkillLevel[] | null;
          active?: boolean;
        };
        Relationships: [];
      };
      tours: {
        Row: {
          id: string;
          name: string;
          type: TrailType;
          base_duration_hours: number;
          base_price_no_bike: number;
          base_price_with_bike: number;
          additional_hour_price: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          type: TrailType;
          base_duration_hours?: number;
          base_price_no_bike?: number;
          base_price_with_bike?: number;
          additional_hour_price?: number;
          active?: boolean;
        };
        Update: {
          active?: boolean;
        };
        Relationships: [];
      };
      inventory: {
        Row: { id: string; item: string; quantity: number; updated_at: string };
        Insert: { item: string; quantity: number };
        Update: { quantity?: number };
        Relationships: [];
      };
      addon_pricing: {
        Row: {
          id: string;
          addon_key: string;
          name: string;
          description: string | null;
          price: number;
          limited_by_inventory: string | null;
          active: boolean;
        };
        Insert: {
          addon_key: string;
          name: string;
          description?: string | null;
          price: number;
          limited_by_inventory?: string | null;
          active?: boolean;
        };
        Update: {
          price?: number;
          active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && isValidUrl(url)) return url;
  return 'https://placeholder.supabase.co';
}

// Lazy singleton for client-side Supabase client
let _supabase: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient(): ReturnType<typeof createClient<Database>> {
  if (!_supabase) {
    _supabase = createClient<Database>(
      getSupabaseUrl(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
    );
  }
  return _supabase;
}

// Export a getter function instead of a module-level instance to avoid
// initialization errors at build time with placeholder env vars
export const getSupabase = getSupabaseClient;

// Server-side Supabase client (uses service role key - never expose to client)
export const getSupabaseAdmin = () => {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-role-key';
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Helper: Get all active locations
export async function getLocations(tourType?: string): Promise<Database['public']['Tables']['locations']['Row'][]> {
  const client = getSupabaseClient();
  let query = client.from('locations').select('*').eq('active', true);
  if (tourType) {
    query = query.eq('tour_type', tourType as TrailType);
  }
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data ?? []) as Database['public']['Tables']['locations']['Row'][];
}

// Helper: Get tours by type
export async function getTours(type?: string): Promise<Database['public']['Tables']['tours']['Row'][]> {
  const client = getSupabaseClient();
  let query = client.from('tours').select('*').eq('active', true);
  if (type) {
    query = query.eq('type', type as TrailType);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Database['public']['Tables']['tours']['Row'][];
}

// Helper: Get addon pricing
export async function getAddonPricing(): Promise<Database['public']['Tables']['addon_pricing']['Row'][]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('addon_pricing')
    .select('*')
    .eq('active', true);
  if (error) throw error;
  return (data ?? []) as Database['public']['Tables']['addon_pricing']['Row'][];
}
