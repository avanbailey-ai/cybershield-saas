import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireEnterpriseAccess } from '@/lib/auth/requireEnterpriseAccess';
import { isOrgAdminRole } from '@/lib/auth/rbac';
import { generateEnterpriseReportPDFForOrg } from '@/lib/enterprise/pdf/generateEnterpriseReportPDF';
import { parseDateRange } from '@/lib/enterprise/reportBuilder';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';

type ExportPdfBody = {
  org_id?: string;
  date_range?: { start?: string; end?: string };
};

/** POST /api/enterprise/export/pdf — SOC2-style enterprise report (owner/admin only) */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireEnterpriseAccess(
    user,
    supabase as unknown as SessionSubscriptionClient,
  );
  if (!access.allowed) return access.response;

  if (!isOrgAdminRole(access.role)) {
    return NextResponse.json(
      { error: 'Forbidden: only organization owners and admins may export reports' },
      { status: 403 },
    );
  }

  let body: ExportPdfBody;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requestedOrgId = body.org_id ?? access.orgId;
  if (requestedOrgId !== access.orgId) {
    return NextResponse.json({ error: 'Forbidden: org context mismatch' }, { status: 403 });
  }

  const dateRange = parseDateRange(body.date_range);

  try {
    const { buffer, filename } = await generateEnterpriseReportPDFForOrg(access.orgId, dateRange);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF report';
    console.error('[enterprise/export/pdf]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
