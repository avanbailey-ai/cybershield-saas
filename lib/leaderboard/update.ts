import { createAdminClient } from '@/lib/supabase/admin';
import { extractDomain } from '@/lib/ai/storeReport';
import { resolveScannedDomainLabel } from '@/lib/conversion/displayDomain';

export function displayLeaderboardDomain(
  domain: string | null | undefined,
  scannedDomain?: string | null,
  fallback = 'this website',
): string {
  const label = resolveScannedDomainLabel(
    {
      normalizedDomain: domain,
      submittedDomain: scannedDomain,
      url: scannedDomain ?? domain,
    },
    fallback,
  );

  if (label === fallback) return label;
  return maskDomain(label);
}

export function maskDomain(domain: string): string {
  const clean = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const dotIdx = clean.indexOf('.');
  if (dotIdx <= 0) return clean;

  const name = clean.slice(0, dotIdx);
  const tld = clean.slice(dotIdx + 1);

  if (name.length <= 3) {
    return `${name[0] ?? '*'}***.${tld}`;
  }
  return `${name.slice(0, 3)}***${name[name.length - 1]}.${tld}`;
}

export async function updateLeaderboard(urlOrDomain: string, score: number): Promise<void> {
  const domain = extractDomain(urlOrDomain);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('leaderboard_entries')
    .select('id, best_score, scan_count, improvement_delta')
    .eq('domain', domain)
    .maybeSingle();

  if (existing) {
    const previousBest = existing.best_score;
    const newBest = Math.max(previousBest, score);
    const deltaGain = score > previousBest ? score - previousBest : 0;

    await supabase
      .from('leaderboard_entries')
      .update({
        best_score: newBest,
        improvement_delta: (existing.improvement_delta ?? 0) + deltaGain,
        scan_count: existing.scan_count + 1,
        last_scanned_at: now,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('leaderboard_entries').insert({
      domain,
      best_score: score,
      improvement_delta: 0,
      scan_count: 1,
      last_scanned_at: now,
    });
  }

  console.log(`[leaderboard] Updated domain=${domain} score=${score}`);
}
