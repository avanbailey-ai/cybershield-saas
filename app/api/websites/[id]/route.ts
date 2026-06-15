import { createClient } from '@/lib/supabase/server'

import { NextRequest, NextResponse } from 'next/server'

import { requireDashboardAccess } from '@/lib/auth/requireDashboardAccess'

import { getActiveOrgId } from '@/lib/org/context'

import { requirePermission } from '@/lib/auth/rbac'

import { auditLog, extractIp } from '@/lib/audit/log'



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

