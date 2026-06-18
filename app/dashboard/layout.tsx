import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import DashboardShell from "@/components/dashboard/DashboardShell";

import { ConversionProvider } from "@/components/conversion/ConversionProvider";

import { canAccessEnterprise } from "@/lib/auth/permissions";
import { userFromSubscriptionAccess } from "@/lib/auth/enterpriseGateUser";

import { getRedirectPath } from "@/lib/auth/redirect";

import { isOwner } from "@/lib/auth/owner";

import { type SessionSubscriptionClient } from "@/lib/billing/getSubscriptionAccess";
import { resolveOrgSessionContextFromSession } from "@/lib/org/sessionContext";

import ReportProblemWidget from "@/components/beta/ReportProblemWidget";
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

  if (owner) {
    return <>{children}</>;
  }

  const orgCtx = await resolveOrgSessionContextFromSession(
    supabase as unknown as SessionSubscriptionClient,
    user.id,
    user.email,
  );
  const access = orgCtx.access;



  if (!access.canAccessDashboard) {

    redirect(getRedirectPath(userFromSubscriptionAccess(access, user.email), orgCtx.role));

  }

  const showEnterprise = canAccessEnterprise(
    userFromSubscriptionAccess(access, user.email),
    orgCtx.role,
  );

  void ensureUserOrg(user.id, user.email ?? null).catch(() => {});



  return (

    <ConversionProvider>

      <DashboardShell showAdmin={owner} showEnterprise={showEnterprise}>

        {children}

      </DashboardShell>

      <ReportProblemWidget userEmail={user.email} />

    </ConversionProvider>

  );

}


