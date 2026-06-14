import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import BillingCard from "@/components/dashboard/BillingCard";
import type { Plan } from "@/lib/billing/planService";

export const metadata: Metadata = {
  title: "Settings — CyberShield",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", user.id)
    .single();

  const currentPlan = (profile?.plan ?? "free") as Plan;
  const subscriptionStatus = profile?.subscription_status ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? ""} title="Settings" />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-8">

          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={user.email ?? ""}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-300 outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Member Since
                  </label>
                  <p className="text-sm text-gray-300">{memberSince}</p>
                </div>
                <p className="rounded-lg border border-gray-700/50 bg-gray-800/30 px-3 py-2 text-xs text-gray-500">
                  Profile editing coming soon.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    id: "notif-vuln",
                    label: "Email alerts for new vulnerabilities",
                    description: "Configurable notification delivery coming in a future update.",
                    defaultOn: true,
                  },
                  {
                    id: "notif-digest",
                    label: "Weekly security digest",
                    description: "Scheduled digest emails will be configurable in a future update.",
                    defaultOn: true,
                  },
                  {
                    id: "notif-critical",
                    label: "Critical threat notifications",
                    description: "Real-time critical alerts will be configurable in a future update.",
                    defaultOn: true,
                  },
                ].map((pref) => (
                  <div key={pref.id} className="flex items-start gap-4 rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3">
                    {/* Toggle visual — static, no JS */}
                    <div
                      aria-label={pref.label}
                      className={`relative mt-0.5 flex h-5 w-9 flex-shrink-0 cursor-not-allowed items-center rounded-full transition-colors ${
                        pref.defaultOn ? "bg-blue-600" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          pref.defaultOn ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200">{pref.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{pref.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Billing & Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Billing &amp; Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <BillingCard currentPlan={currentPlan} subscriptionStatus={subscriptionStatus} />
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Danger zone */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-500">
                    Danger Zone
                  </p>
                  <div className="flex items-center justify-between rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-200">Delete Account</p>
                      <p className="mt-0.5 text-xs text-gray-500">Permanently remove your account and all data.</p>
                    </div>
                    <div title="Contact support to delete your account">
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-500 opacity-60"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
