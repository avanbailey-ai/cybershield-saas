import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function getUser(
  supabase: SupabaseClient,
): Promise<{ user: User | null; error?: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error: error.message };
  }

  return { user };
}

export interface WebsiteRow {
  id: string;
  url: string;
  label: string | null;
  is_active: boolean;
  priority_monitoring: boolean;
  created_at: string;
  last_scanned_at: string | null;
  org_id: string | null;
}

export interface EnrichedWebsite extends WebsiteRow {
  latestQueueJob: Record<string, unknown> | null;
  recentScores: number[];
}

export async function getWebsitesForUser(
  supabase: SupabaseClient,
  userId: string,
  orgId: string | null,
): Promise<{ websites: EnrichedWebsite[]; error?: string }> {
  let query = supabase
    .from('websites')
    .select('id, url, label, is_active, priority_monitoring, created_at, last_scanned_at, org_id')
    .order('created_at', { ascending: false });

  if (orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${orgId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data: websites, error } = await query;

  if (error) {
    return { websites: [], error: error.message };
  }

  const websiteIds = (websites ?? []).map((w) => w.id);
  const recentScoresByWebsite = new Map<string, number[]>();

  if (websiteIds.length > 0) {
    const { data: recentScans } = await supabase
      .from('scans')
      .select('website_id, security_score, completed_at')
      .in('website_id', websiteIds)
      .eq('status', 'completed')
      .not('security_score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(websiteIds.length * 3);

    for (const scan of recentScans ?? []) {
      if (scan.security_score === null) continue;
      const list = recentScoresByWebsite.get(scan.website_id) ?? [];
      if (list.length < 3) {
        list.push(scan.security_score);
        recentScoresByWebsite.set(scan.website_id, list);
      }
    }
  }

  const { data: queueJobs } = await supabase
    .from('scan_queue')
    .select('id, website_id, status, domain, result, error, created_at, started_at, completed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

  const latestByWebsite = new Map<string, Record<string, unknown>>();
  for (const job of queueJobs ?? []) {
    if (!latestByWebsite.has(job.website_id)) {
      latestByWebsite.set(job.website_id, job);
    }
  }

  const enriched: EnrichedWebsite[] = (websites ?? []).map((w) => ({
    ...w,
    latestQueueJob: latestByWebsite.get(w.id) ?? null,
    recentScores: recentScoresByWebsite.get(w.id) ?? [],
  }));

  return { websites: enriched };
}

export async function getWebsiteCountForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from('websites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

export async function insertWebsite(
  supabase: SupabaseClient,
  data: { url: string; label: string | null; userId: string; orgId: string | null },
): Promise<{ website: WebsiteRow | null; error?: string }> {
  const { data: website, error } = await supabase
    .from('websites')
    .insert({
      url: data.url,
      label: data.label,
      user_id: data.userId,
      org_id: data.orgId,
    })
    .select()
    .single();

  if (error) {
    return { website: null, error: error.message };
  }

  return { website };
}

export async function insertScan(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
): Promise<{ scan: { id: string } | null; error?: string }> {
  const { data: scan, error } = await supabase.from('scans').insert(data).select('id').single();

  if (error) {
    return { scan: null, error: error.message };
  }

  return { scan };
}

export async function updateScan(
  supabase: SupabaseClient,
  id: string,
  data: Record<string, unknown>,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('scans').update(data).eq('id', id);

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function insertAlert(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
): Promise<{ alert: { id: string } | null; error?: string }> {
  const { data: alert, error } = await supabase.from('alerts').insert(data).select('id').single();

  if (error) {
    return { alert: null, error: error.message };
  }

  return { alert };
}

export async function getProfilePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ plan: string | null; error?: string }> {
  const { data, error } = await supabase.from('profiles').select('plan').eq('id', userId).single();

  if (error || !data) {
    return { plan: 'free', error: error?.message };
  }

  return { plan: data.plan ?? 'free' };
}

export async function getActiveWebsitesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ websites: { id: string }[]; error?: string }> {
  const { data: websites, error } = await supabase
    .from('websites')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    return { websites: [], error: error.message };
  }

  return { websites: websites ?? [] };
}
