/** Shared analytics event queries for Founder Command Center. */

import { createAdminClient } from '@/lib/supabase/admin';

const MS_DAY = 86400000;

export async function countAnalyticsEvents(
  eventTypes: string[],
  since: Date,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', eventTypes)
    .gte('created_at', since.toISOString());

  if (error) return 0;
  return count ?? 0;
}

export async function countAnalyticsEventsWithUser(
  eventTypes: string[],
  since: Date,
  hasUser: boolean,
): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', eventTypes)
    .gte('created_at', since.toISOString());

  query = hasUser ? query.not('user_id', 'is', null) : query.is('user_id', null);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function hasAnalyticsData(): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .limit(1);
  if (error) return false;
  return (count ?? 0) > 0;
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_DAY);
}

export async function countEventByPathPrefix(
  eventTypes: string[],
  pathPrefix: string,
  since: Date,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('analytics_events')
    .select('metadata')
    .in('event_type', eventTypes)
    .gte('created_at', since.toISOString())
    .limit(5000);

  if (error || !data) return 0;

  return data.filter((row) => {
    const meta = row.metadata as { path?: string } | null;
    const path = meta?.path ?? '';
    return path.startsWith(pathPrefix);
  }).length;
}
