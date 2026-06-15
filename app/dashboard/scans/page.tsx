import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ScanQueueList from "@/components/dashboard/ScanQueueList";

export const metadata: Metadata = {
  title: "Scans — CyberShield",
};

export default async function ScansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? "User"} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Scans</h2>
          <p className="mt-1 text-sm text-gray-500">
            Live scan queue — status updates instantly without refresh.
          </p>
        </div>
        <ScanQueueList />
      </main>
    </div>
  );
}
