import type { FounderOsV5Data } from '@/lib/owner/founderOsV5';

export default function AiChiefOfStaff({
  chief,
}: {
  chief: FounderOsV5Data['chiefOfStaff'];
}) {
  return (
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-violet-300">
        AI Chief of Staff
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{chief.greeting}</h2>
      <ul className="mt-4 space-y-2">
        {chief.bullets.map((b) => (
          <li key={b} className="text-sm leading-relaxed text-gray-300">
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-xs text-gray-500">Recommended focus</p>
        <p className="mt-1 text-sm font-medium text-white">{chief.focus}</p>
        {chief.upside && (
          <p className="mt-1 text-sm text-emerald-400">Potential upside: {chief.upside}</p>
        )}
      </div>
    </section>
  );
}
