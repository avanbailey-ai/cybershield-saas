import type { ChangeSummary } from '@/lib/securityIntelligence/types';

interface SecurityPostureTimelineProps {
  previousScore: number | null;
  currentScore: number;
  changeSummary: ChangeSummary;
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-green-400';
  if (delta < 0) return 'text-red-400';
  return 'text-gray-400';
}

export default function SecurityPostureTimeline({
  previousScore,
  currentScore,
  changeSummary,
}: SecurityPostureTimelineProps) {
  const delta =
    changeSummary.scoreDelta ??
    (previousScore !== null ? currentScore - previousScore : null);

  const reason =
    changeSummary.highlights.length > 0
      ? changeSummary.highlights.join(' · ')
      : 'Baseline established for this website';

  return (
    <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Security Posture Timeline
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
          <p className="text-xs text-gray-500">Previous Score</p>
          <p className="mt-1 text-2xl font-bold text-gray-300">
            {previousScore !== null ? `${previousScore}/100` : '—'}
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
          <p className="text-xs text-gray-500">Current Score</p>
          <p className="mt-1 text-2xl font-bold text-white">{currentScore}/100</p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3">
          <p className="text-xs text-gray-500">Delta</p>
          <p className={`mt-1 text-2xl font-bold ${delta !== null ? deltaClass(delta) : 'text-gray-400'}`}>
            {delta !== null ? `${delta > 0 ? '+' : ''}${delta}` : '—'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-400">
        <span className="font-medium text-gray-300">Reason: </span>
        {reason}
      </p>
    </section>
  );
}
