import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseEnvError } from "@/lib/supabase/env";
import { getRedirectPathForSession, type SessionSupabaseClient } from "@/lib/auth/redirect";
import { attachReferralOnSignup } from "@/lib/referrals/attach";
import { auditLog, extractIp } from "@/lib/audit/log";
import { ensureUserOrg } from "@/lib/org/migrateExistingUsers";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const cookieStore = await cookies();
        const refCode = cookieStore.get("cybershield_ref")?.value;
        if (refCode) {
          await attachReferralOnSignup({
            userId: user.id,
            email: user.email,
            referralCode: refCode,
          });
        }

        void ensureUserOrg(user.id, user.email).catch((err) =>
          console.error('[auth/callback] ensureUserOrg failed:', err),
        );

        auditLog({
          userId: user.id,
          action: 'login',
          metadata: { provider: 'oauth' },
          ip: extractIp(request),
        });
      }

      const path = await getRedirectPathForSession(supabase as unknown as SessionSupabaseClient);
      return NextResponse.redirect(`${origin}${path}`);
    }
  } catch (err) {
    const message =
      err instanceof SupabaseEnvError
        ? err.message
        : err instanceof Error
          ? err.message
          : "auth_callback_failed";
    console.error("[auth/callback] Supabase init or exchange failed:", message);
    return NextResponse.redirect(`${origin}/login?error=auth_not_configured`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
