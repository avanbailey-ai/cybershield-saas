import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: scans, error } = await supabase
    .from('scans')
    .select(`
      id, website_id, started_at, completed_at, security_score, ssl_valid, status, error_message,
      websites(url, label),
      vulnerabilities(id, severity)
    `)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(scans ?? [])
}
