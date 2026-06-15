import { createClient } from '@/lib/supabase/server'

import { NextRequest, NextResponse } from 'next/server'

import { canAddWebsite } from '@/lib/auth/permissions'

import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess'

import { getUserWithPlan } from '@/lib/billing/planService'

import { getActiveOrgId } from '@/lib/org/context'

import { requirePermission } from '@/lib/auth/rbac'

import { auditLog, extractIp } from '@/lib/audit/log'



export async function GET() {

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })



  const access = await requireDashboardAccess(user)

  if (!access.allowed) return access.response



  const orgId = await getActiveOrgId(user.id)



  let query = supabase

    .from('websites')

    .select(`

      id, url, label, is_active, created_at, last_scanned_at, org_id,

      scans(id, security_score, status, completed_at, started_at)

    `)

    .order('created_at', { ascending: false })



  if (orgId) {

    query = query.or(`user_id.eq.${user.id},org_id.eq.${orgId}`)

  } else {

    query = query.eq('user_id', user.id)

  }



  const { data: websites, error } = await query



  if (error) return NextResponse.json({ error: error.message }, { status: 500 })



  const withLatestScan = (websites ?? []).map((w: Record<string, unknown>) => {

    const scans = (w.scans as Array<{ started_at: string; [key: string]: unknown }> | null) ?? []

    const sorted = [...scans].sort(

      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()

    )

    return { ...w, scans: undefined, latestScan: sorted[0] ?? null }

  })



  return NextResponse.json(withLatestScan)

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



  return NextResponse.json(website, { status: 201 })

}

