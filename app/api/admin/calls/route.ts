import { callRoutes } from '@/lib/admin/calls';

export const dynamic = 'force-dynamic';

// GET — the call log: the calls of the cut, period, direction and search asked
// for, with the counts of each cut.
export const GET = callRoutes.list;
