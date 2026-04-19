import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ leadId?: string }>;
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const { leadId } = await searchParams;

  if (leadId) {
    redirect(`/admin?status=leads&leadId=${encodeURIComponent(leadId)}`);
  }

  redirect('/admin?status=leads');
}
