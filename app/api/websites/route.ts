import { createClient } from '@/lib/supabase/server'

import { NextRequest, NextResponse } from 'next/server'

import { canAddWebsite } from '@/lib/auth/permissions'

import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess'

import { getUserWithPlan } from '@/lib/billing/planService'

import { getActiveOrgId } from '@/lib/org/context'

import { requirePermission } from '@/lib/auth/rbac'

import { auditLog, extractIp } from '@/lib/audit/log'

import { enqueueScan } from '@/lib/scanner/orchestrator'



export async function GET() {

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })



  const access = await requireDashboardAccess(user)

  if (!access.allowed) return access.response



  const orgId = await getActiveOrgId(user.id)



  let query = supabase

    .from('websites')

    .select('id, url, label, is_active, created_at, last_scanned_at, org_id')

    .order('created_at', { ascending: false })



  if (orgId) {

    query = query.or(`user_id.eq.${user.id},org_id.eq.${orgId}`)

  } else {

    query = query.eq('user_id', user.id)

  }



  const { data: websites, error } = await query



  if (error) return NextResponse.json({ error: error.message }, { status: 500 })



  const websiteIds = (websites ?? []).map((w: { id: string }) => w.id)

  const recentScoresByWebsite = new Map<string, number[]>()



  if (websiteIds.length > 0) {

    const { data: recentScans } = await supabase

      .from('scans')

      .select('website_id, security_score, completed_at')

      .in('website_id', websiteIds)

      .eq('status', 'completed')

      .not('security_score', 'is', null)

      .order('completed_at', { ascending: false })

      .limit(websiteIds.length * 3)



    for (const scan of recentScans ?? []) {

      if (scan.security_score === null) continue

      const list = recentScoresByWebsite.get(scan.website_id) ?? []

      if (list.length < 3) {

        list.push(scan.security_score)

        recentScoresByWebsite.set(scan.website_id, list)

      }

    }

  }



  const { data: queueJobs } = await supabase

    .from('scan_queue')

    .select('id, website_id, status, domain, result, error, created_at, started_at, completed_at')

    .eq('user_id', user.id)

    .order('created_at', { ascending: false })

    .limit(500)



  const latestByWebsite = new Map<string, Record<string, unknown>>()

  for (const job of queueJobs ?? []) {

    if (!latestByWebsite.has(job.website_id)) {

      latestByWebsite.set(job.website_id, job)

    }

  }



  const withQueueStatus = (websites ?? []).map((w: Record<string, unknown>) => {

    const latestQueueJob = latestByWebsite.get(w.id as string) ?? null

    const recentScores = recentScoresByWebsite.get(w.id as string) ?? []

    return { ...w, latestQueueJob, recentScores }

  })



  return NextResponse.json(withQueueStatus)

}



export async function POST(req: NextRequest) {

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })



  const access = await requireDashboardAccess(user)

  if (!access.allowed) return access.response



  const orgId = await getActiveOrgId(user.id)



  try {

    await requirePermission(user.id, orgId, 'manage_websites')

  } catch {

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  }



  const body = await req.json()

  const { url, label } = body as { url?: string; label?: string }



  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })



  try {

    new URL(url)

  } catch {

    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })

  }



  const { count: websiteCount } = await supabase

    .from('websites')

    .select('*', { count: 'exact', head: true })

    .eq('user_id', user.id)



  const userWithPlan = await getUserWithPlan(user.id)

  const check = canAddWebsite(userWithPlan, websiteCount ?? 0)



  if (!check.allowed) {

    return NextResponse.json(

      {

        error: 'WEBSITE_LIMIT_REACHED',

        message: check.message,

        upgradeUrl: '/dashboard/settings',

      },

      { status: 403 },

    )

  }



  const { data: website, error } = await supabase

    .from('websites')

    .insert({ url, label: label ?? null, user_id: user.id, org_id: orgId })

    .select()

    .single()



  if (error) return NextResponse.json({ error: error.message }, { status: 500 })



  auditLog({

    orgId,

    userId: user.id,

    action: 'website_created',

    metadata: { websiteId: website.id, url },

    ip: extractIp(req),

  })



  const enqueueResult = await enqueueScan({

    userId: user.id,

    websiteId: website.id,

    source: 'api',

    orgId,

  })



  return NextResponse.json(

    {

      ...website,

      scanQueued: enqueueResult.queued,

      jobId: enqueueResult.jobId ?? null,

      scanQueueReason: enqueueResult.queued ? null : enqueueResult.reason,

    },

    { status: 201 },

  )

}

