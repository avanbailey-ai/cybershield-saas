import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRedirectPath, getRedirectPathForSession, type SessionSupabaseClient } from "@/lib/auth/redirect";
import { canAccessDashboard } from "@/lib/auth/permissions";
import { isOwner } from "@/lib/auth/owner";

const PUBLIC_PATHS = ["/", "/scan", "/login", "/signup", "/auth/callback", "/pricing", "/scan-result", "/leaderboard"];
const AUTH_PATHS = ["/login", "/signup"];
const REF_COOKIE = "cybershield_ref";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Future SSO hook point: before isProtected check, evaluate isSSOEnabled() + org SSO config
// and redirect unauthenticated SSO-required users to IdP login flow.

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('[middleware] Supabase env vars missing — passing through');
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isProtected = pathname.startsWith("/dashboard");
    const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
    const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

    const refCode = request.nextUrl.searchParams.get("ref");
    if (refCode?.startsWith("CSHIELD-")) {
      supabaseResponse.cookies.set(REF_COOKIE, refCode, {
        maxAge: REF_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
      });
    }

    if (isOnboarding) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(url);
      }

      let plan = "free";
      let subscriptionStatus: string | null = "inactive";
      if (isOwner(user.email)) {
        plan = "owner";
        subscriptionStatus = "active";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_status")
          .eq("id", user.id)
          .single();
        plan = profile?.plan ?? "free";
        subscriptionStatus = profile?.subscription_status ?? "inactive";
      }

      const redirectPath = getRedirectPath({ email: user.email, plan, subscription_status: subscriptionStatus });
      if (redirectPath !== "/onboarding") {
        const url = request.nextUrl.clone();
        url.pathname = redirectPath;
        return NextResponse.redirect(url);
      }
    }

    if (isProtected) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(url);
      }

      let plan = "free";
      let subscriptionStatus: string | null = "inactive";
      if (isOwner(user.email)) {
        plan = "owner";
        subscriptionStatus = "active";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_status")
          .eq("id", user.id)
          .single();
        plan = profile?.plan ?? "free";
        subscriptionStatus = profile?.subscription_status ?? "inactive";
      }

      if (!canAccessDashboard({ email: user.email, plan, subscription_status: subscriptionStatus })) {
        const url = request.nextUrl.clone();
        url.pathname = getRedirectPath({ email: user.email, plan, subscription_status: subscriptionStatus });
        return NextResponse.redirect(url);
      }
    }

    if (isAuthPath && user) {
      const redirectPath = await getRedirectPathForSession(
        supabase as unknown as SessionSupabaseClient,
      );
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      return NextResponse.redirect(url);
    }

    if (isPublicPath(pathname)) {
      return supabaseResponse;
    }

    return supabaseResponse;
  } catch (error) {
    console.log('[middleware] error', error);
    return NextResponse.next({ request });
  }
}
