import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseEnvError } from "@/lib/supabase/env";
import type { SessionSupabaseClient } from "@/lib/auth/redirect";
import { getRedirectPathForSession } from "@/lib/auth/redirectServer";
import { attachReferralOnSignup } from "@/lib/referrals/attach";
import { auditLog, extractIp } from "@/lib/audit/log";
import { ensureUserOrg } from "@/lib/org/migrateExistingUsers";
import {
  PROSPECT_ATTRIBUTION_COOKIE,
  captureSignupAttribution,
  isValidAttributionToken,
} from "@/lib/owner/prospectAttribution";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next");

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

      let clearProspectCookie = false;

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

        // Capture prospect attribution from the durable cookie. This is the only
        // place OAuth and email-confirmation signups can be attributed, since the
        // client-side sessionStorage token is unavailable to this server route.
        const prospectToken = cookieStore.get(PROSPECT_ATTRIBUTION_COOKIE)?.value;
        if (isValidAttributionToken(prospectToken)) {
          try {
            const admin = createAdminClient();
            await captureSignupAttribution(admin, prospectToken!, user.id);
            clearProspectCookie = true;
          } catch (err) {
            console.error('[auth/callback] attribution capture failed:', err);
          }
        }

        void ensureUserOrg(user.id, user.email).catch((err) =>
          console.error('[auth/callback] ensureUserOrg failed:', err),
        );

        auditLog({
          userId: user.id,
          action: nextPath === '/reset-password' ? 'password_reset' : 'login',
          metadata: {
            provider: nextPath === '/reset-password' ? 'recovery' : 'oauth',
          },
          ip: extractIp(request),
        });
      }

      const destination =
        nextPath && nextPath.startsWith('/')
          ? `${origin}${nextPath}`
          : `${origin}${await getRedirectPathForSession(supabase as unknown as SessionSupabaseClient)}`;

      const response = NextResponse.redirect(destination);
      if (clearProspectCookie) {
        response.cookies.set(PROSPECT_ATTRIBUTION_COOKIE, '', { maxAge: 0, path: '/' });
      }
      return response;
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
