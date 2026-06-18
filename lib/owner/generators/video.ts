export type VideoDuration = 15 | 30 | 60 | 90;

export interface VideoAdInput {
  product: string;
  audience: string;
  painPoint: string;
  cta: string;
  duration: VideoDuration;
}

export interface VideoAdScript {
  duration: VideoDuration;
  scenes: { timestamp: string; visual: string; voiceover: string; overlay?: string }[];
  cta: string;
  musicMood: string;
}

export function generateVideoAd(input: VideoAdInput): VideoAdScript {
  const d = input.duration;
  const scenes: VideoAdScript['scenes'] = [];

  scenes.push({
    timestamp: '0:00',
    visual: 'Close-up of browser warning / red security alert',
    voiceover: `Is ${input.audience} ignoring website security until it's too late?`,
    overlay: input.painPoint,
  });

  if (d >= 30) {
    scenes.push({
      timestamp: d >= 60 ? '0:08' : '0:05',
      visual: 'Split screen: vulnerable site vs monitored site',
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
  }

  scenes.push({
    timestamp: d >= 60 ? '0:45' : d >= 30 ? '0:20' : '0:08',
    visual: 'Logo + CTA button animation',
    voiceover: input.cta,
    overlay: input.cta,
  });

  return {
    duration: d,
    scenes,
    cta: input.cta,
    musicMood: d <= 30 ? 'Urgent, modern electronic' : 'Confident, corporate uplifting',
  };
}

export const VIDEO_DURATIONS: VideoDuration[] = [15, 30, 60, 90];
