import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../../stores";
import { buildCalendarCells, shiftMonth } from "../../../utils/calendar";
import { formatDateKey, type HolidaysByDate } from "../../../utils/holidays";
import { getDateTextClass, parseDateKey, shiftDateKey } from "../utils/date";
import { getPreviewBars, getTasksForDateKey } from "../utils/task-preview";
import { DateSelectionSheet } from "./DateSelectionSheet";

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
  isActive: boolean;
  onOpenTasksForDate: (dateKey: string, tasks: string[]) => void;
};

export function CalendarPage({
  month,
  onMonthChange,
  holidaysByDate,
  isActive,
  onOpenTasksForDate,
}: CalendarPageProps) {
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);

  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);
  const selectedTasks = useMemo(() => {
    if (!selectedDateKey) {
      return [];
    }
    return getTasksForDateKey(selectedDateKey).map((label) => ({
      label,
      done: false,
    }));
  }, [selectedDateKey]);

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
      swipeAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
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

  useEffect(() => {
    if (!isActive) {
      setIsDateSheetOpen(false);
    }
  }, [isActive]);

  const handleShiftSelectedDate = (days: number) => {
    if (!selectedDateKey) {
      return;
    }
    const nextDateKey = shiftDateKey(selectedDateKey, days);
    setSelectedDateKey(nextDateKey);
    const nextDate = parseDateKey(nextDateKey);
    if (nextDate.getFullYear() !== month.getFullYear() || nextDate.getMonth() !== month.getMonth()) {
      onMonthChange(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  };

  const handleOpenTasksFromSheet = () => {
    if (!selectedDateKey) {
      return;
    }
    onOpenTasksForDate(
      selectedDateKey,
      selectedTasks.map((task) => task.label)
    );
    setIsDateSheetOpen(false);
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
            className={`flex h-full w-[300%] ${
              isReleasing ? "transition-transform duration-300 ease-out" : ""
            }`}
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
                          if (selectedDateKey === dateKey) {
                            setIsDateSheetOpen(true);
                            return;
                          }

                          setSelectedDateKey(dateKey);
                          if (isDateSheetOpen) {
                            setIsDateSheetOpen(false);
                          }
                        }}
                        className={[
                          "flex h-full min-h-[5.15rem] flex-col gap-0.5 rounded-[9px] border border-transparent px-1.5 pt-1 pb-1 text-left transition",
                          cell.inCurrentMonth ? "bg-base-100" : "bg-base-200/65",
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
      <DateSelectionSheet
        isOpen={isDateSheetOpen}
        selectedTasks={selectedTasks}
        onRequestClose={() => setIsDateSheetOpen(false)}
        onRequestOpenTasks={handleOpenTasksFromSheet}
        onShiftSelectedDate={handleShiftSelectedDate}
      />
    </section>
  );
}
