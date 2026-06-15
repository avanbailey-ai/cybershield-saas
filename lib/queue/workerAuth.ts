/**
 * Worker endpoint auth — CRON_SECRET bearer token (Vercel cron / external schedulers).
 */

export function isWorkerAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  return authHeader.slice(7) === cronSecret;
}
