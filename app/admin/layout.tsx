import type { Metadata } from 'next';

// robots.txt only asks crawlers not to fetch /admin — it does not stop Google
// from indexing the URL if something links to it. This makes the block explicit.
export const metadata: Metadata = {
  title: 'Admin | Florida Mountain Bike Guides',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
