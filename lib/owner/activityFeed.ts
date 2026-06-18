import { createAdminClient } from '@/lib/supabase/admin';
import { isInternalCustomerEmail } from './founderCustomerFilters';

export type ActivityFeedEventType =
  | 'discovery'
  | 'scan'
  | 'qualification'
  | 'outreach_draft'
  | 'signup'
  | 'mrr_change'
  | 'expansion'
  | 'churn_alert';

export interface ActivityFeedEvent {
  id: string;
  type: ActivityFeedEventType;
  label: string;
  detail: string | null;
  timestamp: string;
  timeLabel: string;
}

export interface ActivityFeedSummary {
  generatedAt: string;
  events: ActivityFeedEvent[];
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export async function getActivityFeed(hours = 24): Promise<ActivityFeedSummary> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const events: ActivityFeedEvent[] = [];

  const [
    discoveryRes,
    scansRes,
    qualifiedRes,
    draftsRes,
    signupsRes,
    expansionsRes,
    riskProfilesRes,
  ] = await Promise.all([
    admin
      .from('owner_discovery_runs')
      .select('id, inserted_count, qualified_count, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('scans')
      .select('id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15),
    admin
      .from('owner_prospects')
      .select('id, business_name, pipeline_state, updated_at')
      .eq('pipeline_state', 'qualified')
      .gte('updated_at', since)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(10),
    admin
      .from('owner_outreach_drafts')
      .select('id, business_name, status, created_at')
      .gte('created_at', since)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('profiles')
      .select('id, email, plan, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('profiles')
      .select('id, email, plan, updated_at')
      .gte('updated_at', since)
      .in('plan', ['growth', 'agency'])
      .order('updated_at', { ascending: false })
      .limit(5),
    admin
      .from('profiles')
      .select('id, email, churn_risk_score, updated_at')
      .gt('churn_risk_score', 70)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  for (const run of discoveryRes.data ?? []) {
    const at = run.created_at as string;
    const inserted = run.inserted_count ?? 0;
    if (inserted <= 0) continue;
    events.push({
      id: `discovery-${run.id}`,
      type: 'discovery',
      label: `${inserted} business${inserted !== 1 ? 'es' : ''} discovered`,
      detail:
        (run.qualified_count ?? 0) > 0
          ? `${run.qualified_count} qualified`
          : 'Discovery run completed',
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  for (const scan of scansRes.data ?? []) {
    const at = scan.created_at as string;
    events.push({
      id: `scan-${scan.id}`,
      type: 'scan',
      label: 'Security scan completed',
      detail: null,
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  for (const p of qualifiedRes.data ?? []) {
    const at = p.updated_at as string;
    events.push({
      id: `qual-${p.id}`,
      type: 'qualification',
      label: `Qualified: ${p.business_name}`,
      detail: 'Moved to qualified pipeline',
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  for (const d of draftsRes.data ?? []) {
    const at = d.created_at as string;
    events.push({
      id: `draft-${d.id}`,
      type: 'outreach_draft',
      label: `Outreach draft: ${d.business_name ?? 'Prospect'}`,
      detail: `Status: ${d.status}`,
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  for (const s of signupsRes.data ?? []) {
    const email = (s.email as string) ?? '';
    if (isInternalCustomerEmail(email)) continue;
    const at = s.created_at as string;
    events.push({
      id: `signup-${s.id}`,
      type: 'signup',
      label: 'New signup',
      detail: (s.email as string) ?? null,
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  for (const e of expansionsRes.data ?? []) {
    const email = (e.email as string) ?? '';
    if (isInternalCustomerEmail(email)) continue;
    const at = e.updated_at as string;
    events.push({
      id: `plan-${e.id}`,
      type: 'mrr_change',
      label: `Plan activity: ${e.plan}`,
      detail: (e.email as string) ?? null,
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  for (const r of riskProfilesRes.data ?? []) {
    const at = r.updated_at as string;
    events.push({
      id: `churn-${r.id}`,
      type: 'churn_alert',
      label: 'Churn risk elevated',
      detail: (r.email as string) ?? null,
      timestamp: at,
      timeLabel: formatTimeLabel(at),
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    generatedAt: new Date().toISOString(),
    events: events.slice(0, 25),
  };
}
