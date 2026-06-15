export type DomainEvent =
  | { type: 'scanCreated'; payload: { scanId: string; websiteId: string; userId: string } }
  | {
      type: 'scanCompleted';
      payload: { scanId: string; websiteId: string; userId: string; score: number; riskLevel: string };
    }
  | { type: 'usageLimitReached'; payload: { userId: string; resource: string } }
  | { type: 'userUpgraded'; payload: { userId: string; fromPlan: string; toPlan: string } };
