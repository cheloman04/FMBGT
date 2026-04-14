import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SkillLevel } from '@/types/booking';

const ProgressSchema = z.object({
  session_id: z.string().uuid().optional(),
  last_step_completed: z.string().max(50).optional(),
  selected_skill_level: z.enum(['first_time', 'beginner', 'intermediate', 'advanced']).optional().nullable(),
  selected_location_name: z.string().max(200).optional().nullable(),
  selected_bike: z.string().max(20).optional().nullable(),
  selected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  selected_time_slot: z.string().max(10).optional().nullable(),
  selected_duration_hours: z.number().int().min(1).max(8).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = ProgressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Build the update object — only include defined fields
    const update: Record<string, unknown> = {
      last_activity_at: now,
      updated_at: now,
    };

    if (parsed.data.last_step_completed) {
      update.last_step_completed = parsed.data.last_step_completed;
    }
    if (parsed.data.selected_skill_level !== undefined) {
      update.selected_skill_level = parsed.data.selected_skill_level as SkillLevel | null;
    }
    if (parsed.data.selected_location_name !== undefined) {
      update.selected_location_name = parsed.data.selected_location_name;
    }
    if (parsed.data.selected_bike !== undefined) {
      update.selected_bike = parsed.data.selected_bike;
    }
    if (parsed.data.selected_date !== undefined) {
      update.selected_date = parsed.data.selected_date;
    }
    if (parsed.data.selected_time_slot !== undefined) {
      update.selected_time_slot = parsed.data.selected_time_slot;
    }
    if (parsed.data.selected_duration_hours !== undefined) {
      update.selected_duration_hours = parsed.data.selected_duration_hours;
    }

    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('leads')
      .update(update)
      .eq('id', id)
      .eq('status', 'lead'); // only update unconverted leads

    if (error) {
      console.error(`[leads] Failed to update progress for lead ${id}:`, error.message);
      // Return 200 anyway — progress updates are best-effort, never block the user
    }

    if (parsed.data.session_id) {
      // Keep the active booking session warm while the user is still in the flow.
      // Session lifecycle decides abandonment; lead capture alone does not.
      const { touchLeadBookingSession } = await import('@/lib/lead-sessions');
      await touchLeadBookingSession(id, parsed.data.session_id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Progress updates are fire-and-forget; silently swallow errors
    return NextResponse.json({ ok: true });
  }
}
