import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { NextResponse, type NextRequest } from "next/server";

import { mapSessionAuthCookies } from "@/lib/supabase/authCookies";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

import { getRedirectPath, type SessionSupabaseClient } from "@/lib/auth/redirect";
import { getRedirectPathForSession } from "@/lib/auth/redirectServer";
import { userFromSubscriptionAccess } from "@/lib/auth/enterpriseGateUser";

import { getSubscriptionAccessFromSession, type SessionSubscriptionClient } from "@/lib/billing/getSubscriptionAccess";
import {
  ORG_CONTEXT_COOKIE,
  resolveOrgSessionContextFromSession,
  hasOrgMembership,
} from "@/lib/org/sessionContext";
import { isOwner } from "@/lib/auth/owner";
import { canAccessEnterprise } from "@/lib/auth/permissions";



const PUBLIC_PATHS = ["/", "/scan", "/login", "/signup", "/auth/callback", "/reset-password", "/pricing", "/scan-result", "/leaderboard", "/enterprise", "/checkout/complete", "/terms", "/privacy", "/refund", "/contact"];

const AUTH_PATHS = ["/login", "/signup", "/enterprise/login"];

const REF_COOKIE = "cybershield_ref";

const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Enterprise users manage sites/scans here — do not redirect to portal. */
const ENTERPRISE_OPERATIONAL_APP_PREFIXES = [
  '/app/websites',
  '/app/scans',
  '/app/reports',
  '/app/alerts',
  '/app/settings',
] as const;

function isEnterpriseOperationalAppPath(pathname: string): boolean {
  return ENTERPRISE_OPERATIONAL_APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}



// Future SSO hook point: before isProtected check, evaluate isSSOEnabled() + org SSO config

// and redirect unauthenticated SSO-required users to IdP login flow.



function isPublicPath(pathname: string): boolean {

  if (pathname.startsWith('/enterprise/portal')) return false;

  if (pathname.startsWith('/enterprise/onboarding')) return false;

  return PUBLIC_PATHS.some(

    (p) => pathname === p || pathname.startsWith(`${p}/`),

  );

}



export async function updateSession(request: NextRequest) {

  const supabaseEnv = getSupabasePublicEnv();

  if (!supabaseEnv) {

    console.log('[middleware] Supabase env vars missing — passing through');

    return NextResponse.next({ request });

  }



  try {

    let supabaseResponse = NextResponse.next({ request });



    const supabase = createServerClient(

      supabaseEnv.url,

      supabaseEnv.anonKey,

      {

        cookies: {

          getAll() {

            return request.cookies.getAll();

          },

          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            const sessionCookies = mapSessionAuthCookies(cookiesToSet);

            sessionCookies.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );

            supabaseResponse = NextResponse.next({ request });

            sessionCookies.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },

        },

      }

    );



    const {

      data: { user },

    } = await supabase.auth.getUser();



    const { pathname } = request.nextUrl;

    // Legacy /dashboard → canonical /app (enterprise dashboard → portal)
    if (pathname.startsWith('/dashboard/enterprise')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace('/dashboard/enterprise', '/enterprise/portal');
      return NextResponse.redirect(url, 308);
    }

    if (pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/dashboard/, '/app');
      return NextResponse.redirect(url, 308);
    }

    const isProtected =
      pathname.startsWith('/app') ||
      pathname.startsWith('/enterprise/portal') ||
      pathname.startsWith('/enterprise/onboarding');

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



    const cookieOrgId = request.cookies.get(ORG_CONTEXT_COOKIE)?.value ?? null;



    if (isOnboarding) {

      if (!user) {

        const url = request.nextUrl.clone();

        url.pathname = "/login";

        url.searchParams.set("redirectTo", pathname);

        return NextResponse.redirect(url);

      }

      const orgCtxForOnboarding = await resolveOrgSessionContextFromSession(
        supabase as unknown as SessionSubscriptionClient,
        user.id,
        user.email,
        cookieOrgId,
      );

      if (!isOwner(user.email) && !hasOrgMembership(orgCtxForOnboarding)) {
        return supabaseResponse;
      }

      const access = await getSubscriptionAccessFromSession(
        supabase as unknown as SessionSubscriptionClient,
        user.id,
        user.email,
        cookieOrgId,
      );

      const redirectPath = getRedirectPath({

        email: user.email,

        plan: access.plan,

        subscription_status: access.status,

      }, access.orgRole);

      if (redirectPath !== "/onboarding") {

        const url = request.nextUrl.clone();

        url.pathname = redirectPath;

        return NextResponse.redirect(url);

      }

    }



    if (isProtected) {

      const isEnterprisePortal = pathname.startsWith('/enterprise/portal');
      const isEnterpriseOnboarding = pathname.startsWith('/enterprise/onboarding');

      if (!user) {

        const url = request.nextUrl.clone();

        url.pathname = isEnterprisePortal || isEnterpriseOnboarding ? "/enterprise/login" : "/login";

        const redirectTarget = `${pathname}${request.nextUrl.search}`;
        url.searchParams.set("redirectTo", redirectTarget);

        return NextResponse.redirect(url);

      }



      const orgCtx = await resolveOrgSessionContextFromSession(
        supabase as unknown as SessionSubscriptionClient,
        user.id,
        user.email,
        cookieOrgId,
      );

      if (!isEnterprisePortal && !isOwner(user.email) && !hasOrgMembership(orgCtx)) {

        const url = request.nextUrl.clone();

        url.pathname = "/onboarding";

        url.searchParams.set("reason", "no_org");

        return NextResponse.redirect(url);

      }



      if (isEnterprisePortal) {
        const enterpriseUser = userFromSubscriptionAccess(orgCtx.access, user.email);

        if (!canAccessEnterprise(enterpriseUser, orgCtx.role)) {
          const url = request.nextUrl.clone();
          url.pathname = '/app';
          return NextResponse.redirect(url);
        }

        console.log('[enterprise-access] enterprise_access_granted', {
          orgId: orgCtx.orgId,
          role: orgCtx.role,
        });
      }

      if (
        pathname.startsWith('/app') &&
        !isEnterpriseOperationalAppPath(pathname) &&
        canAccessEnterprise(userFromSubscriptionAccess(orgCtx.access, user.email), orgCtx.role)
      ) {
        const url = request.nextUrl.clone();
        url.pathname = '/enterprise/portal';
        return NextResponse.redirect(url);
      }



      if (isEnterpriseOnboarding) {
        if (
          !canAccessEnterprise(userFromSubscriptionAccess(orgCtx.access, user.email), orgCtx.role)
        ) {
          const url = request.nextUrl.clone();
          url.pathname = '/app';
          return NextResponse.redirect(url);
        }
      }

      if (!isEnterprisePortal && !isEnterpriseOnboarding && !orgCtx.access.canAccessDashboard) {

        const url = request.nextUrl.clone();

        url.pathname = getRedirectPath(
          userFromSubscriptionAccess(orgCtx.access, user.email),
          orgCtx.role,
        );

        return NextResponse.redirect(url);

      }



      if (orgCtx.orgId) {

        supabaseResponse.cookies.set(ORG_CONTEXT_COOKIE, orgCtx.orgId, {

          maxAge: 60 * 60 * 24 * 30,

          path: "/",

          sameSite: "lax",

          httpOnly: true,

        });

      }

    }



    if (isAuthPath && user) {

      if (pathname.startsWith('/enterprise/login')) {
        const access = await getSubscriptionAccessFromSession(
          supabase as unknown as SessionSubscriptionClient,
          user.id,
          user.email,
          cookieOrgId,
        );
        const url = request.nextUrl.clone();
        url.pathname = canAccessEnterprise(
          userFromSubscriptionAccess(access, user.email),
          access.orgRole,
        )
          ? '/enterprise/portal'
          : '/app';
        return NextResponse.redirect(url);
      }

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



    // Serve /app/* from existing /dashboard/* route tree
    if (pathname.startsWith('/app')) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = pathname.replace(/^\/app/, '/dashboard');
      const rewriteResponse = NextResponse.rewrite(rewriteUrl, { request });
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        rewriteResponse.cookies.set(cookie.name, cookie.value);
      });
      return rewriteResponse;
    }



    return supabaseResponse;

  } catch (error) {

    console.log('[middleware] error', error);

    return NextResponse.next({ request });

  }

}

