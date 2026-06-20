import { createClient } from '@/lib/supabase/server'

import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess'

import { getActiveOrgId } from '@/lib/org/context'

import { requirePermission } from '@/lib/auth/rbac'

import { auditLog, extractIp } from '@/lib/audit/log'

import { canUseAgencyClientFeatures } from '@/lib/agency/planGate'

import { userFromSubscriptionAccess } from '@/lib/auth/enterpriseGateUser'

import { getSubscriptionAccess } from '@/lib/billing/getSubscriptionAccess'



export async function DELETE(

  req: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

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



  const { id } = await params



  const { data: website } = await supabase

    .from('websites')

    .select('id, user_id, org_id')

    .eq('id', id)

    .maybeSingle()



  if (!website) {

    return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  }



  const canDelete =

    website.user_id === user.id ||

    (orgId && website.org_id === orgId)



  if (!canDelete) {

    return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  }



  const { error } = await supabase.from('websites').delete().eq('id', id)



  if (error) return NextResponse.json({ error: error.message }, { status: 500 })



  auditLog({

    orgId: website.org_id ?? orgId,

    userId: user.id,

    action: 'website_deleted',

    metadata: { websiteId: id },

    ip: extractIp(req),

  })



  return NextResponse.json({ success: true })

}



const CLIENT_CONTEXT_FIELDS = [
  'client_name',
  'client_contact_name',
  'client_contact_email',
  'client_company',
  'client_notes',
  'client_report_frequency',
  'client_status',
  'agency_internal_notes',
  'client_group',
  'label',
] as const;



export async function PATCH(

  req: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })



  const access = await requireDashboardAccess(user)

  if (!access.allowed) return access.response



  const subscriptionAccess = await getSubscriptionAccess(user.id, user.email)

  const gateUser = userFromSubscriptionAccess(subscriptionAccess, user.email)

  if (!canUseAgencyClientFeatures(gateUser)) {

    return NextResponse.json({ error: 'Agency plan required' }, { status: 403 })

  }



  const orgId = await getActiveOrgId(user.id)



  try {

    await requirePermission(user.id, orgId, 'manage_websites')

  } catch {

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  }



  const { id } = await params

  const body = await req.json() as Record<string, unknown>



  const { data: website } = await supabase

    .from('websites')

    .select('id, user_id, org_id')

    .eq('id', id)

    .maybeSingle()



  if (!website) {

    return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  }



  const canUpdate =

    website.user_id === user.id ||

    (orgId && website.org_id === orgId)



  if (!canUpdate) {

    return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  }



  const updates: Record<string, string | null> = {}

  for (const field of CLIENT_CONTEXT_FIELDS) {

    if (field in body) {

      const value = body[field]

      updates[field] = typeof value === 'string' ? value : value === null ? null : String(value)

    }

  }



  if (Object.keys(updates).length === 0) {

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

  }



  const admin = createAdminClient()

  const { data: updated, error } = await admin

    .from('websites')

    .update(updates)

    .eq('id', id)

    .select('id, client_name, client_contact_name, client_contact_email, client_company, client_notes, client_report_frequency, client_status, agency_internal_notes, client_group, label')

    .single()



  if (error) return NextResponse.json({ error: error.message }, { status: 500 })



  auditLog({

    orgId: website.org_id ?? orgId,

    userId: user.id,

    action: 'website_client_context_updated',

    metadata: { websiteId: id, fields: Object.keys(updates) },

    ip: extractIp(req),

  })



  return NextResponse.json(updated)

}

