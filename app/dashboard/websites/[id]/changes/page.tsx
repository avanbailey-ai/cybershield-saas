import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import WebsiteChangeTimeline from '@/components/dashboard/websites/WebsiteChangeTimeline';
import { fetchWebsiteChangeTimeline } from '@/lib/scanChanges/fetchWebsiteChanges';
import { parseChangeTimelinePeriod } from '@/lib/scanChanges/changeTimeline';

export const metadata: Metadata = {
  title: 'Change Timeline — CyberShield',
};

export default async function WebsiteChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const { period: periodRaw } = await searchParams;
  const period = parseChangeTimelinePeriod(periodRaw);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const timeline = await fetchWebsiteChangeTimeline(supabase, id, period);
  if (!timeline) notFound();

  const displayLabel =
    timeline.website.label ??
    (() => {
      try {
        return new URL(timeline.website.url).hostname;
      } catch {
        return timeline.website.url;
      }
    })();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? 'User'} title="Change Timeline" />
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <WebsiteChangeTimeline
          websiteId={timeline.website.id}
          websiteLabel={displayLabel}
          websiteUrl={timeline.website.url}
          period={timeline.period}
          changes={timeline.changes}
        />
      </main>
    </div>
  );
}
