import { sendTestEmail } from '@/lib/admin/email-test';

export const dynamic = 'force-dynamic';

// POST — one of the eight customer emails, with sample data, to an address the
// operator types: through Kigaru, without a booking or n8n.
export const POST = sendTestEmail;
