import { callRoutes } from '@/lib/admin/calls';

export const dynamic = 'force-dynamic';

// GET — one call: why it needs a person, its summary, transcript and recording.
// PATCH { attended } — mark it as attended (or undo it); who marks comes from
// the session, not from the browser.
export const { GET, PATCH } = callRoutes.call;
