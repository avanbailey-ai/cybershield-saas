import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/org/context';
import { getUserWithPlan } from '@/lib/billing/planService';
import { normalizePlan } from '@/lib/auth/permissions';
import {
  buildStoredDebugContext,
  validateReportPayload,
} from '@/lib/beta/problemReports';
import { sendProblemReportEmail } from '@/lib/beta/sendProblemReportEmail';
import { rateLimitBetaReport, rateLimitHeaders } from '@/lib/rateLimit/limiter';

export const runtime = 'nodejs';

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = validateReportPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ip = clientIp(req);
    const rateKey = user?.id ?? ip;
    const rate = rateLimitBetaReport(rateKey, Boolean(user));
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many reports submitted. Please wait and try again.' },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }

    let userId: string | null = null;
    let orgId: string | null = null;
    let plan: string | null = null;
    let userEmail: string | null = null;

    if (user) {
      userId = user.id;
      userEmail = user.email ?? null;
      orgId = await getActiveOrgId(user.id);
      const userWithPlan = await getUserWithPlan(user.id, orgId, user.email);
      plan = normalizePlan(userWithPlan.plan);
    }

    const payload = validated.data;
    const debugContext = buildStoredDebugContext(payload, { userId, orgId, plan });

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from('beta_problem_reports')
      .insert({
        status: 'new',
        problem_type: payload.problemType,
        severity: payload.severity,
        message: payload.message,
        contact_email: payload.contactEmail ?? userEmail,
        can_contact: payload.canContact,
        page_url: payload.pageUrl,
        user_agent: payload.userAgent ?? null,
        viewport: payload.viewport ?? null,
        user_id: userId,
        org_id: orgId,
        plan,
        website_id: payload.websiteId ?? null,
        scan_id: payload.scanId ?? null,
        report_id: payload.reportId ?? null,
        debug_context: debugContext,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[beta/report-problem] insert failed:', error.message);
      return NextResponse.json({ error: 'Could not save report' }, { status: 500 });
    }

    if (payload.severity === 'High' || payload.severity === 'Critical') {
      void sendProblemReportEmail({
        severity: payload.severity,
        problemType: payload.problemType,
        message: payload.message,
        pageUrl: payload.pageUrl,
        contactEmail: payload.contactEmail,
        userEmail,
        plan,
        debugContext,
      }).catch((err) => {
        console.warn('[beta/report-problem] notify failed:', err);
      });
    }

    return NextResponse.json(
      { success: true, id: row.id },
      { headers: rateLimitHeaders(rate) },
    );
  } catch (err) {
    console.error('[beta/report-problem]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not save report' }, { status: 500 });
  }
}
