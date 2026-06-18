import type { SupabaseClient } from '@supabase/supabase-js';
import { logOutreachEvent } from './outreachEvents';
import { DEFAULT_OUTREACH_SETTINGS } from './outreachSettings';

export interface ScheduleFollowUpsInput {
  prospectId: string;
  draftId: string;
  scheduleDays?: number[];
}

export async function scheduleFollowUps(
  admin: SupabaseClient,
  input: ScheduleFollowUpsInput,
): Promise<number> {
  const days = input.scheduleDays ?? DEFAULT_OUTREACH_SETTINGS.follow_up_schedule;
  const now = Date.now();
  let scheduled = 0;

  for (let i = 0; i < days.length; i++) {
    const dayOffset = days[i];
    const scheduledAt = new Date(now + dayOffset * 86400000).toISOString();

    const { error } = await admin.from('owner_follow_ups').insert({
      prospect_id: input.prospectId,
      draft_id: input.draftId,
      follow_up_number: i + 1,
      scheduled_at: scheduledAt,
      status: 'scheduled',
    });

    if (!error) {
      scheduled++;
      await logOutreachEvent(admin, {
        prospect_id: input.prospectId,
        draft_id: input.draftId,
        event_type: 'follow_up_scheduled',
        detail: `Follow-up #${i + 1} in ${dayOffset} days`,
        metadata: { follow_up_number: i + 1, scheduled_at: scheduledAt },
      });
    }
  }

  if (scheduled > 0) {
    await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'follow_up_scheduled', updated_at: new Date().toISOString() })
      .eq('id', input.prospectId);
  }

  return scheduled;
}

export async function markDueFollowUps(admin: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const { data: due } = await admin
    .from('owner_follow_ups')
    .select('id, prospect_id')
    .in('status', ['scheduled'])
    .lte('scheduled_at', now);

  let marked = 0;
  for (const row of due ?? []) {
    await admin.from('owner_follow_ups').update({ status: 'due' }).eq('id', row.id);
    await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'follow_up_due', updated_at: now })
      .eq('id', row.prospect_id);
    await logOutreachEvent(admin, {
      prospect_id: row.prospect_id as string,
      event_type: 'follow_up_due',
      detail: 'Follow-up ready for founder approval',
    });
    marked++;
  }
  return marked;
}

export async function getDueFollowUps(admin: SupabaseClient, limit = 10) {
  await markDueFollowUps(admin);
  const { data } = await admin
    .from('owner_follow_ups')
    .select('*, owner_prospects(business_name, contact_email, website)')
    .eq('status', 'due')
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function cancelFollowUps(
  admin: SupabaseClient,
  prospectId: string,
): Promise<void> {
  await admin
    .from('owner_follow_ups')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('prospect_id', prospectId)
    .in('status', ['scheduled', 'due']);
}
