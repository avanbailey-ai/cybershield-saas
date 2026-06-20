export type ClientReportFrequency = 'weekly' | 'monthly' | 'quarterly' | 'on_demand' | string;
export type ClientStatus = 'active' | 'paused' | 'archived' | 'needs_review' | string;

export interface WebsiteClientContext {
  client_name: string | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
  client_company: string | null;
  client_notes: string | null;
  client_report_frequency: ClientReportFrequency | null;
  client_status: ClientStatus | null;
  agency_internal_notes: string | null;
  client_group: string | null;
  label: string | null;
  url: string;
}

/** Resolve the best client-facing name for reports and portfolio views. */
export function resolveClientDisplayName(ctx: WebsiteClientContext): string {
  const name =
    ctx.client_name?.trim() ||
    ctx.client_company?.trim() ||
    ctx.client_group?.trim() ||
    ctx.label?.trim();
  if (name) return name;

  try {
    const host = new URL(ctx.url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return ctx.url;
  }
}

export function resolveClientContactName(ctx: WebsiteClientContext): string {
  return ctx.client_contact_name?.trim() || 'there';
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
  needs_review: 'Needs review',
};

export function clientStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Active';
  return CLIENT_STATUS_LABELS[status] ?? status;
}
