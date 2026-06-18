export type VideoDuration = 15 | 30 | 60 | 90;

export interface VideoAdInput {
  product: string;
  audience: string;
  painPoint: string;
  cta: string;
  duration: VideoDuration;
  version?: number;
}

export interface VideoAdScript {
  duration: VideoDuration;
  version: number;
  hook: string;
  scenes: { timestamp: string; visual: string; voiceover: string; overlay?: string }[];
  cta: string;
  musicMood: string;
  variants?: string[];
}

const HOOKS = [
  (audience: string) => `Is ${audience} ignoring website security until it's too late?`,
  (audience: string) => `What if ${audience} could see security problems before customers do?`,
  (audience: string) => `Your website might be failing security checks right now.`,
  (audience: string) => `One breach costs more than a year of monitoring.`,
];

export function generateVideoAd(input: VideoAdInput): VideoAdScript {
  const d = input.duration;
  const version = input.version ?? 1;
  const hookIdx = (version - 1) % HOOKS.length;
  const hook = HOOKS[hookIdx](input.audience);
  const scenes: VideoAdScript['scenes'] = [];

  scenes.push({
    timestamp: '0:00',
    visual: version % 2 === 0 ? 'Founder at desk, concerned look at laptop' : 'Browser warning / red security alert',
    voiceover: hook,
    overlay: input.painPoint,
  });

  if (d >= 30) {
    scenes.push({
      timestamp: d >= 60 ? '0:08' : '0:05',
      visual: 'Split screen: vulnerable site vs monitored site with green score',
      voiceover: `${input.product} scans, monitors, and alerts you before customers notice problems.`,
    });
  }

  if (d >= 60) {
    scenes.push({
      timestamp: '0:25',
      visual: 'Dashboard demo — score improving, alerts resolving',
      voiceover: 'See your security score in real time. Fix issues. Stay protected.',
      overlay: 'Continuous Monitoring',
    });
    scenes.push({
      timestamp: '0:38',
      visual: 'Customer testimonial text overlay + logo wall',
      voiceover: 'Trusted by businesses who take security seriously.',
    });
  }

  if (d >= 90) {
    scenes.push({
      timestamp: '0:55',
      visual: 'Before/after scan comparison animation',
      voiceover: 'From vulnerable to protected in under 24 hours.',
      overlay: 'Real Results',
    });
  }

  scenes.push({
    timestamp: d >= 90 ? '1:15' : d >= 60 ? '0:45' : d >= 30 ? '0:20' : '0:08',
    visual: 'Logo + CTA button animation with URL',
    voiceover: input.cta,
    overlay: input.cta,
  });

  const variants = HOOKS.map((h, i) => `V${i + 1}: ${h(input.audience)}`);

  return {
    duration: d,
    version,
    hook,
    scenes,
    cta: input.cta,
    musicMood: d <= 30 ? 'Urgent, modern electronic' : 'Confident, corporate uplifting',
    variants,
  };
}

export function generateVideoAdVersions(
  input: Omit<VideoAdInput, 'version'>,
  count = 3,
): VideoAdScript[] {
  return Array.from({ length: count }, (_, i) =>
    generateVideoAd({ ...input, version: i + 1 }),
  );
}

export const VIDEO_DURATIONS: VideoDuration[] = [15, 30, 60, 90];
