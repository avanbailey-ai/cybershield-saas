/**
 * Email queue worker — atomic claim + idempotent send + retry.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  claimEmailJobs,
  reclaimStaleEmailJobs,
  type EmailQueueJob,
} from '@/lib/queue/claimJobs';
import { runWithConcurrency } from '@/lib/queue/concurrency';
import {
  DEFAULT_MAX_ATTEMPTS,
  EMAIL_BATCH_SIZE,
  STALE_LOCK_MINUTES,
  WORKER_CONCURRENCY,
} from '@/lib/queue/constants';
import { sendQueuedFollowUp } from '@/lib/email/funnel';
import { processRetentionQueueItem } from '@/lib/brain/retention';

export interface EmailWorkerResult {
  reclaimed: number;
  processed: number;
  sent: number;
  failed: number;
}

function resolveEmailPayload(job: EmailQueueJob): {
  email: string;
  template: string;
  domain: string;
  score: number;
  userId: string | null;
} {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const metadata = (payload.metadata ?? job.metadata ?? {}) as { domain?: string; score?: number };
  const template = job.type ?? job.template ?? (payload.template as string) ?? '';
  const email = (payload.email as string) ?? job.email;

  return {
    email,
    template,
    domain: metadata.domain ?? 'your site',
    score: metadata.score ?? 0,
    userId: job.user_id,
  };
}

async function processEmailJob(job: EmailQueueJob): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: fresh } = await supabase
    .from('email_queue')
    .select('id, status, attempts')
    .eq('id', job.id)
    .maybeSingle();

  if (!fresh || fresh.status === 'completed') {
    console.log(`[emailWorker] job=${job.id} already completed — skipping (idempotent)`);
    return true;
  }

  const { email, template, domain, score, userId } = resolveEmailPayload(job);
  let success = false;

  if (template === 'follow_up_24h') {
    success = await sendQueuedFollowUp(email, domain, score, userId);
  } else if (template.startsWith('retention_')) {
    success = await processRetentionQueueItem(email, template, domain, userId);
  } else {
    console.warn(`[emailWorker] unknown template type=${template} job=${job.id}`);
    success = false;
  }

  if (success) {
    await supabase
      .from('email_queue')
      .update({
        status: 'completed',
        sent: true,
        locked_at: null,
      })
      .eq('id', job.id);
    return true;
  }

  const attempts = (fresh.attempts ?? 0) + 1;
  const maxAttempts = DEFAULT_MAX_ATTEMPTS;

  if (attempts < maxAttempts) {
    await supabase
      .from('email_queue')
      .update({
        status: 'pending',
        attempts,
        locked_at: null,
      })
      .eq('id', job.id);
  } else {
    await supabase
      .from('email_queue')
      .update({
        status: 'failed',
        attempts,
        locked_at: null,
      })
      .eq('id', job.id);
  }

  return false;
}

export async function runEmailWorker(
  batchSize = EMAIL_BATCH_SIZE,
  concurrency = WORKER_CONCURRENCY,
): Promise<EmailWorkerResult> {
  const reclaimed = await reclaimStaleEmailJobs(STALE_LOCK_MINUTES);
  const jobs = await claimEmailJobs(batchSize);

  if (jobs.length === 0) {
    return { reclaimed, processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  await runWithConcurrency(jobs, concurrency, async (job) => {
    const ok = await processEmailJob(job);
    if (ok) sent++;
    else failed++;
  });

  return { reclaimed, processed: jobs.length, sent, failed };
}

/** @deprecated Use runEmailWorker — kept for legacy route delegation. */
export async function processEmailQueue(): Promise<{ processed: number; sent: number }> {
  const result = await runEmailWorker();
  return { processed: result.processed, sent: result.sent };
}
