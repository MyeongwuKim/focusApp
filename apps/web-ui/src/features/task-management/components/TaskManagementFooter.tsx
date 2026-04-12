import {
  useTaskManagementData,
  useTaskManagementMeta,
} from "../providers/TaskManagementContextProvider";

function formatRecentDate(value: string | null) {
  if (!value) {
    return "최근 사용 기록 없음";
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return "최근 사용 기록 없음";
  }

  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  const day = target.getDate();
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} 최근 사용`;
}

export function TaskManagementFooter() {
  const { selectedTaskId } = useTaskManagementData();
  const { selectedTaskLastUsedAt } = useTaskManagementMeta();
  const isTaskSelected = Boolean(selectedTaskId);

  return (
    <footer className="rounded-xl border border-base-300/80 bg-base-100/85 px-3 py-2.5 select-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-wide text-base-content/50">오늘할일 사용 현황</p>
          <p className="m-0 mt-0.5 min-h-[1.25rem] text-sm text-base-content/85">
            {isTaskSelected ? formatRecentDate(selectedTaskLastUsedAt) : "할일을 선택하면 사용 현황이 표시돼요."}
          </p>
        </div>
      </div>
    </footer>
  );
}
