type MetricCardProps = {
  label: string;
  value: string | number;
  description?: string;
};

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <article className="min-h-[92px] rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <p className="text-xs text-base-content/60">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {description ? <p className="mt-1 text-[11px] leading-4 text-base-content/55">{description}</p> : null}
    </article>
  );
}
