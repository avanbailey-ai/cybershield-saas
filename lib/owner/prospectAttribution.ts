import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';
import { logOutreachEvent } from './outreachEvents';
import { isInternalCustomerEmail } from './founderCustomerFilters';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cybershieldcloud.com';

export function buildAttributionSignupUrl(token: string): string {
  return `${APP_URL}/signup?source=outreach&prospect=${encodeURIComponent(token)}`;
}

export async function createAttributionToken(
  admin: SupabaseClient,
  input: { prospectId: string; draftId?: string | null },
): Promise<string> {
  const token = randomBytes(24).toString('base64url');

  const { error } = await admin.from('owner_prospect_attributions').insert({
    prospect_id: input.prospectId,
    outreach_draft_id: input.draftId ?? null,
    token,
  });

  if (error) {
    throw new Error(`Failed to create attribution token: ${error.message}`);
  }

  return token;
}

export async function getOrCreateAttributionToken(
  admin: SupabaseClient,
  input: { prospectId: string; draftId?: string | null },
): Promise<string> {
  if (input.draftId) {
    const { data: existing } = await admin
      .from('owner_prospect_attributions')
      .select('token')
      .eq('outreach_draft_id', input.draftId)
      .maybeSingle();

    if (existing?.token) return existing.token as string;
  }

  const { data: recent } = await admin
    .from('owner_prospect_attributions')
    .select('token')
    .eq('prospect_id', input.prospectId)
    .is('signed_up_user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.token) return recent.token as string;

  return createAttributionToken(admin, input);
}

export function appendAttributionLink(body: string, signupUrl: string): string {
  const footer = `\n\nStart monitoring with CyberShield Cloud:\n${signupUrl}\n\nUnsubscribe: reply STOP`;
  if (body.includes(signupUrl)) return body;
  return `${body.trim()}${footer}`;
}

export async function recordAttributionClick(
  admin: SupabaseClient,
  token: string,
): Promise<boolean> {
  const { data } = await admin
    .from('owner_prospect_attributions')
    .select('id, clicked_at')
    .eq('token', token)
    .maybeSingle();

  if (!data?.id) return false;

  if (!data.clicked_at) {
    await admin
      .from('owner_prospect_attributions')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', data.id);
  }

  return true;
}

export async function captureSignupAttribution(
  admin: SupabaseClient,
  token: string,
  userId: string,
): Promise<{ ok: boolean; error?: string; prospectId?: string }> {
  const { data: row } = await admin
    .from('owner_prospect_attributions')
    .select('id, prospect_id, signed_up_user_id, clicked_at')
    .eq('token', token)
    .maybeSingle();

  if (!row) return { ok: false, error: 'Invalid attribution token' };

  if (row.signed_up_user_id && row.signed_up_user_id !== userId) {
    return { ok: false, error: 'Attribution token already used' };
  }

  const now = new Date().toISOString();
  await admin
    .from('owner_prospect_attributions')
    .update({
      signed_up_user_id: userId,
      signed_up_at: now,
      clicked_at: row.clicked_at ?? now,
    })
    .eq('id', row.id);

  const prospectId = row.prospect_id as string;

  await admin
    .from('owner_prospects')
    .update({ pipeline_state: 'interested', updated_at: now })
    .eq('id', prospectId)
    .in('pipeline_state', ['contacted', 'follow_up_scheduled', 'follow_up_due', 'outreach_ready']);

  await logOutreachEvent(admin, {
    prospect_id: prospectId,
    event_type: 'prospect_signup',
    detail: `Signup attributed to prospect`,
    metadata: { user_id: userId, token },
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.email) {
    const { data: crmExisting } = await admin
      .from('owner_crm_leads')
      .select('id')
      .eq('prospect_id', prospectId)
      .is('deleted_at', null)
      .maybeSingle();

    if (crmExisting?.id) {
      await admin
        .from('owner_crm_leads')
        .update({
          stage: 'trial',
          interest_at: now,
          interest_source: 'outreach_signup',
          last_contact_at: now,
        })
        .eq('id', crmExisting.id);
    } else {
      const { data: prospect } = await admin
        .from('owner_prospects')
        .select('business_name, website, industry, contact_email, lead_score, estimated_plan_fit')
        .eq('id', prospectId)
        .maybeSingle();

      if (prospect) {
        await admin.from('owner_crm_leads').insert({
          prospect_id: prospectId,
          business_name: prospect.business_name,
          website: prospect.website,
          industry: prospect.industry,
          contact_email: profile.email,
          stage: 'trial',
          lead_score: prospect.lead_score,
          potential_revenue: prospect.estimated_plan_fit,
          interest_at: now,
          interest_source: 'outreach_signup',
          last_contact_at: now,
          notes: 'Auto-created from outreach attribution signup',
        });
      }
    }
  }

  return { ok: true, prospectId };
}

export async function reconcilePaidConversions(admin: SupabaseClient): Promise<number> {
  const { data: pending } = await admin
    .from('owner_prospect_attributions')
    .select('id, prospect_id, signed_up_user_id, outreach_draft_id')
    .not('signed_up_user_id', 'is', null)
    .is('converted_at', null)
    .limit(50);

  if (!pending?.length) return 0;

  const displayAmounts = await getPlanDisplayAmounts();
  let converted = 0;

  for (const row of pending) {
    const userId = row.signed_up_user_id as string;
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, plan, subscription_status')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.email || isInternalCustomerEmail(profile.email as string)) continue;

    const plan = (profile.plan as string) ?? 'free';
    const status = profile.subscription_status as string;
    const isPaid =
      (status === 'active' || status === 'trialing') && plan !== 'free' && plan !== 'owner';

    if (!isPaid) continue;

    const mrr = displayAmounts[plan as keyof typeof displayAmounts] ?? 0;
    const now = new Date().toISOString();
    const prospectId = row.prospect_id as string;

    await admin
      .from('owner_prospect_attributions')
      .update({
        converted_user_id: userId,
        converted_at: now,
        converted_plan: plan,
        converted_mrr: mrr,
      })
      .eq('id', row.id);

    await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'customer', updated_at: now })
      .eq('id', prospectId);

    await admin
      .from('owner_crm_leads')
      .update({ stage: 'customer', last_contact_at: now })
      .eq('prospect_id', prospectId)
      .is('deleted_at', null);

    await logOutreachEvent(admin, {
      prospect_id: prospectId,
      draft_id: row.outreach_draft_id as string | null,
      event_type: 'prospect_converted',
      recipient_email: profile.email as string,
      detail: `Converted to ${plan} ($${mrr}/mo)`,
      metadata: { user_id: userId, plan, mrr },
    });

    converted++;
  }

  return converted;
}
