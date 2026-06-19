import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEngagementEvent } from '@/lib/email/deliveryLog';
import { verifyTrackingSignature } from '@/lib/email/tracking';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(req: NextRequest) {
  const deliveryId = req.nextUrl.searchParams.get('d');
  const sig = req.nextUrl.searchParams.get('s');

  if (deliveryId && sig && verifyTrackingSignature(deliveryId, sig)) {
    const admin = createAdminClient();
    const { data: delivery } = await admin
      .from('owner_email_deliveries')
      .select('id, prospect_id')
      .eq('id', deliveryId)
      .maybeSingle();

    await logEngagementEvent(admin, {
      deliveryId: delivery?.id ?? deliveryId,
      prospectId: (delivery?.prospect_id as string) ?? null,
      eventType: 'opened',
    });
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
