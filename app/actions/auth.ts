"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseEnvError } from "@/lib/supabase/env";
import type { SessionSupabaseClient } from "@/lib/auth/redirect";
import { getRedirectPathForSession } from "@/lib/auth/redirectServer";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PRODUCTION_SITE_URL } from "@/lib/site/getSiteUrl";

export async function signUp(formData: FormData) {
  try {
    const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // IMPORTANT: Also update Site URL in Supabase Dashboard:
  // Authentication → URL Configuration → Site URL → https://cybershieldcloud.com
  // Also add https://cybershieldcloud.com and https://www.cybershieldcloud.com to Redirect URLs
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : PRODUCTION_SITE_URL);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(await getRedirectPathForSession(supabase as unknown as SessionSupabaseClient));
  } catch (err) {
    if (err instanceof SupabaseEnvError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function signIn(formData: FormData) {
  try {
    const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(await getRedirectPathForSession(supabase as unknown as SessionSupabaseClient));
  } catch (err) {
    if (err instanceof SupabaseEnvError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function signOut() {
  try {
    const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
  } catch (err) {
    if (err instanceof SupabaseEnvError) {
      return { error: err.message };
    }
    throw err;
  }
}
