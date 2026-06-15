import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import BillingCard from "@/components/dashboard/BillingCard";
import { normalizePlan } from "@/lib/auth/permissions";
import { getUserWithPlan } from "@/lib/billing/planService";
import { getActiveOrgId } from "@/lib/org/context";

export const dynamic = "force-dynamic";

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

  const orgId = await getActiveOrgId(user.id);
  const userWithPlan = await getUserWithPlan(user.id, orgId, user.email);
  const currentPlan = normalizePlan(userWithPlan.plan);
  const subscriptionStatus = userWithPlan.subscription_status ?? null;

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
              <div className="flex items-center gap-2">
                <CardTitle>Notification Preferences</CardTitle>
                <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  Coming soon
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-gray-500">
                Email notification controls are not available yet. Alerts use your account defaults until preferences can be saved here.
              </p>
              <ul className="space-y-3">
                {[
                  {
                    label: "Email alerts for new vulnerabilities",
                    description: "Will be configurable in a future update.",
                  },
                  {
                    label: "Weekly security digest",
                    description: "Scheduled digest emails will be configurable in a future update.",
                  },
                  {
                    label: "Critical threat notifications",
                    description: "Real-time critical alerts will be configurable in a future update.",
                  },
                ].map((pref) => (
                  <li key={pref.label} className="rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3">
                    <p className="text-sm font-medium text-gray-400">{pref.label}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{pref.description}</p>
                  </li>
                ))}
              </ul>
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
