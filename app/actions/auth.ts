"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseEnvError } from "@/lib/supabase/env";
import { getRedirectPathForSession, type SessionSupabaseClient } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signUp(formData: FormData) {
  try {
    const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // IMPORTANT: Also update Site URL in Supabase Dashboard:
  // Authentication → URL Configuration → Site URL → set to your Vercel URL
  // Also add your Vercel URL to "Redirect URLs" allowlist
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://cybershield-saas.vercel.app");

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
