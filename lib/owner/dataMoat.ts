/**
 * Data Moat foundation — industry benchmarks and security trend aggregates.
 * Owner-only intelligence layer for competitive positioning.
 */

export interface IndustryBenchmark {
  industry: string;
  avgSecurityScore: number;
  commonVulnerabilities: string[];
  sampleSize: number;
  lastUpdated: string;
}

export interface SecurityTrendPoint {
  period: string;
  avgScore: number;
  criticalFindings: number;
  sslAdoptionPct: number;
}

export interface DataMoatSnapshot {
  benchmarks: IndustryBenchmark[];
  trends: SecurityTrendPoint[];
  moatStrength: 'building' | 'emerging' | 'established';
  dataPoints: number;
}

const DEFAULT_BENCHMARKS: IndustryBenchmark[] = [
  {
    industry: 'Healthcare',
    avgSecurityScore: 62,
    commonVulnerabilities: ['Missing HSTS', 'Weak CSP', 'Outdated SSL'],
    sampleSize: 0,
    lastUpdated: new Date().toISOString(),
  },
  {
    industry: 'Legal',
    avgSecurityScore: 68,
    commonVulnerabilities: ['No security headers', 'Mixed content'],
    sampleSize: 0,
    lastUpdated: new Date().toISOString(),
  },
  {
    industry: 'E-commerce',
    avgSecurityScore: 71,
    commonVulnerabilities: ['Third-party script risks', 'Cookie security'],
    sampleSize: 0,
    lastUpdated: new Date().toISOString(),
  },
];

export function buildDataMoatSnapshot(
  scanScores: number[],
  industryMap: Map<string, number[]>,
): DataMoatSnapshot {
  const benchmarks: IndustryBenchmark[] = [];

  for (const [industry, scores] of industryMap.entries()) {
    if (scores.length === 0) continue;
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    benchmarks.push({
      industry,
      avgSecurityScore: avg,
      commonVulnerabilities: ['Scan-derived patterns pending'],
      sampleSize: scores.length,
      lastUpdated: new Date().toISOString(),
    });
  }

  const merged = benchmarks.length > 0 ? benchmarks : DEFAULT_BENCHMARKS;
  const dataPoints = scanScores.length + benchmarks.reduce((s, b) => s + b.sampleSize, 0);

  let moatStrength: DataMoatSnapshot['moatStrength'] = 'building';
  if (dataPoints >= 100) moatStrength = 'established';
  else if (dataPoints >= 25) moatStrength = 'emerging';

  const trends: SecurityTrendPoint[] = [
    {
      period: 'Current',
      avgScore:
        scanScores.length > 0
          ? Math.round(scanScores.reduce((a, b) => a + b, 0) / scanScores.length)
          : 0,
      criticalFindings: scanScores.filter((s) => s < 50).length,
      sslAdoptionPct: 0,
    },
  ];

  return { benchmarks: merged, trends, moatStrength, dataPoints };
}

export async function getDataMoatSnapshot(): Promise<DataMoatSnapshot> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const [scansRes] = await Promise.all([
    admin.from('scans').select('score').order('created_at', { ascending: false }).limit(500),
  ]);

  const scanScores = (scansRes.data ?? [])
    .map((s) => s.score as number)
    .filter((s) => typeof s === 'number');

  const industryMap = new Map<string, number[]>();

  return buildDataMoatSnapshot(scanScores, industryMap);
}
