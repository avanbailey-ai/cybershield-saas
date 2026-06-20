import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireEnterpriseAccess } from '@/lib/auth/requireEnterpriseAccess';
import { denyEnterpriseAdminAccess } from '@/lib/enterprise/enterpriseRbac';
import {
  generateEnterpriseReportPDFForOrg,
} from '@/lib/enterprise/pdf/generateEnterpriseReportPDF';
import { sanitizePdfDownloadFilename } from '@/lib/enterprise/pdf/pdfExportUtils';
import { parseDateRange } from '@/lib/enterprise/reportBuilder';
import type { SessionSubscriptionClient } from '@/lib/billing/getSubscriptionAccess';

export const maxDuration = 60;

type ExportPdfBody = {
  org_id?: string;
  date_range?: { start?: string; end?: string };
};

/** POST /api/enterprise/export/pdf — SOC2-style enterprise report (owner/admin only) */
export async function POST(req: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const access = await requireEnterpriseAccess(
    user,
    supabase as unknown as SessionSubscriptionClient,
  );
  if (!access.allowed) return access.response;

  const rbacDenied = denyEnterpriseAdminAccess(
    access.orgId,
    access.role,
    '/api/enterprise/export/pdf',
  );
  if (rbacDenied) return rbacDenied;

  let body: ExportPdfBody;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requestedOrgId = body.org_id ?? access.orgId;
  if (requestedOrgId !== access.orgId) {
    return NextResponse.json({ error: 'Forbidden: org context mismatch', requestId }, { status: 403 });
  }

  const dateRange = parseDateRange(body.date_range);

  try {
    console.log('[enterprise/export/pdf] start', { requestId, orgId: access.orgId, userId: user.id });
    const { buffer, filename } = await generateEnterpriseReportPDFForOrg(access.orgId, dateRange);
    const safeFilename = sanitizePdfDownloadFilename(filename);

    if (!buffer?.length) {
      console.error('[enterprise/export/pdf] empty_buffer', { requestId, orgId: access.orgId });
      return NextResponse.json(
        { error: 'PDF generation produced an empty file', requestId },
        { status: 500 },
      );
    }

    console.log('[enterprise/export/pdf] success', {
      requestId,
      orgId: access.orgId,
      bytes: buffer.length,
      filename: safeFilename,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF report';
    console.error('[enterprise/export/pdf] failed', {
      requestId,
      orgId: access.orgId,
      message,
    });
    return NextResponse.json(
      { error: 'Could not generate PDF report. Please try again.', requestId },
      { status: 500 },
    );
  }
}
