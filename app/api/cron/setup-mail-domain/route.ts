import { NextResponse } from 'next/server';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { setupResendMailDomain } from '@/lib/email/resendMailDomain';

export const dynamic = 'force-dynamic';

/** Cron/worker: provision Resend mail subdomain using server-side RESEND_API_KEY. */
function isSetupAuthorized(request: Request): boolean {
  if (isWorkerAuthorized(request)) return true;

  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (webhookSecret && token === webhookSecret) return true;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey && token === apiKey) return true;

  return false;
}

export async function POST(request: Request) {
  if (!isSetupAuthorized(request)) {
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
