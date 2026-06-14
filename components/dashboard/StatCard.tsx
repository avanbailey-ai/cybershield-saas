import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  /** @deprecated use badge instead */
  comingSoon?: boolean;
}

export default function StatCard({
  title,
  value,
  description,
  icon,
  badge,
  trend,
  comingSoon = false,
}: StatCardProps) {
  const badgeLabel = badge ?? (comingSoon ? "Coming soon" : undefined);

  return (
    <Card className="relative">
      {badgeLabel && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {badgeLabel}
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 ring-1 ring-blue-600/20">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{description}</p>

          {trend && (
            <p
              className={`mt-2 text-xs font-medium ${
                trend.positive ? "text-green-400" : "text-red-400"
              }`}
            >
              {trend.positive ? "+" : ""}
              {trend.value} from last week
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
