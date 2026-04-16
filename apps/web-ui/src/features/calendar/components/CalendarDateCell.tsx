import { memo } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { FiFileText } from "react-icons/fi";
import { getDateTextClass } from "../utils/date";

export type CalendarPreviewBar = {
  id: string;
  label: string;
};

type CalendarDateCellProps = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  holidayName?: string;
  previewBars: CalendarPreviewBar[];
  isAllDone: boolean;
  hasMemo: boolean;
  onClick: () => void;
};

export const CalendarDateCell = memo(function CalendarDateCell({
  date,
  inCurrentMonth,
  isToday,
  isSelected,
  holidayName,
  previewBars,
  isAllDone,
  hasMemo,
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
        "calendar-date-cell relative z-0 flex h-full flex-col gap-0.5 rounded-[9px] border border-transparent px-1.5 pt-1 pb-1 text-left transition-[border-color,background-color,box-shadow] duration-220 ease-out",
        inCurrentMonth ? "bg-base-100" : "bg-base-200/65",
        isSelected ? "z-10 border-primary/90 bg-primary/14 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]" : "",
        isToday && !isSelected
          ? "border-primary/55 bg-primary/8 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.14)]"
          : "",
      ].join(" ")}
      style={{ minHeight: "var(--calendar-cell-min-h, 5.15rem)" }}
    >
      <div
        className="grid min-w-0 grid-cols-[var(--calendar-date-slot-w,2ch)_minmax(0,1fr)] items-center gap-[2px]"
        style={{ height: "var(--calendar-top-row-h, 1rem)" }}
      >
        <div
          className={[
            "calendar-date-number min-w-0 pr-[1px] leading-none tabular-nums",
            dateTextClass,
            isToday
              ? "inline-flex h-[1.18rem] min-w-[1.18rem] items-center justify-center rounded-full bg-primary px-1 text-[0.73rem] font-bold text-primary-content"
              : "",
          ].join(" ")}
        >
          {date.getDate()}
        </div>
        <div className="calendar-date-icon-wrap flex h-full min-w-0 items-center justify-center">
          {hasMemo ? (
            <span
              className="calendar-date-icon calendar-date-icon--memo inline-flex items-center justify-center rounded-full border border-info/45 bg-base-100/92 text-info shadow-sm"
              aria-label="메모 있음"
              title="메모 있음"
            >
              <FiFileText className="calendar-date-icon-svg" />
            </span>
          ) : null}
          {isAllDone ? (
            <span
              className="calendar-date-icon calendar-date-icon--done inline-flex items-center justify-center rounded-full border border-success/45 bg-base-100/92 text-success shadow-sm"
              aria-label="모든 할일 완료"
              title="모든 할일 완료"
            >
              <FiCheckCircle className="calendar-date-icon-svg" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="h-[0.55rem]">
        {holidayName ? (
          <div className="calendar-date-holiday truncate text-[9px] leading-none text-error/90">{holidayName}</div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden pt-0.5">
        {visibleBars.map((bar) => (
          <div
            key={bar.id}
            className="calendar-date-bar w-full truncate rounded-[6px] bg-primary/20 px-1.5 py-[1px] text-[10px] leading-tight text-primary"
          >
            {bar.label}
          </div>
        ))}
        {hasMoreBars ? (
          <div className="calendar-date-more w-full rounded-[6px] bg-base-300/45 px-1.5 py-[1px] text-[10px] leading-tight text-base-content/60">
            ...
          </div>
        ) : null}
      </div>

    </button>
  );
});
