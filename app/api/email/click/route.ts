import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEngagementEvent } from '@/lib/email/deliveryLog';
import { verifyTrackingSignature } from '@/lib/email/tracking';

export async function GET(req: NextRequest) {
  const deliveryId = req.nextUrl.searchParams.get('d');
  const url = req.nextUrl.searchParams.get('u');
  const sig = req.nextUrl.searchParams.get('s');

  if (!deliveryId || !url || !sig || !verifyTrackingSignature(deliveryId, sig, url)) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from('owner_email_deliveries')
    .select('id, prospect_id')
    .eq('id', deliveryId)
    .maybeSingle();

  await logEngagementEvent(admin, {
    deliveryId: delivery?.id ?? deliveryId,
    prospectId: (delivery?.prospect_id as string) ?? null,
    eventType: 'clicked',
    linkUrl: target.toString(),
  });

  return NextResponse.redirect(target.toString(), 302);
}
