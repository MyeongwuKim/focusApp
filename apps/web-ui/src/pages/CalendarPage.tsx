import { useMemo, useRef, useState } from "react";
import { buildCalendarCells, isSameDate, shiftMonth } from "../utils/calendar";
import { formatDateKey, type HolidaysByDate } from "../utils/holidays";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type TouchPoint = {
  x: number;
  y: number;
};

type SwipeAxis = "horizontal" | "vertical" | null;

type CalendarPageProps = {
  month: Date;
  onMonthChange: (nextMonth: Date) => void;
  holidaysByDate: HolidaysByDate;
};

type PreviewBar = {
  id: string;
  label: string;
};

const MOCK_TASKS = [
  "리액트공부",
  "운동하기",
  "알고리즘 문제풀기",
  "영어 단어 암기",
  "프로젝트 문서정리",
  "타입스크립트 복습",
  "블로그 글 작성",
  "독서 30분",
];

function getPreviewBars(date: Date): PreviewBar[] {
  const seed = (date.getDate() * 17 + (date.getMonth() + 1) * 11) % 7;
  const filledCount = Math.min(5, seed);

  return Array.from({ length: filledCount }, (_, index) => ({
    id: `${date.toISOString()}-${index}`,
    label: MOCK_TASKS[(date.getDate() + index) % MOCK_TASKS.length],
  }));
}

function getDateTextClass(date: Date, isCurrentMonth: boolean, isHoliday: boolean) {
  if (isHoliday) {
    return isCurrentMonth ? "text-error" : "text-error/50";
  }

  const day = date.getDay();
  if (day === 0) {
    return isCurrentMonth ? "text-error" : "text-error/50";
  }
  if (day === 6) {
    return isCurrentMonth ? "text-info" : "text-info/50";
  }
  return isCurrentMonth ? "text-base-content" : "text-base-content/35";
}

export function CalendarPage({ month, onMonthChange, holidaysByDate }: CalendarPageProps) {
  const today = new Date();
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);

  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [isReleasing, setIsReleasing] = useState(false);

  const prevMonth = useMemo(() => shiftMonth(month, -1), [month]);
  const nextMonth = useMemo(() => shiftMonth(month, 1), [month]);

  const prevCells = useMemo(() => buildCalendarCells(prevMonth), [prevMonth]);
  const currentCells = useMemo(() => buildCalendarCells(month), [month]);
  const nextCells = useMemo(() => buildCalendarCells(nextMonth), [nextMonth]);

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (isReleasing) {
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeAxisRef.current = null;
    setDragX(0);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    if (!start || isReleasing) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (!swipeAxisRef.current) {
      const axisThreshold = 8;
      if (Math.abs(deltaX) < axisThreshold && Math.abs(deltaY) < axisThreshold) {
        return;
      }
      swipeAxisRef.current =
        Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (swipeAxisRef.current === "horizontal") {
      event.preventDefault();
      setDragX(deltaX);
    }
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    if (!start || isReleasing) {
      return;
    }

    if (swipeAxisRef.current !== "horizontal") {
      touchStartRef.current = null;
      swipeAxisRef.current = null;
      setDragX(0);
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const minSwipeDistance = 64;
    const canChangeMonth = Math.abs(deltaX) > minSwipeDistance;

    setSettleDirection(canChangeMonth ? (deltaX < 0 ? -1 : 1) : 0);
    setIsReleasing(true);
    setDragX(0);

    touchStartRef.current = null;
    swipeAxisRef.current = null;
  };

  const handleTrackTransitionEnd = () => {
    if (!isReleasing) {
      return;
    }

    if (settleDirection === -1) {
      onMonthChange(nextMonth);
    } else if (settleDirection === 1) {
      onMonthChange(prevMonth);
    }

    setSettleDirection(0);
    setIsReleasing(false);
    setDragX(0);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex min-h-0 flex-1 select-none flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mb-1 grid grid-cols-7 gap-0 text-center text-[11px] font-semibold text-base-content/55">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-1.5">
              {weekday}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden rounded-2xl border border-base-300/80 bg-base-200/40 p-1">
          <div
            className={`flex h-full w-[300%] ${isReleasing ? "transition-transform duration-300 ease-out" : ""}`}
            style={{
              transform: `translateX(calc(${-33.3333 + settleDirection * 33.3333}% + ${dragX}px))`,
            }}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {[prevCells, currentCells, nextCells].map((cells, monthIndex) => (
              <div key={monthIndex} className="h-full w-1/3 shrink-0">
                <div className="grid h-full grid-cols-7 grid-rows-6 gap-1">
                  {cells.map((cell) => {
                    const isToday = isSameDate(cell.date, today);
                    const previewBars = cell.inCurrentMonth ? getPreviewBars(cell.date) : [];
                    const dateKey = formatDateKey(cell.date);
                    const isSelected = selectedDateKey === dateKey;
                    const isActive = isSelected || (selectedDateKey === null && isToday);
                    const holidayName = holidaysByDate[formatDateKey(cell.date)];
                    const dateTextClass = getDateTextClass(
                      cell.date,
                      cell.inCurrentMonth,
                      Boolean(holidayName)
                    );
                    const visibleBars = previewBars.slice(0, 3);
                    const hasMoreBars = previewBars.length > 3;
                    return (
                      <button
                        key={cell.date.toISOString()}
                        type="button"
                        onClick={() => {
                          setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey));
                        }}
                        className={[
                          "flex h-full min-h-[5.15rem] flex-col gap-0.5 rounded-[9px] border border-transparent px-1.5 pt-1 pb-1 text-left transition",
                          cell.inCurrentMonth
                            ? "bg-base-100"
                            : "bg-base-200/65",
                          isActive
                            ? "border-primary/90 bg-primary/14 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]"
                            : "",
                          isToday
                            ? "font-semibold"
                            : "",
                        ].join(" ")}
                      >
                        <div className="h-[1rem]">
                          <div className={["text-[0.95rem] leading-none", dateTextClass].join(" ")}>
                            {cell.date.getDate()}
                          </div>
                        </div>

                        <div className="h-[0.55rem]">
                          {holidayName ? (
                            <div className="truncate text-[9px] leading-none text-error/90">
                              {holidayName}
                            </div>
                          ) : null}
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
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
