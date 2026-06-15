import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

import { ConversionProvider } from "@/components/conversion/ConversionProvider";

import { canAccessEnterprise } from "@/lib/auth/permissions";

import { getRedirectPath } from "@/lib/auth/redirect";

import { isOwner } from "@/lib/auth/owner";

import { getSubscriptionAccessFromSession, type SessionSubscriptionClient } from "@/lib/billing/getSubscriptionAccess";

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

  const access = await getSubscriptionAccessFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
  );



  if (!access.canAccessDashboard) {

    redirect(getRedirectPath({

      email: user.email,

      plan: access.plan,

      subscription_status: access.status,

    }));

  }



  void ensureUserOrg(user.id, user.email ?? null).catch(() => {});



  const showEnterprise = canAccessEnterprise({

    email: user.email,

    plan: access.plan,

    subscription_status: access.status,

  });



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


