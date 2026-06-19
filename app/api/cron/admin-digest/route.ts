import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { sendAdminDigest } from '@/lib/alerts/adminDigestService';

/**
 * Admin digest cron.
 *
 * Vercel Cron invokes scheduled routes with **GET**, so GET is the primary
 * entrypoint. POST is preserved for manual/owner-triggered runs. Both share the
 * same authorization: Vercel CRON_SECRET (worker auth) OR an authenticated owner
 * session.
 */
async function handle(request: Request): Promise<Response> {
  const cronAuthorized = isWorkerAuthorized(request);

  let ownerEmail: string | null = null;

  if (cronAuthorized) {
    ownerEmail = process.env.OWNER_EMAIL ?? process.env.PLATFORM_OWNER_EMAIL ?? null;
    if (!ownerEmail) {
      console.error(
        '[cron/admin-digest] CRON_SECRET authorized but OWNER_EMAIL/PLATFORM_OWNER_EMAIL is not set — cannot address digest',
      );
      return Response.json(
        { ok: false, error: 'owner_email_not_configured' },
        { status: 500 },
      );
    }
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && isOwner(user.email)) {
      ownerEmail = user.email!;
    }
  }

  if (!ownerEmail) {
    if (!process.env.CRON_SECRET) {
      console.error(
        '[cron/admin-digest] Rejected: CRON_SECRET is not configured and no owner session present',
      );
    }
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const sent = await sendAdminDigest(ownerEmail);
    console.log('[cron/admin-digest] completed', { sent, via: cronAuthorized ? 'cron' : 'owner' });
    return Response.json({ ok: true, sent });
  } catch (error) {
    console.error('[cron/admin-digest] failed', error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'admin_digest_failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
