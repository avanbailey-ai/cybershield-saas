/**
 * Worker endpoint auth — CRON_SECRET (Vercel Cron only).
 *
 * Accepts:
 *   Authorization: Bearer <CRON_SECRET>  (sent automatically by Vercel Cron)
 *   x-cron-secret: <CRON_SECRET>         (manual/local invocation)
 */

export function isWorkerAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return true;
  }

  const headerSecret = req.headers.get('x-cron-secret');
  return headerSecret === cronSecret;
}
