import { createAdminClient } from '@/lib/supabase/admin';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PREFIX = 'CSHIELD-';

function randomSegment(): string {
  let segment = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    segment += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return segment;
}

export function generateReferralCode(_userId: string): string {
  return `${CODE_PREFIX}${randomSegment()}`;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .single();

  if (profile?.referral_code) {
    return profile.referral_code;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', userId)
      .is('referral_code', null);

    if (!error) return code;

    const { data: refreshed } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (refreshed?.referral_code) return refreshed.referral_code;
  }

  throw new Error('Failed to generate unique referral code');
}

export function isValidReferralCode(code: string): boolean {
  return /^CSHIELD-[A-Z2-9]{6}$/.test(code);
}

export function maskUserId(userId: string): string {
  return `User #${userId.replace(/-/g, '').slice(0, 6)}`;
}
