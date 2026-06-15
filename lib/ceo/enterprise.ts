/**
 * Enterprise pipeline monitoring — leads, demos, closed deals.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface EnterprisePipelineMetrics {
  leadsCreated: number;
  demosBooked: number;
  demosCompleted: number;
  pipelineClosed: number;
  qualifiedLeads: number;
  bottleneck: string | null;
}

export async function getEnterpriseMetrics(
  since: Date,
  until?: Date,
): Promise<EnterprisePipelineMetrics> {
  const admin = createAdminClient();
  const untilIso = until?.toISOString() ?? new Date().toISOString();
  const sinceIso = since.toISOString();

  const [leadsRes, demosRes, pipelineRes] = await Promise.all([
    admin
      .from('enterprise_leads')
      .select('status')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    admin
      .from('enterprise_demos')
      .select('status')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    admin
      .from('enterprise_pipeline')
      .select('stage')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
  ]);

  const leads = leadsRes.data ?? [];
  const demos = demosRes.data ?? [];
  const pipeline = pipelineRes.data ?? [];

  const leadsCreated = leads.length;
  const demosBooked = demos.filter((d) => d.status === 'scheduled' || d.status === 'completed').length;
  const demosCompleted = demos.filter((d) => d.status === 'completed').length;
  const pipelineClosed = pipeline.filter((p) => p.stage === 'closed').length;
  const qualifiedLeads = leads.filter((l) => l.status === 'qualified' || l.status === 'closed').length;

  let bottleneck: string | null = null;
  if (leadsCreated > 5 && demosBooked === 0) {
    bottleneck = 'leads_without_demos';
  } else if (demosBooked > 3 && demosCompleted < demosBooked * 0.5) {
    bottleneck = 'demo_no_show';
  } else if (qualifiedLeads > 2 && pipelineClosed === 0) {
    bottleneck = 'qualified_not_closing';
  }

  return {
    leadsCreated,
    demosBooked,
    demosCompleted,
    pipelineClosed,
    qualifiedLeads,
    bottleneck,
  };
}
