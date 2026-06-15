import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Future SSO hook point: import { isSSOEnabled } from '@/lib/auth/sso'
// and redirect to IdP when org requires SSO before dashboard access.

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
