// The one client for /api/admin mutations (§4.6). A 401 sends the operator to
// the login page with `?next=<this page>&expired=1`, in one place.
import { createApiClient } from '@/components/kit';

export const api = createApiClient({ loginPath: '/admin/login' });
