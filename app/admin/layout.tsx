import type { Metadata } from 'next';
import { KitRoot } from '@/components/kit';

// robots.txt only asks crawlers not to fetch /admin — it does not stop Google
// from indexing the URL if something links to it. This makes the block explicit.
export const metadata: Metadata = {
  title: 'Admin | Florida Mountain Bike Guides',
  robots: { index: false, follow: false },
};

// The whole /admin area — sign-in pages included — lives inside <KitRoot>,
// where app/admin/theme.css puts the admin's tokens. The guard and the shell
// are one level down, in (panel)/layout.tsx; (auth) stays outside the guard.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <KitRoot>{children}</KitRoot>;
}
