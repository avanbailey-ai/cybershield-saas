import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { setupResendMailDomain } from '@/lib/email/resendMailDomain';

export const dynamic = 'force-dynamic';

/** Cron/worker: provision Resend mail subdomain using server-side RESEND_API_KEY. */
export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await setupResendMailDomain();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend setup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
