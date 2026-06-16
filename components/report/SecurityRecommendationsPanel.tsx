import type { SecurityRecommendation } from '@/lib/securityIntelligence/types';

interface SecurityRecommendationsPanelProps {
  recommendations: SecurityRecommendation[];
}

export default function SecurityRecommendationsPanel({
  recommendations,
}: SecurityRecommendationsPanelProps) {
  if (recommendations.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Recommendations
      </h2>
      <ol className="space-y-4">
        {recommendations.map((rec, index) => (
          <li key={rec.findingId} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">{rec.title}</h3>
                <ol className="mt-2 space-y-1.5">
                  {rec.steps.map((step, stepIndex) => (
                    <li key={step} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="mt-0.5 shrink-0 text-xs text-gray-600">
                        {stepIndex + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
