import { useMemo, useRef, useState } from "react";
import { FiChevronUp } from "react-icons/fi";
import { buildCalendarCells, shiftMonth } from "../utils/calendar";
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

type DateSheetMotion = "enter" | "leave";
type DateSheetSwipeAxis = "horizontal" | "vertical" | null;

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

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseDateKey(dateKey));
}

function getTasksForDateKey(dateKey: string): string[] {
  const date = parseDateKey(dateKey);
  return getPreviewBars(date).map((bar) => bar.label);
}

function shiftDateKey(dateKey: string, days: number): string {
  const nextDate = parseDateKey(dateKey);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateKey(nextDate);
}

export function CalendarPage({ month, onMonthChange, holidaysByDate }: CalendarPageProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);
  const dateSheetTouchStartRef = useRef<TouchPoint | null>(null);
  const dateSheetSwipeAxisRef = useRef<DateSheetSwipeAxis>(null);

  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);
  const [dateSheetMotion, setDateSheetMotion] = useState<DateSheetMotion>("enter");
  const [dateSheetDragY, setDateSheetDragY] = useState(0);
  const [dateSheetDragX, setDateSheetDragX] = useState(0);
  const [isDateSheetDragging, setIsDateSheetDragging] = useState(false);
  const selectedTasks = useMemo(
    () => (selectedDateKey ? getTasksForDateKey(selectedDateKey) : []),
    [selectedDateKey]
  );

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

  const closeDateSheet = () => {
    if (!isDateSheetOpen) {
      return;
    }
    setIsDateSheetDragging(false);
    setDateSheetMotion("leave");
    setDateSheetDragY(0);
    setDateSheetDragX(0);
  };

  const handleDateSheetTransitionEnd = () => {
    if (dateSheetMotion === "leave") {
      setIsDateSheetOpen(false);
      setDateSheetMotion("enter");
      setDateSheetDragY(0);
      setDateSheetDragX(0);
    }
  };

  const handleDateSheetTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    dateSheetTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    dateSheetSwipeAxisRef.current = null;
    setIsDateSheetDragging(true);
  };

  const handleDateSheetTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = dateSheetTouchStartRef.current;
    if (!start) {
      return;
    }
    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (!dateSheetSwipeAxisRef.current) {
      const axisThreshold = 8;
      if (Math.abs(deltaX) < axisThreshold && Math.abs(deltaY) < axisThreshold) {
        return;
      }
      dateSheetSwipeAxisRef.current =
        Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (dateSheetSwipeAxisRef.current === "horizontal") {
      event.preventDefault();
      setDateSheetDragX(deltaX);
      setDateSheetDragY(0);
      return;
    }

    if (deltaY <= 0) {
      setDateSheetDragY(0);
      setDateSheetDragX(0);
      return;
    }
    event.preventDefault();
    setDateSheetDragY(deltaY);
    setDateSheetDragX(0);
  };

  const handleDateSheetTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    const closeThreshold = 84;
    const swipeThreshold = 52;
    setIsDateSheetDragging(false);
    if (dateSheetSwipeAxisRef.current === "horizontal") {
      if (Math.abs(dateSheetDragX) > swipeThreshold && selectedDateKey) {
        const nextDateKey = shiftDateKey(selectedDateKey, dateSheetDragX < 0 ? 1 : -1);
        setSelectedDateKey(nextDateKey);

        const nextDate = parseDateKey(nextDateKey);
        if (
          nextDate.getFullYear() !== month.getFullYear() ||
          nextDate.getMonth() !== month.getMonth()
        ) {
          onMonthChange(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
        }
      }
      setDateSheetDragX(0);
      setDateSheetDragY(0);
      dateSheetTouchStartRef.current = null;
      dateSheetSwipeAxisRef.current = null;
      return;
    }

    if (dateSheetDragY > closeThreshold) {
      closeDateSheet();
    } else {
      setDateSheetDragY(0);
      setDateSheetDragX(0);
    }
    dateSheetTouchStartRef.current = null;
    dateSheetSwipeAxisRef.current = null;
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
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
                    const previewBars = cell.inCurrentMonth ? getPreviewBars(cell.date) : [];
                    const dateKey = formatDateKey(cell.date);
                    const isSelected = selectedDateKey === dateKey;
                    const isActive = isSelected;
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
                          setSelectedDateKey(dateKey);
                          if (!isDateSheetOpen) {
                            setDateSheetMotion("enter");
                            setDateSheetDragY(0);
                            setIsDateSheetOpen(true);
                          }
                        }}
                        className={[
                          "flex h-full min-h-[5.15rem] flex-col gap-0.5 rounded-[9px] border border-transparent px-1.5 pt-1 pb-1 text-left transition",
                          cell.inCurrentMonth
                            ? "bg-base-100"
                            : "bg-base-200/65",
                          isActive
                            ? "border-primary/90 bg-primary/14 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]"
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
      {isDateSheetOpen && selectedDateKey ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
          <div
            className="pointer-events-auto flex h-72 flex-col rounded-t-2xl border border-base-300 bg-base-100 p-4 shadow-[0_-18px_45px_rgba(15,23,42,0.28)]"
            style={{
              transform:
                dateSheetMotion === "leave"
                  ? "translateY(112%)"
                  : `translate(${dateSheetDragX}px, ${dateSheetDragY}px)`,
              opacity: dateSheetMotion === "leave" ? 0 : 1,
              transition: isDateSheetDragging
                ? "none"
                : "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease",
            }}
            onTransitionEnd={handleDateSheetTransitionEnd}
            onTouchStart={handleDateSheetTouchStart}
            onTouchMove={handleDateSheetTouchMove}
            onTouchEnd={handleDateSheetTouchEnd}
          >
            <div className="mb-1 flex items-center justify-center text-base-content/45">
              <FiChevronUp size={18} />
            </div>
            <div className="mb-1 flex items-center justify-between">
              <p className="m-0 text-[0.95rem] font-semibold text-base-content">
                {formatDateLabel(selectedDateKey)}
              </p>
            </div>
            <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
              {selectedTasks.length > 0 ? (
                selectedTasks.map((task, index) => (
                  <div
                    key={`${selectedDateKey}-${task}-${index}`}
                    className="truncate rounded-lg border border-base-300/80 bg-base-200/50 px-2.5 py-2 text-sm text-base-content/85"
                  >
                    {task}
                  </div>
                ))
              ) : (
                <p className="m-0 text-sm text-base-content/60">이 날짜에는 할 일이 없어요.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
