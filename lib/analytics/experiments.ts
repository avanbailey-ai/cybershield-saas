import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVariantFromSplit,
  type ExperimentRow,
  type ExperimentVariant,
} from "@/lib/analytics/experimentsClient";

export type { ExperimentRow, ExperimentVariant } from "@/lib/analytics/experimentsClient";
export { getVariantFromSplit, getVariantClient } from "@/lib/analytics/experimentsClient";

const IMPRESSION_THRESHOLD = 100;
const WINNER_LIFT = 1.1;

export async function getExperiment(name: string): Promise<ExperimentRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("experiments").select("*").eq("name", name).maybeSingle();
  return data as ExperimentRow | null;
}

export async function getVariant(
  experimentName: string,
  sessionId: string,
): Promise<{ variant: ExperimentVariant; config: Record<string, unknown> }> {
  const exp = await getExperiment(experimentName);
  if (!exp) {
    return { variant: "a", config: {} };
  }

  const variant = getVariantFromSplit(
    sessionId,
    Number(exp.traffic_split),
    exp.winner,
    exp.active,
  );
  const config = variant === "a" ? exp.variant_a : exp.variant_b;
  return { variant, config };
}

export async function recordImpression(
  experimentName: string,
  variant: ExperimentVariant,
): Promise<void> {
  const admin = createAdminClient();
  const exp = await getExperiment(experimentName);
  if (!exp) return;

  const column = variant === "a" ? "impressions_a" : "impressions_b";
  const current = variant === "a" ? exp.impressions_a : exp.impressions_b;

  await admin
    .from("experiments")
    .update({ [column]: current + 1 })
    .eq("name", experimentName);
}

export async function recordConversion(
  experimentName: string,
  variant: ExperimentVariant,
): Promise<void> {
  const admin = createAdminClient();
  const exp = await getExperiment(experimentName);
  if (!exp) return;

  const column = variant === "a" ? "conversions_a" : "conversions_b";
  const current = variant === "a" ? exp.conversions_a : exp.conversions_b;

  await admin
    .from("experiments")
    .update({ [column]: current + 1 })
    .eq("name", experimentName);

  const updated = await getExperiment(experimentName);
  if (!updated) return;

  await evaluateExperimentWinner(updated);
}

async function evaluateExperimentWinner(exp: ExperimentRow): Promise<void> {
  if (exp.winner || !exp.active) return;
  if (exp.impressions_a < IMPRESSION_THRESHOLD || exp.impressions_b < IMPRESSION_THRESHOLD) {
    return;
  }

  const rateA = exp.impressions_a > 0 ? exp.conversions_a / exp.impressions_a : 0;
  const rateB = exp.impressions_b > 0 ? exp.conversions_b / exp.impressions_b : 0;

  let winner: ExperimentVariant | null = null;
  if (rateB > rateA * WINNER_LIFT) {
    winner = "b";
  } else if (rateA > rateB * WINNER_LIFT) {
    winner = "a";
  }

  if (!winner) return;

  const admin = createAdminClient();
  await admin
    .from("experiments")
    .update({ winner, active: false })
    .eq("name", exp.name);

  const winnerConfig = winner === "a" ? exp.variant_a : exp.variant_b;
  const configKey =
    exp.name === "cta_text"
      ? "headline_variant"
      : exp.name === "paywall_timing"
        ? "paywall_delay_ms"
        : `experiment_${exp.name}`;

  const configValue =
    exp.name === "paywall_timing"
      ? winnerConfig.delay_ms ?? 2000
      : winnerConfig.text ?? "default";

  await admin.from("autopilot_config").upsert({
    key: configKey,
    value: configValue,
    updated_at: new Date().toISOString(),
  });
}
