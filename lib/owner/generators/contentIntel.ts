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
}

export function generateContentSuggestions(input: ContentIntelInput): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  const topFinding = input.commonFindings[0];

  if (topFinding) {
    suggestions.push({
      id: 'finding-linkedin',
      platform: 'LinkedIn',
      title: `"${topFinding.finding.slice(0, 60)}…" — what we see in ${topFinding.count} scans`,
      hook: `We analyzed ${topFinding.count}+ scans. The #1 issue? ${topFinding.finding.slice(0, 80)}.`,
      angle: 'Data-driven authority post with scan stats',
      priority: 'high',
    });
    suggestions.push({
      id: 'finding-x',
      platform: 'X',
      title: `Thread: Top security gap (${topFinding.count} sites affected)`,
      hook: `${topFinding.count} sites failed this check last week.`,
      angle: '3-tweet thread with fix tips',
      priority: 'high',
    });
    suggestions.push({
      id: 'finding-tiktok',
      platform: 'TikTok',
      title: 'POV: Your website is failing this check',
      hook: `Show scan result highlighting: ${topFinding.finding.slice(0, 50)}`,
      angle: '15s screen-record + text overlay',
      priority: 'medium',
    });
    suggestions.push({
      id: 'finding-youtube',
      platform: 'YouTube',
      title: `How to fix ${topFinding.finding.slice(0, 40)} in 60 seconds`,
      hook: 'Stop scrolling if you run a business website.',
      angle: 'Short tutorial with CyberShield CTA',
      priority: 'medium',
    });
  }

  if (input.avgRiskScore > 0 && input.avgRiskScore < 70) {
    suggestions.push({
      id: 'score-linkedin',
      platform: 'LinkedIn',
      title: `Average site score is ${input.avgRiskScore}/100 — here's why`,
      hook: 'Most SMB websites score below 70. Here are the 3 fastest wins.',
      angle: 'Educational carousel or list post',
      priority: 'high',
    });
  }

  if ((input.hotProspects ?? 0) > 0) {
    suggestions.push({
      id: 'outbound-proof',
      platform: 'LinkedIn',
      title: 'Case study: From vulnerable to monitored in 24h',
      hook: `${input.hotProspects} businesses in our pipeline had critical gaps last week.`,
      angle: 'Social proof + outbound credibility',
      priority: 'medium',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'default',
      platform: 'LinkedIn',
      title: 'Why continuous monitoring beats annual pen tests',
      hook: 'Security drift happens between audits.',
      angle: 'Thought leadership — run discovery to unlock data-driven posts',
      priority: 'low',
    });
  }

  return suggestions;
}
