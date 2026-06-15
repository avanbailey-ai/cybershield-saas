export type ExperimentVariant = "a" | "b";

export interface ExperimentRow {
  id: string;
  name: string;
  variant_a: Record<string, unknown>;
  variant_b: Record<string, unknown>;
  traffic_split: number;
  conversions_a: number;
  impressions_a: number;
  conversions_b: number;
  impressions_b: number;
  winner: ExperimentVariant | null;
  active: boolean;
}

function hashSessionToUnit(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash << 5) - hash + sessionId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) / 2147483647;
}

export function getVariantFromSplit(
  sessionId: string,
  trafficSplit: number,
  winner: ExperimentVariant | null,
  active: boolean,
): ExperimentVariant {
  if (!active && winner) return winner;
  return hashSessionToUnit(sessionId) < trafficSplit ? "a" : "b";
}

export function getVariantClient(
  experimentName: string,
  sessionId: string,
  exp: Pick<
    ExperimentRow,
    "traffic_split" | "winner" | "active" | "variant_a" | "variant_b"
  >,
): { variant: ExperimentVariant; config: Record<string, unknown> } {
  void experimentName;
  const variant = getVariantFromSplit(
    sessionId,
    Number(exp.traffic_split),
    exp.winner,
    exp.active,
  );
  return {
    variant,
    config: variant === "a" ? exp.variant_a : exp.variant_b,
  };
}
