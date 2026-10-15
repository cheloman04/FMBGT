import { NextResponse } from 'next/server';
import { getOperator, unauthorized } from '@/lib/admin/auth';
import { loadNavBadges } from '@/lib/admin/loaders';
import { notificationsMenu, withNotificationsBadge } from '@/lib/admin/notifications';

export const dynamic = 'force-dynamic';

// GET — the menu's counters (KIGARU_DASHBOARD_STANDARD_V1.md §5.3). The shell
// asks for them on every navigation, when the window gets focus back and after
// a mutation that says the counts may have changed. The layout seeds the first.
export async function GET() {
  const operator = await getOperator();
  if (!operator) return unauthorized();

  try {
    // The bell's count comes from the hub; it never throws (no number if the hub fails).
    const [badges, bell] = await Promise.all([loadNavBadges(), notificationsMenu()]);
    return NextResponse.json({ data: withNotificationsBadge(badges, bell) });
  } catch (error) {
    console.error('[admin/badges]', error);
    return NextResponse.json({ error: 'The menu counters could not be loaded.' }, { status: 500 });
  }
}
