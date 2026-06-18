import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import WebsiteHealthCenter from '@/components/dashboard/websites/WebsiteHealthCenter';
import { fetchWebsiteHealthCenter } from '@/lib/websiteHealth/fetchWebsiteHealthCenter';

export const metadata: Metadata = {
  title: 'Health Center — CyberShield',
};

export default async function WebsiteHealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const health = await fetchWebsiteHealthCenter(supabase, id);
  if (!health) notFound();

  const displayLabel =
    health.website.label ??
    (() => {
      try {
        return new URL(health.website.url).hostname;
      } catch {
        return health.website.url;
      }
    })();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Health Center" />
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <WebsiteHealthCenter data={health} displayLabel={displayLabel} />
      </main>
    </div>
  );
}
