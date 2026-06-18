/**
 * Data Moat — industry benchmarks from real scans only. No fabricated defaults.
 */

export interface IndustryBenchmark {
  industry: string;
  avgSecurityScore: number;
  commonVulnerabilities: string[];
  sampleSize: number;
  lastUpdated: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface SecurityTrendPoint {
  period: string;
  avgScore: number;
  criticalFindings: number;
  sslAdoptionPct: number | null;
  sampleSize: number;
}

export interface DataMoatSnapshot {
  benchmarks: IndustryBenchmark[];
  trends: SecurityTrendPoint[];
  moatStrength: 'building' | 'emerging' | 'established';
  dataPoints: number;
  scanGrowthPct: number;
  benchmarkCoverage: number;
  coverageLabel: string;
}

function benchmarkConfidence(sampleSize: number): IndustryBenchmark['confidence'] {
  if (sampleSize >= 10) return 'high';
  if (sampleSize >= 3) return 'medium';
  return 'low';
}

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
      commonVulnerabilities: [],
      sampleSize: scores.length,
      lastUpdated: new Date().toISOString(),
      confidence: benchmarkConfidence(scores.length),
    });
  }

  benchmarks.sort((a, b) => b.sampleSize - a.sampleSize);
  const dataPoints = scanScores.length;

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
      sslAdoptionPct: null,
      sampleSize: scanScores.length,
    },
  ];

  const benchmarkCoverage = benchmarks.filter((b) => b.sampleSize > 0).length;
  const coverageLabel =
    benchmarkCoverage >= 5 ? 'Broad' : benchmarkCoverage >= 2 ? 'Growing' : 'Early';

  return {
    benchmarks,
    trends,
    moatStrength,
    dataPoints,
    scanGrowthPct: 0,
    benchmarkCoverage,
    coverageLabel,
  };
}

export async function getDataMoatSnapshot(): Promise<DataMoatSnapshot> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const [scansRes, prospectsRes, prevScansRes] = await Promise.all([
    admin.from('scans').select('score').order('created_at', { ascending: false }).limit(500),
    admin.from('owner_prospects').select('industry, scan_score').not('scan_score', 'is', null),
    admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  const scanScores = (scansRes.data ?? [])
    .map((s) => s.score as number)
    .filter((s) => typeof s === 'number');

  const industryMap = new Map<string, number[]>();
  for (const p of prospectsRes.data ?? []) {
    const ind = (p.industry as string) ?? 'General';
    const score = p.scan_score as number;
    if (typeof score !== 'number') continue;
    const arr = industryMap.get(ind) ?? [];
    arr.push(score);
    industryMap.set(ind, arr);
  }

  const snapshot = buildDataMoatSnapshot(scanScores, industryMap);
  const recentCount = scanScores.length;
  const prevCount = prevScansRes.count ?? 0;
  const scanGrowthPct =
    prevCount > 0 ? Math.round(((recentCount - prevCount) / prevCount) * 100) : recentCount > 0 ? 100 : 0;

  return {
    ...snapshot,
    scanGrowthPct,
  };
}
