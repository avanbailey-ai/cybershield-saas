import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import WebsiteList from "@/components/dashboard/websites/WebsiteList";

export const metadata: Metadata = {
  title: "Websites — CyberShield",
};

export default async function WebsitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} />
      <main className="flex-1 overflow-auto p-6">
        <WebsiteList />
      </main>
    </div>
  );
}
