import { useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";

function formatSelectedDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

export function FooterBar() {
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const selectedDateLabel = selectedDateKey ? formatSelectedDate(selectedDateKey) : "날짜를 선택해 주세요";
  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(formatDateKey(now));
  };
  return (
    <footer className="mt-0 shrink-0 border-t border-base-300/70 bg-base-200/75 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-semibold tracking-wide text-base-content/45">선택 날짜</p>
          <p className="m-0 truncate text-sm font-medium text-base-content/85">{selectedDateLabel}</p>
        </div>
        <button
          type="button"
          className="btn h-11 min-h-11 rounded-full border-base-300 bg-base-100 px-7 text-base text-base-content shadow-sm"
          onClick={goToday}
        >
          오늘
        </button>
      </div>
    </footer>
  );
}
