// The /admin menu as data (KIGARU_DASHBOARD_STANDARD_V1.md §5.2): order,
// labels and badges live here and only here. `nav.test.ts` pins the order and
// checks that every entry is a real page.
import { defineNav, type NavHref } from '@/components/kit';

export const ADMIN_NAV = defineNav([
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/manual-booking', label: 'Manual booking' },
  { href: '/admin/fin-log', label: 'Financial log' },
  { href: '/admin/referrals', label: 'Referrals' },
  { href: '/admin/gift-cards', label: 'Gift cards' },
]);

export type AdminHref = NavHref<typeof ADMIN_NAV>;
