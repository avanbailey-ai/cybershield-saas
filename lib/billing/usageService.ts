/**
 * usageService.ts — Real-time daily usage tracking.
 *
 * Tracks per-user scan and website counts in the `user_usage` table.
 * Uses atomic upserts to avoid race conditions when multiple scans fire concurrently.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface DailyUsage {
  scans_used: number;
  websites_used: number;
}

/** Returns today's usage row for a user, or zeroed defaults if none exists yet. */
export async function getUsage(userId: string, date: string): Promise<DailyUsage> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_usage')
      .select('scans_used, websites_used')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error || !data) return { scans_used: 0, websites_used: 0 };
    return { scans_used: data.scans_used ?? 0, websites_used: data.websites_used ?? 0 };
  } catch {
    return { scans_used: 0, websites_used: 0 };
  }
}

/**
 * Atomically increment today's scan count for a user.
 * Uses raw SQL via rpc to guarantee the increment is race-condition-free.
 */
export async function incrementScanUsage(userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Atomic upsert: insert row or increment scans_used if it already exists
  const { error } = await supabase.rpc('increment_scan_usage', { p_user_id: userId });

  if (error) {
    // Fallback: use a regular upsert if the RPC doesn't exist yet
    console.warn('[usageService] rpc increment_scan_usage unavailable, using fallback upsert:', error.message);

    // Fallback: read current value first, then upsert with incremented value.
    // Not perfectly atomic (race condition possible under extreme concurrency) but correct for all normal usage.
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('user_usage')
      .select('scans_used')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    const newCount = (existing?.scans_used ?? 0) + 1;

    await supabase
      .from('user_usage')
      .upsert(
        { user_id: userId, date: today, scans_used: newCount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      );
    // If upsert fails silently, the scan still runs — usage tracking is best-effort
  }
}

/**
 * Atomically decrement today's scan count for a user (floor at 0).
 * Called as a compensating action when a queue insert fails after usage was incremented.
 */
export async function decrementScanUsage(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error: rpcError } = await supabase.rpc('decrement_scan_usage', { p_user_id: userId });
  if (rpcError) {
    // Fallback: read-then-decrement
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('user_usage')
      .select('scans_used')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    const newCount = Math.max(0, (existing?.scans_used ?? 1) - 1);
    await supabase
      .from('user_usage')
      .update({ scans_used: newCount, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('date', today);
  }
}

/** Count how many active websites a user currently has. */
export async function getUserWebsiteCount(userId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('websites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
