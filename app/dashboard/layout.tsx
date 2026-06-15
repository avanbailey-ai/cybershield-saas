import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { ConversionProvider } from "@/components/conversion/ConversionProvider";
import { canAccessDashboard, canAccessEnterprise } from "@/lib/auth/permissions";
import { getRedirectPath } from "@/lib/auth/redirect";
import { isOwner } from "@/lib/auth/owner";
import { ensureUserOrg } from "@/lib/org/migrateExistingUsers";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const owner = isOwner(user.email);
  let plan = "free";
  let subscriptionStatus: string | null = "inactive";

  if (owner) {
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
    redirect(getRedirectPath({ email: user.email, plan, subscription_status: subscriptionStatus }));
  }

  void ensureUserOrg(user.id, user.email ?? null).catch(() => {});

  const showEnterprise = canAccessEnterprise({ email: user.email, plan, subscription_status: subscriptionStatus });

  return (
    <ConversionProvider>
      <div className="flex h-screen overflow-hidden bg-[#0a0f1e]">
        <DashboardSidebar showAdmin={owner} showEnterprise={showEnterprise} />
        <div className="flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </ConversionProvider>
  );
}
