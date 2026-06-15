import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessDashboard } from "@/lib/auth/permissions";
import { isOwner } from "@/lib/auth/owner";

const PUBLIC_PATHS = ["/", "/scan", "/login", "/signup", "/auth/callback", "/pricing"];
const AUTH_PATHS = ["/login", "/signup"];

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

    if (isProtected) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(url);
      }

      let plan = "free";
      if (isOwner(user.email)) {
        plan = "owner";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();
        plan = profile?.plan ?? "free";
      }

      if (!canAccessDashboard({ email: user.email, plan })) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.hash = "pricing";
        return NextResponse.redirect(url);
      }
    }

    if (isAuthPath && user) {
      const url = request.nextUrl.clone();
      if (isOwner(user.email)) {
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      const plan = profile?.plan ?? "free";
      if (canAccessDashboard({ email: user.email, plan })) {
        url.pathname = "/dashboard";
      } else {
        url.pathname = "/";
        url.hash = "pricing";
      }
      return NextResponse.redirect(url);
    }

    // Allow public routes without auth checks
    if (isPublicPath(pathname)) {
      return supabaseResponse;
    }

    return supabaseResponse;
  } catch (error) {
    console.log('[middleware] error', error);
    return NextResponse.next({ request });
  }
}
