import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedirectPathForSession } from "@/lib/auth/redirectServer";
import type { SessionSupabaseClient } from "@/lib/auth/redirect";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = await getRedirectPathForSession(
    supabase as unknown as SessionSupabaseClient,
  );
  return NextResponse.json({ path });
}
