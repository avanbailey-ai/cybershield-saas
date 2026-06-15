import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { canAccessDashboard } from "@/lib/auth/permissions";
import { isOwner } from "@/lib/auth/owner";

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

  if (owner) {
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
    redirect("/#pricing");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1e]">
      <DashboardSidebar showAdmin={owner} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
