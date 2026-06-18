export interface ContentSuggestion {
  id: string;
  platform: string;
  title: string;
  hook: string;
  angle: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ContentIntelInput {
  commonFindings: { finding: string; count: number }[];
  avgRiskScore: number;
  hotProspects?: number;
  totalScans?: number;
}

const MIN_FINDING_COUNT = 3;
const MIN_SCANS_FOR_SCORE_POST = 10;

export function generateContentSuggestions(input: ContentIntelInput): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  const topFinding = input.commonFindings[0];
  const totalScans = input.totalScans ?? 0;

  if (!topFinding || topFinding.count < MIN_FINDING_COUNT || totalScans < MIN_FINDING_COUNT) {
    return [];
  }

  const pct =
    totalScans > 0 ? Math.round((topFinding.count / totalScans) * 100) : topFinding.count;

  suggestions.push({
    id: 'finding-linkedin',
    platform: 'LinkedIn',
    title: `${pct}% of recent scans: ${topFinding.finding.slice(0, 50)}…`,
    hook: `From ${totalScans} CyberShield scans: ${topFinding.count} sites had this issue.`,
    angle: 'Data-driven post from your platform scan history',
    priority: 'high',
  });

  suggestions.push({
    id: 'finding-x',
    platform: 'X',
    title: `Thread: ${topFinding.finding.slice(0, 40)}…`,
    hook: `${topFinding.count} of ${totalScans} scanned sites affected (your data).`,
    angle: 'Short thread with fix tips',
    priority: 'high',
  });

  suggestions.push({
    id: 'finding-tiktok',
    platform: 'TikTok',
    title: 'POV: This check failed on a client site',
    hook: `Show real finding: ${topFinding.finding.slice(0, 50)}`,
    angle: '15s screen-record from a scan report',
    priority: 'medium',
  });

  if (input.avgRiskScore > 0 && totalScans >= MIN_SCANS_FOR_SCORE_POST) {
    suggestions.push({
      id: 'score-linkedin',
      platform: 'LinkedIn',
      title: `Your scanned sites average ${input.avgRiskScore}/100`,
      hook: `Based on ${totalScans} scans in your platform — not industry estimates.`,
      angle: 'Educational post with real aggregate score',
      priority: 'medium',
    });
  }

  if ((input.hotProspects ?? 0) > 0) {
    suggestions.push({
      id: 'outbound-proof',
      platform: 'LinkedIn',
      title: `${input.hotProspects} HOT prospects in your pipeline`,
      hook: 'Real prospects from Founder OS scans — social proof for outbound.',
      angle: 'Founder credibility post',
      priority: 'low',
    });
  }

  return suggestions;
}
