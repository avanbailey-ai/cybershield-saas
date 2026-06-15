import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditLogParams {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/** Fire-and-forget audit log insert. Never throws to caller. */
export function auditLog(params: AuditLogParams): void {
  void (async () => {
    try {
      const supabase = createAdminClient();
      await supabase.from('audit_logs').insert({
        org_id: params.orgId ?? null,
        user_id: params.userId ?? null,
        action: params.action,
        metadata: params.metadata ?? {},
        ip_address: params.ip ?? null,
      });
    } catch (err) {
      console.error('[audit] failed to write log', { action: params.action, err });
    }
  })();
}

export function extractIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}
