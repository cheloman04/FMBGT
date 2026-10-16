import Image from 'next/image';
import { AppShell, ShellFooterAction, visibleNav } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { callsMenu, withCallsBadge } from '@/lib/admin/calls';
import { conversationsVisible } from '@/lib/admin/conversations';
import { emailsVisible } from '@/lib/admin/emails';
import { loadNavBadges } from '@/lib/admin/loaders';
import { notificationsMenu, withNotificationsBadge } from '@/lib/admin/notifications';
import { ADMIN_ICONS, PASSWORD_ICON, SIGN_OUT_ICON } from './_components/icons';
import { ADMIN_NAV } from './_components/nav';

const LOGO_URL =
  'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png';

// The operator area (KIGARU_DASHBOARD_STANDARD_V1.md §5): every page under
// (panel) is guarded here once and drawn inside the shell.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireOperator();
  const [badges, inbox, calls, bell, emails] = await Promise.all([
    // A counter that fails to load shouldn't take the whole admin down: no badge.
    loadNavBadges().catch((error: unknown) => {
      console.error('[admin] nav badges:', error);
      return {};
    }),
    // "Conversations" shows once a messaging channel is connected in the hub. It
    // never throws, keeps its answer for a minute, and a hub that fails or is slow
    // (2.5 s) leaves the entry visible.
    conversationsVisible(),
    // "Calls" shows once the voice line has an active account in the hub or there
    // are calls in the history, with how many need a person. It never throws and
    // has no cache; a hub that fails or is slow (2.5 s) leaves it visible without
    // a number.
    callsMenu(),
    // "Notifications" shows once the site's connection has the notifications:read
    // scope, with the unread count. It never throws; a hub that fails or is slow
    // (2.5 s) leaves it visible without a number.
    notificationsMenu(),
    // "Emails" shows once the site's connection has the email:read scope. It never
    // throws, keeps its answer for a minute, and a hub that fails or is slow leaves
    // it visible.
    emailsVisible(),
  ]);
  const features = [
    ...(inbox ? ['conversations'] : []),
    ...(calls.visible ? ['calls'] : []),
    ...(bell.visible ? ['notifications'] : []),
    ...(emails ? ['emails'] : []),
  ];

  return (
    <AppShell
      nav={visibleNav(ADMIN_NAV, features)}
      icons={ADMIN_ICONS}
      // The full name is on the logo; the sidebar fits ~110px of text.
      brand={<span className="text-[13px] font-semibold tracking-tight">Florida MTB</span>}
      mark={<Image src={LOGO_URL} alt="" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />}
      area="Admin"
      badges={withCallsBadge(withNotificationsBadge(badges, bell), calls)}
      badgesEndpoint="/api/admin/badges"
      storageKey="fmbgt-admin-sidebar"
      footer={
        <>
          <ShellFooterAction href="/admin/forgot-password" icon={PASSWORD_ICON} label="Change password" />
          <ShellFooterAction
            endpoint="/api/admin/login"
            method="DELETE"
            redirectTo="/admin/login"
            icon={SIGN_OUT_ICON}
            label="Sign out"
          />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
