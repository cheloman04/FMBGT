// One icon per menu entry. `Record<AdminHref, …>`: a missing one doesn't compile.
// The shell sizes them; no size classes here.
import type { ReactNode } from 'react';
import { CalendarPlus, Gift, Handshake, KeyRound, LayoutDashboard, LogOut, ReceiptText } from 'lucide-react';
import type { AdminHref } from './nav';

export const ADMIN_ICONS: Record<AdminHref, ReactNode> = {
  '/admin': <LayoutDashboard aria-hidden="true" />,
  '/admin/manual-booking': <CalendarPlus aria-hidden="true" />,
  '/admin/fin-log': <ReceiptText aria-hidden="true" />,
  '/admin/referrals': <Handshake aria-hidden="true" />,
  '/admin/gift-cards': <Gift aria-hidden="true" />,
};

export const PASSWORD_ICON = <KeyRound aria-hidden="true" />;
export const SIGN_OUT_ICON = <LogOut aria-hidden="true" />;
