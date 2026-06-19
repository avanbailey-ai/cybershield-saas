/**
 * Optional local AI (Ollama) — owner-only draft improvement.
 * Production must work with LOCAL_AI_ENABLED=false (default).
 */

export interface LocalAiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
}

export function getLocalAiConfig(): LocalAiConfig {
  return {
    enabled: process.env.LOCAL_AI_ENABLED === 'true',
    baseUrl: (process.env.LOCAL_AI_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, ''),
    model: process.env.LOCAL_AI_MODEL ?? 'llama3.1',
  };
}

export function isLocalAiEnabled(): boolean {
  return getLocalAiConfig().enabled;
}

export interface ImproveDraftInput {
  draft: string;
  context?: string;
}

export interface ImproveDraftResult {
  improved: string;
  source: 'local_ai' | 'deterministic_fallback';
  error?: string;
}

const DETERMINISTIC_FALLBACK_PREFIX =
  'Subject: Website monitoring follow-up\n\nHi — quick follow-up on the monitoring note I sent. ';

/** Improve outreach draft via local Ollama, or return deterministic fallback. */
export async function improveDraftWithLocalAi(
  input: ImproveDraftInput,
): Promise<ImproveDraftResult> {
  const config = getLocalAiConfig();

  if (!config.enabled) {
    return {
      improved: input.draft,
      source: 'deterministic_fallback',
    };
  }

  try {
    const prompt = [
      'Improve this business outreach email draft. Keep it calm, professional, and under 150 words.',
      'Do not use fear language (no hacked, compromised, guaranteed secure).',
      'Preserve any URLs exactly as written.',
      input.context ? `Context: ${input.context}` : '',
      '',
      'Draft:',
      input.draft,
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Local AI HTTP ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    const improved = data.response?.trim();
    if (!improved) {
      throw new Error('Empty local AI response');
    }

    return { improved, source: 'local_ai' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Local AI unavailable';
    return {
      improved: input.draft.startsWith('Subject:')
        ? input.draft
        : `${DETERMINISTIC_FALLBACK_PREFIX}${input.draft}`,
      source: 'deterministic_fallback',
      error: message,
    };
  }
}
