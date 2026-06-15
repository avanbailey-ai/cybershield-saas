import type { Plan } from '@/lib/billing/plans';

export type ScanSource = 'api' | 'manual' | 'cron';

export interface EnqueueResult {
  queued: boolean;
  jobId?: string;
  jobStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  reason?:
    | 'too_recent'
    | 'already_queued'
    | 'rate_limited'
    | 'website_not_found'
    | 'scan_limit_reached'
    | 'website_limit_reached'
    | 'website_scan_limit'
    | 'queue_busy'
    | 'queue_error'
    | 'duplicate'
    | 'error';
  error?: 'USAGE_LIMIT_REACHED' | 'WEBSITE_LIMIT_REACHED' | 'RATE_LIMITED' | string;
  message?: string;
  upgradeUrl?: string;
  plan?: Plan;
  scansUsed?: number;
  scansLimit?: number;
  /** Set when queue is busy but enqueue succeeded. */
  queueWarning?: boolean;
  queueDepth?: number;
}
