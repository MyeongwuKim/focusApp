import type { AchievementEventRecord } from "../../../api/achievementApi";

function formatAchievedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderHistoryMeta(event: AchievementEventRecord) {
  const parts: string[] = [];
  if (event.scope === "weekly") {
    parts.push(`${event.cycleIndex}번째 달성`);
  }
  if (event.weekKey) {
    const weekMatch = /^(\d{4})-W(\d{2})$/.exec(event.weekKey);
    parts.push(weekMatch ? `${weekMatch[1]}년 ${Number(weekMatch[2])}주차` : event.weekKey);
  }
  if (typeof event.weeklyStreak === "number" && event.weeklyStreak > 0) {
    parts.push(`연속 ${event.weeklyStreak}주`);
  }
  return parts.join(" · ");
}

type AchievementHistoryEventCardProps = {
  event: AchievementEventRecord;
};

export function AchievementHistoryEventCard({ event }: AchievementHistoryEventCardProps) {
  const historyMeta = renderHistoryMeta(event);

  return (
    <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none" aria-hidden>
          {event.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-base-content/90">{event.title}</p>
          <p className="m-0 mt-0.5 text-[11px] text-base-content/65">{event.description}</p>
          {historyMeta ? <p className="m-0 mt-1 text-[11px] text-base-content/60">{historyMeta}</p> : null}
        </div>
        <span className="shrink-0 text-right text-[10px] text-base-content/55">
          {formatAchievedAt(event.achievedAt)}
        </span>
      </div>
    </article>
  );
}
