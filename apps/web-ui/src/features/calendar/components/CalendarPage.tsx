import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast, useAppStore } from "../../../stores";
import { useHorizontalSwipeGesture } from "../../../hooks/useHorizontalSwipeGesture";
import { buildCalendarCells, shiftMonth } from "../../../utils/calendar";
import { formatDateKey } from "../../../utils/holidays";
import useHolidaysByViewMonth from "../queries/useHolidaysByViewMonth";
import { CalendarDateCell, type CalendarPreviewBar } from "./CalendarDateCell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CalendarRangeDraft = {
  anchor: string;
  focus: string;
};

type CalendarRangePopup = {
  x: number;
  y: number;
  start: string;
  end: string;
};

type CalendarRangePointerSession = {
  pointerId: number;
  anchorDateKey: string;
  startX: number;
  startY: number;
  active: boolean;
};

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

const RANGE_LONG_PRESS_MS = 420;
const RANGE_LONG_PRESS_MOVE_CANCEL_PX = 14;

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

function normalizeDateRange(first: string, second: string) {
  return first <= second ? { start: first, end: second } : { start: second, end: first };
}

function isDateWithinRange(dateKey: string, start: string, end: string) {
  return dateKey >= start && dateKey <= end;
}

function formatDateRangeKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) {
    return dateKey;
  }
  return `${year}.${month}.${day}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toMonthPanelKey(month: Date) {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
}

export function CalendarPage({
  logsByDate,
  onRequestOpenDateTasksSheet,
}: CalendarPageProps) {
  const navigate = useNavigate();
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const { holidaysByDate, hasError: hasHolidayError } = useHolidaysByViewMonth(viewMonth);
  const holidayErrorNotifiedRef = useRef(false);

  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [isReleasing, setIsReleasing] = useState(false);
  const [suppressRowTemplateTransition, setSuppressRowTemplateTransition] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<CalendarRangeDraft | null>(null);
  const [rangePopup, setRangePopup] = useState<CalendarRangePopup | null>(null);
  const rangePointerSessionRef = useRef<CalendarRangePointerSession | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const rangeDraftRef = useRef<CalendarRangeDraft | null>(null);
  const ignoreNextDateClickRef = useRef(false);
  const rangePopupRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectedDateKeyRef = useRef<string | null>(null);
  const restoreRowTransitionRafRef = useRef<number | null>(null);

  const prevMonth = useMemo(() => shiftMonth(viewMonth, -1), [viewMonth]);
  const nextMonth = useMemo(() => shiftMonth(viewMonth, 1), [viewMonth]);
  const todayDateKey = formatDateKey(new Date());
  const rangeBounds = useMemo(() => {
    if (!rangeDraft) {
      return null;
    }
    return normalizeDateRange(rangeDraft.anchor, rangeDraft.focus);
  }, [rangeDraft]);
  const isRangeSelectionMode = Boolean(rangeDraft);
  const rangePopupStyle = useMemo(() => {
    if (!rangePopup) {
      return null;
    }
    if (typeof window === "undefined") {
      return {
        left: `${rangePopup.x}px`,
        top: `${rangePopup.y}px`,
      };
    }
    const popupWidth = 206;
    const popupHeight = 116;
    const left = clampNumber(
      rangePopup.x,
      popupWidth / 2 + 14,
      window.innerWidth - popupWidth / 2 - 14
    );
    const top = clampNumber(rangePopup.y - 14, 74, window.innerHeight - popupHeight - 12);
    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  }, [rangePopup]);

  const prevCells = useMemo(() => buildCalendarCells(prevMonth), [prevMonth]);
  const currentCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);
  const nextCells = useMemo(() => buildCalendarCells(nextMonth), [nextMonth]);
  const isMonthSwipeActive = isReleasing || Math.abs(dragX) > 0;
  const calendarPanels = useMemo(() => {
    const panelInputs = [
      { month: prevMonth, cells: prevCells },
      { month: viewMonth, cells: currentCells },
      { month: nextMonth, cells: nextCells },
    ];
    const baseTemplate = buildRowTemplate(null);
    const currentMonthTemplate = buildRowTemplate(getSelectedRowIndex(currentCells, selectedDateKey));

    return panelInputs.map(({ month, cells }, panelIndex) => {
      if (isMonthSwipeActive) {
        return {
          key: toMonthPanelKey(month),
          cells,
          // 스와이프 중에는 현재 달(가운데)만 선택 행 확장, 좌우 달은 기본 높이 유지
          rowTemplate: panelIndex === 1 ? currentMonthTemplate : baseTemplate,
        };
      }

      return {
        key: toMonthPanelKey(month),
        cells,
        rowTemplate: buildRowTemplate(getSelectedRowIndex(cells, selectedDateKey)),
      };
    });
  }, [currentCells, isMonthSwipeActive, nextCells, nextMonth, prevCells, prevMonth, selectedDateKey, viewMonth]);
  const {
    handleTouchStart: handleMonthSwipeTouchStart,
    handleTouchMove: handleMonthSwipeTouchMove,
    handleTouchEnd: handleMonthSwipeTouchEnd,
    handleTouchCancel: handleMonthSwipeTouchCancel,
    reset: resetMonthSwipeGesture,
  } = useHorizontalSwipeGesture({
    canStart: () => !isReleasing && !isRangeSelectionMode,
    onStart: () => {
      setDragX(0);
    },
    onHorizontalMove: ({ deltaX }) => {
      setDragX(deltaX);
    },
    onEnd: ({ axis, deltaX }) => {
      if (isRangeSelectionMode || isReleasing) {
        return;
      }

      if (axis !== "horizontal") {
        setDragX(0);
        return;
      }

      const minSwipeDistance = 64;
      const canChangeMonth = Math.abs(deltaX) > minSwipeDistance;

      setSettleDirection(canChangeMonth ? (deltaX < 0 ? -1 : 1) : 0);
      setIsReleasing(true);
      setDragX(0);
    },
    onCancel: () => {
      setDragX(0);
    },
  });

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetRangeSelectionMode = useCallback(() => {
    clearLongPressTimer();
    rangePointerSessionRef.current = null;
    setRangeDraft(null);
    setRangePopup(null);
  }, [clearLongPressTimer]);

  const getCurrentMonthDateKeyFromPoint = useCallback((x: number, y: number) => {
    if (typeof document === "undefined") {
      return null;
    }

    const target = document.elementFromPoint(x, y);
    if (!(target instanceof Element)) {
      return null;
    }

    const dateButton = target.closest<HTMLButtonElement>("[data-calendar-date-key]");
    if (!dateButton) {
      return null;
    }

    if (dateButton.dataset.calendarCurrentMonth !== "true") {
      return null;
    }

    const dateKey = dateButton.dataset.calendarDateKey;
    if (!dateKey) {
      return null;
    }

    return dateKey;
  }, []);

  const handleDateCellPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, dateKey: string, inCurrentMonth: boolean) => {
      if (!inCurrentMonth || isReleasing) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      clearLongPressTimer();
      rangePointerSessionRef.current = {
        pointerId: event.pointerId,
        anchorDateKey: dateKey,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      };
      setRangePopup(null);

      const pointerId = event.pointerId;
      longPressTimerRef.current = window.setTimeout(() => {
        const current = rangePointerSessionRef.current;
        if (!current || current.pointerId !== pointerId) {
          return;
        }
        current.active = true;
        ignoreNextDateClickRef.current = true;
        resetMonthSwipeGesture();
        setDragX(0);
        setRangeDraft({
          anchor: current.anchorDateKey,
          focus: current.anchorDateKey,
        });
      }, RANGE_LONG_PRESS_MS);
    },
    [clearLongPressTimer, isReleasing]
  );

  const handleTrackTransitionEnd = () => {
    if (!isReleasing) {
      return;
    }

    const willChangeMonth = settleDirection !== 0;
    if (willChangeMonth) {
      setSuppressRowTemplateTransition(true);
    }

    if (settleDirection === -1) {
      setViewMonth(nextMonth);
    } else if (settleDirection === 1) {
      setViewMonth(prevMonth);
    }

    if (pendingSelectedDateKeyRef.current) {
      setSelectedDateKey(pendingSelectedDateKeyRef.current);
      pendingSelectedDateKeyRef.current = null;
    }

    setSettleDirection(0);
    setIsReleasing(false);
    setDragX(0);
  };

  useEffect(() => {
    if (!suppressRowTemplateTransition) {
      return;
    }

    if (restoreRowTransitionRafRef.current !== null) {
      window.cancelAnimationFrame(restoreRowTransitionRafRef.current);
    }

    restoreRowTransitionRafRef.current = window.requestAnimationFrame(() => {
      restoreRowTransitionRafRef.current = window.requestAnimationFrame(() => {
        setSuppressRowTemplateTransition(false);
        restoreRowTransitionRafRef.current = null;
      });
    });

    return () => {
      if (restoreRowTransitionRafRef.current !== null) {
        window.cancelAnimationFrame(restoreRowTransitionRafRef.current);
        restoreRowTransitionRafRef.current = null;
      }
    };
  }, [suppressRowTemplateTransition]);

  useEffect(() => {
    if (!hasHolidayError || holidayErrorNotifiedRef.current) {
      return;
    }
    holidayErrorNotifiedRef.current = true;
    toast.error("공휴일 데이터를 가져오지 못했어요.", "불러오기 실패");
  }, [hasHolidayError]);

  useEffect(() => {
    rangeDraftRef.current = rangeDraft;
  }, [rangeDraft]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = rangePointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }

      if (!session.active) {
        const deltaX = event.clientX - session.startX;
        const deltaY = event.clientY - session.startY;
        if (Math.hypot(deltaX, deltaY) > RANGE_LONG_PRESS_MOVE_CANCEL_PX) {
          clearLongPressTimer();
          rangePointerSessionRef.current = null;
        }
        return;
      }

      ignoreNextDateClickRef.current = true;
      const hoveredDateKey = getCurrentMonthDateKeyFromPoint(event.clientX, event.clientY);
      if (!hoveredDateKey) {
        return;
      }

      setRangeDraft((prev) => {
        if (!prev || prev.focus === hoveredDateKey) {
          return prev;
        }
        return {
          anchor: prev.anchor,
          focus: hoveredDateKey,
        };
      });
    };

    const closePointerSession = (event: PointerEvent) => {
      const session = rangePointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }

      clearLongPressTimer();

      if (session.active) {
        ignoreNextDateClickRef.current = true;
        const hoveredDateKey = getCurrentMonthDateKeyFromPoint(event.clientX, event.clientY);
        const draft = rangeDraftRef.current;
        const anchor = draft?.anchor ?? session.anchorDateKey;
        const focus = hoveredDateKey ?? draft?.focus ?? session.anchorDateKey;
        const normalized = normalizeDateRange(anchor, focus);
        setRangeDraft({ anchor, focus });
        setRangePopup({
          x: event.clientX,
          y: event.clientY,
          start: normalized.start,
          end: normalized.end,
        });
      }

      rangePointerSessionRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", closePointerSession);
    window.addEventListener("pointercancel", closePointerSession);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", closePointerSession);
      window.removeEventListener("pointercancel", closePointerSession);
    };
  }, [clearLongPressTimer, getCurrentMonthDateKeyFromPoint]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!rangePopup) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rangePopupRef.current?.contains(target)) {
        return;
      }
      if ((target as Element).closest?.("[data-calendar-date-key]")) {
        return;
      }
      resetRangeSelectionMode();
    };

    window.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [rangePopup, resetRangeSelectionMode]);

  const handleOpenRangeStats = useCallback(() => {
    if (!rangePopup) {
      return;
    }
    const params = new URLSearchParams();
    params.set("preset", "7d");
    params.set("start", rangePopup.start);
    params.set("end", rangePopup.end);
    resetRangeSelectionMode();
    navigate(`/stats?${params.toString()}`);
  }, [navigate, rangePopup, resetRangeSelectionMode]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      {isRangeSelectionMode ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-info/45 bg-base-100/95 px-3 py-2 shadow-[0_14px_36px_rgba(2,6,23,0.28)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-info">날짜 범위 선택 모드</p>
                <p className="m-0 truncate text-xs text-base-content/72">통계를 낼 날짜 범위를 선택해 주세요.</p>
              </div>
              <button type="button" className="btn btn-xs btn-ghost rounded-lg" onClick={resetRangeSelectionMode}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rangePopup && rangePopupStyle ? (
        <div className="pointer-events-none fixed inset-0 z-[91]">
          <div
            ref={rangePopupRef}
            className="pointer-events-auto absolute w-[12.875rem] -translate-x-1/2 rounded-xl border border-base-300/85 bg-base-100/96 p-2 shadow-[0_16px_36px_rgba(2,6,23,0.22)] backdrop-blur"
            style={rangePopupStyle}
          >
            <p className="m-0 mb-2 text-[11px] text-base-content/66">
              {formatDateRangeKey(rangePopup.start)} ~ {formatDateRangeKey(rangePopup.end)}
            </p>
            <button type="button" className="btn btn-sm btn-primary w-full rounded-lg" onClick={handleOpenRangeStats}>
              통계 보기
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost mt-1.5 w-full rounded-lg"
              onClick={resetRangeSelectionMode}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="flex min-h-0 flex-1 select-none flex-col"
        onTouchStart={handleMonthSwipeTouchStart}
        onTouchMove={handleMonthSwipeTouchMove}
        onTouchEnd={handleMonthSwipeTouchEnd}
        onTouchCancel={handleMonthSwipeTouchCancel}
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
            {calendarPanels.map((panel) => (
              <div key={panel.key} className="h-full w-1/3 shrink-0">
                <div
                  className={`grid h-full grid-cols-7 gap-1 ${
                    suppressRowTemplateTransition
                      ? ""
                      : "transition-[grid-template-rows] duration-220 ease-out"
                  }`}
                  style={{
                    gridTemplateRows: panel.rowTemplate,
                  }}
                >
                  {panel.cells.map((cell) => {
                    const dateKey = formatDateKey(cell.date);
                    const previewBars = logsByDate[dateKey]?.previewBars ?? [];
                    const isAllDone = logsByDate[dateKey]?.allDone ?? false;
                    const hasMemo = logsByDate[dateKey]?.hasMemo ?? false;
                    const isSelected = selectedDateKey === dateKey;
                    const isToday = dateKey === todayDateKey;
                    const rangeStart = rangeBounds?.start ?? null;
                    const rangeEnd = rangeBounds?.end ?? null;
                    const isRangeSelected =
                      cell.inCurrentMonth && rangeStart && rangeEnd
                        ? isDateWithinRange(dateKey, rangeStart, rangeEnd)
                        : false;
                    const isRangeBoundary =
                      cell.inCurrentMonth && rangeStart && rangeEnd
                        ? dateKey === rangeStart || dateKey === rangeEnd
                        : false;
                    const holidayName = holidaysByDate[formatDateKey(cell.date)];
                    return (
                      <CalendarDateCell
                        key={cell.date.toISOString()}
                        dateKey={dateKey}
                        date={cell.date}
                        inCurrentMonth={cell.inCurrentMonth}
                        isToday={isToday}
                        isSelected={isSelected}
                        isRangeSelected={isRangeSelected}
                        isRangeBoundary={isRangeBoundary}
                        holidayName={holidayName}
                        previewBars={previewBars}
                        isAllDone={isAllDone}
                        hasMemo={hasMemo}
                        onPointerDown={(event) => handleDateCellPointerDown(event, dateKey, cell.inCurrentMonth)}
                        onClick={() => {
                          if (ignoreNextDateClickRef.current || isRangeSelectionMode) {
                            ignoreNextDateClickRef.current = false;
                            return;
                          }
                          if (isReleasing) {
                            return;
                          }
                          if (!cell.inCurrentMonth) {
                            const isPastMonth =
                              cell.date.getFullYear() < viewMonth.getFullYear() ||
                              (cell.date.getFullYear() === viewMonth.getFullYear() &&
                                cell.date.getMonth() < viewMonth.getMonth());
                            pendingSelectedDateKeyRef.current = dateKey;
                            setSettleDirection(isPastMonth ? 1 : -1);
                            setIsReleasing(true);
                            setDragX(0);
                            return;
                          }
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
