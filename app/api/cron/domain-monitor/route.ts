import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { runDomainMonitorSweep } from '@/lib/domain/runDomainMonitorSweep';

export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runDomainMonitorSweep();
  return Response.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
