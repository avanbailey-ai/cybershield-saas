export type SocialPlatform = 'linkedin' | 'facebook' | 'x' | 'tiktok' | 'youtube_shorts' | 'threads';

export interface SocialContentInput {
  topic: string;
  audience?: string;
  keyPoints?: string[];
  cta?: string;
}

const PLATFORM_GENERATORS: Record<SocialPlatform, (input: SocialContentInput) => string> = {
  linkedin: (i) => `🔒 ${i.topic}

${(i.keyPoints ?? ['Security is a growth lever, not a cost center']).map((p) => `→ ${p}`).join('\n')}

Most ${i.audience ?? 'SMB owners'} don't know their website score until it's too late.

CyberShield makes continuous monitoring accessible.

${i.cta ?? 'Comment "AUDIT" for a free scan link.'}

#cybersecurity #websitesecurity #SMB`,

  facebook: (i) => `Is your website actually secure? 🤔

${i.topic}

Here's what we see every day:
${(i.keyPoints ?? ['Missing security headers', 'SSL issues', 'No monitoring']).map((p) => `• ${p}`).join('\n')}

${i.cta ?? 'Try a free scan at CyberShield — link in comments.'}`,

  x: (i) => `${i.topic}

${(i.keyPoints ?? ['Scan → Fix → Monitor']).join(' | ')}

${i.cta ?? 'Free security scan → CyberShield'}

#InfoSec #WebSecurity`,

  tiktok: (i) => `[HOOK - 0-3s]
"Your website might be failing security right now"

[BODY - 3-25s]
${i.topic}
${(i.keyPoints ?? ['Run a free scan', 'See your score in 60 seconds', 'Fix the top 3 issues']).map((p, idx) => `Point ${idx + 1}: ${p}`).join('\n')}

[CTA - 25-30s]
${i.cta ?? 'Link in bio — CyberShield free scan'}`,

  youtube_shorts: (i) => `TITLE: ${i.topic} (60 sec)

[0:00] Hook: "Stop guessing if your site is secure"
[0:05] Problem: ${(i.keyPoints ?? ['Most sites fail basic checks'])[0]}
[0:15] Demo: Quick scan walkthrough
[0:35] Insight: What the score means
[0:50] CTA: ${i.cta ?? 'Free scan at CyberShield — link below'}

B-ROLL: Dashboard, scan results, alert notification`,

  threads: (i) => `${i.topic}

Thread 🧵

1/ ${(i.keyPoints ?? ['Security headers matter'])[0]}
2/ Most businesses only check once a year
3/ Continuous monitoring catches drift before customers do
4/ ${i.cta ?? 'CyberShield — free scan to start'}`,
};

export function generateSocialContent(
  platform: SocialPlatform,
  input: SocialContentInput,
): string {
  return PLATFORM_GENERATORS[platform](input);
}

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'tiktok', label: 'TikTok Script' },
  { id: 'youtube_shorts', label: 'YouTube Shorts' },
  { id: 'threads', label: 'Threads' },
];
