type TaskManagementFooterProps = {
  recentAddedDateKey: string | null;
};

function formatRecentDate(dateKey: string | null) {
  if (!dateKey) {
    return "최근 기록 없음";
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return "최근 기록 없음";
  }

  const target = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(target);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} (${weekday})`;
}

export function TaskManagementFooter({ recentAddedDateKey }: TaskManagementFooterProps) {
  return (
    <footer className="rounded-xl border border-base-300/80 bg-base-100/85 px-3 py-2.5 select-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-wide text-base-content/50">
            최근 오늘할일 사용 날짜
          </p>
          <p className="m-0 mt-0.5 text-sm text-base-content/85">{formatRecentDate(recentAddedDateKey)}</p>
        </div>
      </div>
    </footer>
  );
}
