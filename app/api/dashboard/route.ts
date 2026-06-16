import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess';
import { getActiveOrgId } from '@/lib/org/context';
import { getUnifiedOrgMetrics } from '@/lib/enterprise/unifiedOrgMetrics';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireDashboardAccess(user);
  if (!access.allowed) return access.response;

  const uid = user.id;
  const orgId = await getActiveOrgId(uid);

  if (orgId) {
    try {
      const metrics = await getUnifiedOrgMetrics(orgId);
      const scansQuery = supabase
        .from('scans')
        .select('id, website_id, security_score, status, completed_at, started_at, websites(url, label)')
        .eq('org_id', orgId)
        .order('started_at', { ascending: false })
        .limit(50);

      const { data: allScans } = await scansQuery;

      const latestScanPerWebsite = new Map<string, { security_score: number | null }>();
      for (const scan of allScans ?? []) {
        if (scan.status === 'completed' && !latestScanPerWebsite.has(scan.website_id)) {
          latestScanPerWebsite.set(scan.website_id, scan);
        }
      }

      const recentScans = (allScans ?? []).slice(0, 5).map((s) => {
        const siteRaw = s.websites as unknown;
        const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as {
          url: string;
          label: string | null;
        } | null;
        return {
          id: s.id,
          website_url: site?.url ?? '',
          website_label: site?.label ?? null,
          security_score: s.security_score,
          status: s.status,
          completed_at: s.completed_at,
          started_at: s.started_at,
        };
      });

      const headerChecks = [
        { key: 'content-security-policy', label: 'Content-Security-Policy' },
        { key: 'strict-transport-security', label: 'Strict-Transport-Security' },
        { key: 'x-frame-options', label: 'X-Frame-Options' },
        { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
        { key: 'referrer-policy', label: 'Referrer-Policy' },
        { key: 'permissions-policy', label: 'Permissions-Policy' },
      ];

      return NextResponse.json({
        websiteCount: metrics.totalSitesMonitored,
        latestScore: metrics.avgScore,
        activeAlertCount: metrics.openAlertsCount,
        criticalAlertsCount: metrics.criticalAlertsCount,
        rollingRiskScore: metrics.rollingRiskScore,
        postureState: metrics.postureState,
        lastScanAt: recentScans[0]?.completed_at ?? null,
        recentScans,
        securityOverview: headerChecks.map(({ key, label }) => ({
          label,
          key,
          pass: 0,
          fail: 0,
          total: latestScanPerWebsite.size,
        })),
        orgScoped: true,
        metricsSource: 'canonical',
        orgId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load org metrics';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const websitesQuery = supabase.from('websites').select('id').eq('user_id', uid);
  const scansQuery = supabase
    .from('scans')
    .select('id, website_id, security_score, status, completed_at, started_at, websites(url, label)')
    .eq('user_id', uid)
    .order('started_at', { ascending: false })
    .limit(50);

  const [websitesRes, scansRes] = await Promise.all([websitesQuery, scansQuery]);
  const websiteCount = websitesRes.data?.length ?? 0;
  const allScans = scansRes.data ?? [];

  const latestScanPerWebsite = new Map<string, { security_score: number | null }>();
  for (const scan of allScans) {
    if (scan.status === 'completed' && !latestScanPerWebsite.has(scan.website_id)) {
      latestScanPerWebsite.set(scan.website_id, scan);
    }
  }

  const scores = [...latestScanPerWebsite.values()]
    .map((s) => s.security_score)
    .filter((s): s is number => s !== null);

  const latestScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const recentScans = allScans.slice(0, 5).map((s) => {
    const siteRaw = s.websites as unknown;
    const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string; label: string | null } | null;
    return {
      id: s.id,
      website_url: site?.url ?? '',
      website_label: site?.label ?? null,
      security_score: s.security_score,
      status: s.status,
      completed_at: s.completed_at,
      started_at: s.started_at,
    };
  });

  return NextResponse.json({
    websiteCount,
    latestScore,
    activeAlertCount: 0,
    criticalAlertsCount: null,
    rollingRiskScore: null,
    postureState: null,
    lastScanAt: recentScans[0]?.completed_at ?? null,
    recentScans,
    orgScoped: false,
    metricsSource: 'user_scoped',
  });
}
