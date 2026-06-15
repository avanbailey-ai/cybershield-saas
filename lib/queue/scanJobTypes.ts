/** Scan queue job shape — shared by claim worker and legacy queue helpers. */

export interface QueueJob {
  id: string;
  user_id: string;
  website_id: string;
  domain?: string | null;
  org_id?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source: string | null;
  attempts?: number;
  max_attempts?: number;
  priority?: number;
  result?: Record<string, unknown> | null;
  created_at: string;
  locked_at?: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  trace_id?: string | null;
}
