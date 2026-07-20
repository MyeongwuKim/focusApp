import { MetricCard } from "./MetricCard";

export type StatsMetricItem = {
  label: string;
  value: string | number;
  description?: string;
};

type MetricCardGridProps = {
  items: StatsMetricItem[];
  className?: string;
};

export function MetricCardGrid({ items, className }: MetricCardGridProps) {
  return (
    <div className={className ?? "grid grid-cols-3 gap-2 md:gap-3"}>
      {items.map((item) => (
        <MetricCard key={item.label} label={item.label} value={item.value} description={item.description} />
      ))}
    </div>
  );
}
