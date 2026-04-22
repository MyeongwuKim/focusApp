import { useEffect, useMemo, useRef, useState } from "react";
import { toast, useAppStore } from "../../../stores";
import { buildCalendarCells, shiftMonth } from "../../../utils/calendar";
import { formatDateKey } from "../../../utils/holidays";
import useHolidaysByViewMonth from "../queries/useHolidaysByViewMonth";
import { CalendarDateCell, type CalendarPreviewBar } from "./CalendarDateCell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type TouchPoint = {
  x: number;
  y: number;
};

type SwipeAxis = "horizontal" | "vertical" | null;

type CalendarPageProps = {
  logsByDate: Record<
    string,
    {
      todoCount: number;
      doneCount: number;
      allDone: boolean;
      hasMemo: boolean;
      previewBars: CalendarPreviewBar[];
    }
  >;
  onRequestOpenDateTasksSheet: () => void;
};

function getSelectedRowIndex(cells: ReturnType<typeof buildCalendarCells>, selectedDateKey: string | null) {
  if (!selectedDateKey) {
    return null;
  }

  const foundIndex = cells.findIndex((cell) => cell.inCurrentMonth && formatDateKey(cell.date) === selectedDateKey);
  if (foundIndex < 0) {
    return null;
  }

  return Math.floor(foundIndex / 7);
}

function buildRowTemplate(selectedRowIndex: number | null) {
  if (selectedRowIndex === null) {
    return "1fr 1fr 1fr 1fr 1fr 1fr";
  }

  // 합계를 6fr로 유지해서 전체 높이는 고정, 선택된 행만 강조
  const rows = [0, 1, 2, 3, 4, 5].map((rowIndex) => (rowIndex === selectedRowIndex ? 1.35 : 0.93));
  return rows.map((value) => `${value}fr`).join(" ");
}

export function CalendarPage({
  logsByDate,
  onRequestOpenDateTasksSheet,
}: CalendarPageProps) {
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const { holidaysByDate, hasError: hasHolidayError } = useHolidaysByViewMonth(viewMonth);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);
  const holidayErrorNotifiedRef = useRef(false);

  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [isReleasing, setIsReleasing] = useState(false);

  const prevMonth = useMemo(() => shiftMonth(viewMonth, -1), [viewMonth]);
  const nextMonth = useMemo(() => shiftMonth(viewMonth, 1), [viewMonth]);
  const todayDateKey = formatDateKey(new Date());

  const prevCells = useMemo(() => buildCalendarCells(prevMonth), [prevMonth]);
  const currentCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);
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
      setViewMonth(nextMonth);
    } else if (settleDirection === 1) {
      setViewMonth(prevMonth);
    }

    setSettleDirection(0);
    setIsReleasing(false);
    setDragX(0);
  };

  useEffect(() => {
    if (!hasHolidayError || holidayErrorNotifiedRef.current) {
      return;
    }
    holidayErrorNotifiedRef.current = true;
    toast.error("공휴일 데이터를 가져오지 못했어요.", "불러오기 실패");
  }, [hasHolidayError]);

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
                <div
                  className="grid h-full grid-cols-7 gap-1 transition-[grid-template-rows] duration-220 ease-out"
                  style={{
                    gridTemplateRows: buildRowTemplate(getSelectedRowIndex(cells, selectedDateKey)),
                  }}
                >
                  {cells.map((cell) => {
                    const dateKey = formatDateKey(cell.date);
                    const previewBars = cell.inCurrentMonth ? logsByDate[dateKey]?.previewBars ?? [] : [];
                    const isAllDone = cell.inCurrentMonth ? (logsByDate[dateKey]?.allDone ?? false) : false;
                    const hasMemo = cell.inCurrentMonth ? (logsByDate[dateKey]?.hasMemo ?? false) : false;
                    const isSelected = selectedDateKey === dateKey;
                    const isToday = dateKey === todayDateKey;
                    const holidayName = holidaysByDate[formatDateKey(cell.date)];
                    return (
                      <CalendarDateCell
                        key={cell.date.toISOString()}
                        date={cell.date}
                        inCurrentMonth={cell.inCurrentMonth}
                        isToday={isToday}
                        isSelected={isSelected}
                        holidayName={holidayName}
                        previewBars={previewBars}
                        isAllDone={isAllDone}
                        hasMemo={hasMemo}
                        onClick={() => {
                          if (selectedDateKey === dateKey) {
                            onRequestOpenDateTasksSheet();
                            return;
                          }

                          setSelectedDateKey(dateKey);
                        }}
                      />
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
