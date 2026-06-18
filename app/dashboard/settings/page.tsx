import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import BillingCard from "@/components/dashboard/BillingCard";
import NotificationPreferencesCard from "@/components/dashboard/NotificationPreferencesCard";
import SettingsUpgradeBanner from "@/components/dashboard/SettingsUpgradeBanner";
import QaSimulationPanel from "@/components/dashboard/QaSimulationPanel";
import { normalizePlan } from "@/lib/auth/permissions";
import { canAccessFeature } from "@/lib/auth/featureGate";
import { getUserWithPlan } from "@/lib/billing/planService";
import { getActiveOrgId } from "@/lib/org/context";
import { getNotificationPreferences } from "@/lib/notifications/preferences";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings — CyberShield",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
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
  const params = await searchParams;
  const upgradeFeature = params.upgrade ?? null;
  const notificationPreferences = await getNotificationPreferences(user.id, orgId);
  const emailAlertsAvailable = canAccessFeature(
    {
      email: user.email,
      plan: currentPlan,
      subscription_status: subscriptionStatus,
      isQaAccount: userWithPlan.isQaAccount,
    },
    'alerts',
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email={user.email ?? ""} title="Settings" />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-8">
          {upgradeFeature && <SettingsUpgradeBanner feature={upgradeFeature} />}

          {userWithPlan.isQaAccount && userWithPlan.qaSimulatedPlan && (
            <QaSimulationPanel initialPlan={userWithPlan.qaSimulatedPlan} />
          )}

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
                  Name and profile photo editing coming soon — your email is managed through your login provider.
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
              <NotificationPreferencesCard
                initialPreferences={notificationPreferences}
                emailAlertsAvailable={emailAlertsAvailable}
              />
            </CardContent>
          </Card>

          {/* Billing & Plan */}
          <Card id="billing">
            <CardHeader>
              <CardTitle>Billing &amp; Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-gray-500">
                Upgrade your plan, manage payment methods, and view daily scan usage limits.
              </p>
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
                      <p className="mt-1 text-xs text-gray-600">
                        Account deletion is handled by support — email{' '}
                        <a href="mailto:support@cybershield.app" className="text-blue-400 underline hover:text-blue-300">
                          support@cybershield.app
                        </a>
                      </p>
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
