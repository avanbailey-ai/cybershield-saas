import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateReferralCode } from "@/lib/referrals/codeFormat";

export { generateReferralCode, isValidReferralCode, maskUserId } from "@/lib/referrals/codeFormat";

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (profile?.referral_code) {
    return profile.referral_code;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId)
      .is("referral_code", null);

    if (!error) return code;

    const { data: refreshed } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .single();

    if (refreshed?.referral_code) return refreshed.referral_code;
  }

  throw new Error("Failed to generate unique referral code");
}
