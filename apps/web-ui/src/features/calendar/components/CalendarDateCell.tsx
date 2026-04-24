import { memo, type PointerEventHandler } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { FiFileText } from "react-icons/fi";
import { getDateTextClass } from "../utils/date";

export type CalendarPreviewBar = {
  id: string;
  label: string;
};

type CalendarDateCellProps = {
  dateKey: string;
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isRangeSelected?: boolean;
  isRangeBoundary?: boolean;
  holidayName?: string;
  previewBars: CalendarPreviewBar[];
  isAllDone: boolean;
  hasMemo: boolean;
  onClick: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
};

export const CalendarDateCell = memo(function CalendarDateCell({
  dateKey,
  date,
  inCurrentMonth,
  isToday,
  isSelected,
  isRangeSelected = false,
  isRangeBoundary = false,
  holidayName,
  previewBars,
  isAllDone,
  hasMemo,
  onClick,
  onPointerDown,
}: CalendarDateCellProps) {
  const dateTextClass = getDateTextClass(date, inCurrentMonth, Boolean(holidayName));
  const maxBars = isSelected ? 6 : 3;
  const visibleBars = previewBars.slice(0, maxBars);
  const hasMoreBars = previewBars.length > maxBars;
  const selectedCellClass = isSelected
    ? "z-10 border-primary/90 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]"
    : "";
  const todayDateClass = isToday ? "relative font-semibold" : "";
  const rangeSelectedClass = isRangeSelected ? "border-primary/35 bg-primary/10" : "";
  const rangeBoundaryClass = isRangeBoundary ? "border-primary/75 bg-primary/16" : "";
  const outOfMonthCellClass = inCurrentMonth
    ? "bg-base-100"
    : "bg-base-200/90 border-base-300/40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]";

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      data-calendar-date-key={dateKey}
      data-calendar-current-month={inCurrentMonth ? "true" : "false"}
      className={[
        "calendar-date-cell relative z-0 flex h-full flex-col gap-0.5 rounded-[9px] border border-transparent px-1.5 pt-1 pb-1 text-left transition-[border-color,box-shadow] duration-220 ease-out",
        outOfMonthCellClass,
        rangeSelectedClass,
        rangeBoundaryClass,
        selectedCellClass,
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
            todayDateClass,
          ].join(" ")}
        >
          {date.getDate()}
          {isToday ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-[3px] left-0 right-0 mx-auto h-[2px] w-[0.95rem] rounded-full bg-primary/80"
            />
          ) : null}
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
