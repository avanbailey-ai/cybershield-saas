export const PROBLEM_TYPES = [
  'Scan did not finish',
  'Score looks wrong',
  'Report is confusing',
  'PDF export problem',
  'Billing or plan issue',
  'Login/account issue',
  'Button/link not working',
  'Enterprise dashboard issue',
  'Other',
] as const;

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type ProblemType = (typeof PROBLEM_TYPES)[number];
export type ProblemSeverity = (typeof SEVERITY_LEVELS)[number];

export type ReportStatus = 'new' | 'reviewed' | 'resolved';

export interface SafeDebugContext {
  timestamp: string;
  referrer?: string;
  routeName?: string;
  lastError?: string;
  includeDebugContext: boolean;
}

export interface ReportProblemPayload {
  problemType: ProblemType;
  severity: ProblemSeverity;
  message: string;
  contactEmail?: string;
  canContact: boolean;
  includeDebugContext: boolean;
  pageUrl: string;
  userAgent?: string;
  viewport?: string;
  websiteId?: string;
  scanId?: string;
  reportId?: string;
  debugContext?: Record<string, unknown>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeMessage(raw: string): string {
  return raw.replace(/\0/g, '').trim().slice(0, 5000);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 320;
}

export function isOptionalUuid(value: unknown): value is string | undefined {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && UUID_RE.test(value);
}

export function validateReportPayload(body: unknown):
  | { ok: true; data: ReportProblemPayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;
  const problemType = b.problemType;
  const severity = b.severity;
  const message = sanitizeMessage(typeof b.message === 'string' ? b.message : '');

  if (!problemType || !PROBLEM_TYPES.includes(problemType as ProblemType)) {
    return { ok: false, error: 'Invalid problem type' };
  }
  if (!severity || !SEVERITY_LEVELS.includes(severity as ProblemSeverity)) {
    return { ok: false, error: 'Invalid severity' };
  }
  if (!message) {
    return { ok: false, error: 'Message is required' };
  }

  const contactEmail =
    typeof b.contactEmail === 'string' && b.contactEmail.trim()
      ? b.contactEmail.trim().toLowerCase()
      : undefined;

  if (contactEmail && !isValidEmail(contactEmail)) {
    return { ok: false, error: 'Invalid contact email' };
  }

  const pageUrl = typeof b.pageUrl === 'string' ? b.pageUrl.trim().slice(0, 2048) : '';
  if (!pageUrl) {
    return { ok: false, error: 'Page URL is required' };
  }

  const websiteId = typeof b.websiteId === 'string' ? b.websiteId : undefined;
  const scanId = typeof b.scanId === 'string' ? b.scanId : undefined;
  const reportId = typeof b.reportId === 'string' ? b.reportId : undefined;

  if (!isOptionalUuid(websiteId) || !isOptionalUuid(scanId) || !isOptionalUuid(reportId)) {
    return { ok: false, error: 'Invalid linked resource id' };
  }

  const debugContext =
    b.debugContext && typeof b.debugContext === 'object' && !Array.isArray(b.debugContext)
      ? (b.debugContext as Record<string, unknown>)
      : {};

  return {
    ok: true,
    data: {
      problemType: problemType as ProblemType,
      severity: severity as ProblemSeverity,
      message,
      contactEmail,
      canContact: Boolean(b.canContact),
      includeDebugContext: b.includeDebugContext !== false,
      pageUrl,
      userAgent: typeof b.userAgent === 'string' ? b.userAgent.slice(0, 512) : undefined,
      viewport: typeof b.viewport === 'string' ? b.viewport.slice(0, 32) : undefined,
      websiteId,
      scanId,
      reportId,
      debugContext,
    },
  };
}

export function buildStoredDebugContext(
  payload: ReportProblemPayload,
  serverContext: {
    userId?: string | null;
    orgId?: string | null;
    plan?: string | null;
  },
): Record<string, unknown> {
  if (!payload.includeDebugContext) {
    return { includeDebugContext: false };
  }

  const client = payload.debugContext ?? {};
  const safe: Record<string, unknown> = {
    includeDebugContext: true,
    timestamp: new Date().toISOString(),
    pageUrl: payload.pageUrl,
    routeName: typeof client.routeName === 'string' ? client.routeName.slice(0, 256) : undefined,
    referrer: typeof client.referrer === 'string' ? client.referrer.slice(0, 2048) : undefined,
    userAgent: payload.userAgent,
    viewport: payload.viewport,
    userId: serverContext.userId ?? null,
    orgId: serverContext.orgId ?? null,
    plan: serverContext.plan ?? null,
    websiteId: payload.websiteId ?? null,
    scanId: payload.scanId ?? null,
    reportId: payload.reportId ?? null,
    lastError:
      typeof client.lastError === 'string' ? client.lastError.slice(0, 500) : undefined,
  };

  return Object.fromEntries(Object.entries(safe).filter(([, v]) => v !== undefined));
}
