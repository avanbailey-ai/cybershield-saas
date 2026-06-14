import { createAdminClient } from './supabase/admin';

// Reads historical scan data to compute finding frequencies.
// Returns adjusted weight multipliers (capped: never more than 1.3x, never less than 0.7x).
export async function getAdjustedWeights(): Promise<Record<string, number>> {
  try {
    const supabase = createAdminClient();

    const { data: scans } = await supabase
      .from('scans')
      .select('findings')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100);

    if (!scans || scans.length < 10) {
      return {};
    }

    const findingCounts: Record<string, number> = {};
    for (const scan of scans) {
      const findings = (scan.findings || []) as string[];
      for (const f of findings) {
        const lower = f.toLowerCase();
        if (lower.includes('csp')) findingCounts['csp'] = (findingCounts['csp'] || 0) + 1;
        if (lower.includes('hsts')) findingCounts['hsts'] = (findingCounts['hsts'] || 0) + 1;
        if (lower.includes('https') || lower.includes('ssl') || lower.includes('tls')) {
          findingCounts['ssl'] = (findingCounts['ssl'] || 0) + 1;
        }
        if (lower.includes('server') || lower.includes('powered')) {
          findingCounts['exposure'] = (findingCounts['exposure'] || 0) + 1;
        }
      }
    }

    const total = scans.length;
    const weights: Record<string, number> = {};

    for (const [key, count] of Object.entries(findingCounts)) {
      const freq = count / total;
      if (freq > 0.4) {
        weights[key] = Math.min(1.3, 1 + (freq - 0.4) * 0.5);
      } else if (freq < 0.1) {
        weights[key] = Math.max(0.7, 1 - (0.1 - freq) * 2);
      } else {
        weights[key] = 1.0;
      }
    }

    return weights;
  } catch {
    return {};
  }
}

// Placeholder for future learning data recording.
// Findings are already stored in the scans table.
export async function recordScanFindings(_scanId: string, _findings: string[]): Promise<void> {
  // no-op
}
