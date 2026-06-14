import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  // Parallel data fetching
  const [websitesRes, alertsRes, scansRes] = await Promise.all([
    supabase.from('websites').select('id').eq('user_id', uid),
    supabase.from('alerts').select('id').eq('user_id', uid).eq('is_read', false),
    supabase
      .from('scans')
      .select('id, website_id, security_score, status, completed_at, started_at, websites(url, label)')
      .eq('user_id', uid)
      .order('started_at', { ascending: false })
      .limit(50),
  ])

  const websiteCount = websitesRes.data?.length ?? 0
  const activeAlertCount = alertsRes.data?.length ?? 0
  const allScans = scansRes.data ?? []

  // Most recent completed scan per website for score calculation
  const latestScanPerWebsite = new Map<string, { security_score: number | null }>()
  for (const scan of allScans) {
    if (scan.status === 'completed' && !latestScanPerWebsite.has(scan.website_id)) {
      latestScanPerWebsite.set(scan.website_id, scan)
    }
  }

  const scores = [...latestScanPerWebsite.values()]
    .map((s) => s.security_score)
    .filter((s): s is number => s !== null)

  const latestScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  // Last scan timestamp
  const completedScans = allScans.filter((s) => s.completed_at)
  const lastScanAt = completedScans.length > 0 ? completedScans[0].completed_at : null

  // Recent scans (last 5)
  const recentScans = allScans.slice(0, 5).map((s) => {
    const siteRaw = s.websites as unknown
    const site = (Array.isArray(siteRaw) ? siteRaw[0] : siteRaw) as { url: string; label: string | null } | null
    return {
      id: s.id,
      website_url: site?.url ?? '',
      website_label: site?.label ?? null,
      security_score: s.security_score,
      status: s.status,
      completed_at: s.completed_at,
      started_at: s.started_at,
    }
  })

  // Security overview: header check pass/fail aggregate from latest scan per website
  const headerChecks = [
    { key: 'content-security-policy', label: 'Content-Security-Policy' },
    { key: 'strict-transport-security', label: 'Strict-Transport-Security' },
    { key: 'x-frame-options', label: 'X-Frame-Options' },
    { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
    { key: 'referrer-policy', label: 'Referrer-Policy' },
    { key: 'permissions-policy', label: 'Permissions-Policy' },
  ]

  const latestScansWithHeaders = [...latestScanPerWebsite.values()] as Array<{
    security_score: number | null;
    headers?: Record<string, string> | null;
  }>

  // Fetch headers for latest scans
  const latestScanIds: string[] = []
  for (const scan of allScans) {
    if (scan.status === 'completed' && !latestScanIds.includes(scan.website_id)) {
      latestScanIds.push(scan.id)
    }
  }

  let scansWithHeaders: Array<{ id: string; headers: Record<string, string> | null }> = []
  if (latestScanIds.length > 0) {
    const { data } = await supabase
      .from('scans')
      .select('id, headers')
      .in('id', latestScanIds)
    scansWithHeaders = (data ?? []) as typeof scansWithHeaders
  }

  const securityOverview = headerChecks.map(({ key, label }) => {
    let pass = 0
    let fail = 0
    for (const scan of scansWithHeaders) {
      const headers = scan.headers ?? {}
      if (headers[key]) {
        pass++
      } else {
        fail++
      }
    }
    return { label, key, pass, fail, total: pass + fail }
  })

  // Suppress unused variable warning
  void latestScansWithHeaders

  return NextResponse.json({
    websiteCount,
    latestScore,
    activeAlertCount,
    lastScanAt,
    recentScans,
    securityOverview,
  })
}
