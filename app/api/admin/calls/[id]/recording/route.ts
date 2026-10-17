import { callRoutes } from '@/lib/admin/calls';

export const dynamic = 'force-dynamic';

// GET ?conversation=<id> — the call's recording: a 302 to the hub's signed URL,
// which lasts an hour.
export const GET = callRoutes.recording;
