import { memo } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { getDateTextClass } from "../utils/date";

export type CalendarPreviewBar = {
  id: string;
  label: string;
};

type CalendarDateCellProps = {
  date: Date;
  inCurrentMonth: boolean;
  isSelected: boolean;
  holidayName?: string;
  previewBars: CalendarPreviewBar[];
  isAllDone: boolean;
  onClick: () => void;
};

export const CalendarDateCell = memo(function CalendarDateCell({
  date,
  inCurrentMonth,
  isSelected,
  holidayName,
  previewBars,
  isAllDone,
  onClick,
}: CalendarDateCellProps) {
  const dateTextClass = getDateTextClass(date, inCurrentMonth, Boolean(holidayName));
  const collapsedMaxBars = 3;
  const visibleBars = isSelected ? previewBars : previewBars.slice(0, collapsedMaxBars);
  const hasMoreBars = !isSelected && previewBars.length > collapsedMaxBars;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative z-0 flex h-full min-h-[5.15rem] flex-col gap-0.5 rounded-[9px] border border-transparent px-1.5 pt-1 pb-1 text-left transition-[border-color,background-color,box-shadow] duration-220 ease-out",
        inCurrentMonth ? "bg-base-100" : "bg-base-200/65",
        isSelected ? "z-10 border-primary/90 bg-primary/14 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]" : "",
      ].join(" ")}
    >
      <div className="flex h-[1rem] items-center justify-between">
        <div className={["text-[0.95rem] leading-none", dateTextClass].join(" ")}>{date.getDate()}</div>
        {isAllDone ? (
          <span
            className="inline-flex items-center justify-center rounded-full bg-emerald-500/15 p-[2px] text-emerald-600"
            aria-label="모든 할일 완료"
            title="모든 할일 완료"
          >
            <FiCheckCircle size={10} />
          </span>
        ) : null}
      </div>

      <div className="h-[0.55rem]">
        {holidayName ? <div className="truncate text-[9px] leading-none text-error/90">{holidayName}</div> : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden pt-0.5">
        {visibleBars.map((bar) => (
          <div
            key={bar.id}
            className="w-full truncate rounded-[6px] bg-primary/20 px-1.5 py-[1px] text-[10px] leading-tight text-primary"
          >
            {bar.label}
          </div>
        ))}
        {hasMoreBars ? (
          <div className="w-full rounded-[6px] bg-base-300/45 px-1.5 py-[1px] text-[10px] leading-tight text-base-content/60">
            ...
          </div>
        ) : null}
      </div>

    </button>
  );
});
