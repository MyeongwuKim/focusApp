import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCalendar, FiCheckCircle, FiChevronLeft, FiFileText, FiSearch } from "react-icons/fi";
import { RobotCharacter } from "../components/RobotCharacter";
import { SelectDropbox } from "../components/SelectDropbox";
import { MemoEditorPanel } from "../features/memo/containers/MemoEditorPanel";
import { useDailyLogsWithMemoQuery } from "../queries";
import { useAppStore } from "../stores";

type MemoArchiveItem = {
  id: string;
  dateKey: string;
  monthKey: string;
  memo: string | null;
  todoCount: number;
  doneCount: number;
  previewTodos: string[];
};

const LOCAL_MEMO_OVERLAY_HISTORY_KEY = "__memoArchiveLocalOverlay";

function isLocalMemoOverlayHistoryState(state: unknown) {
  return Boolean(
    state &&
      typeof state === "object" &&
      LOCAL_MEMO_OVERLAY_HISTORY_KEY in state
  );
}

function getMemoText(memo?: string | null) {
  if (!memo) {
    return "";
  }

  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(memo, "text/html");
    return (parsed.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  return memo
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMemoDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function buildYearOptions(items: MemoArchiveItem[], selectedYear: number) {
  const now = new Date();
  const recentYears = Array.from({ length: 5 }, (_, index) => now.getFullYear() - index);
  const loadedYears = items
    .map((item) => Number(item.monthKey.split("-")[0]))
    .filter((year) => Number.isFinite(year));
  return Array.from(new Set([...recentYears, ...loadedYears, selectedYear])).sort((a, b) => b - a);
}

function formatMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function MemoArchiveRoutePage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const deferredSearchQuery = deferredSearchText.trim();
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("all");
  const [dateFilterYear, setDateFilterYear] = useState(now.getFullYear());
  const [dateFilterMonth, setDateFilterMonth] = useState(now.getMonth() + 1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedMemo, setSelectedMemo] = useState<(MemoArchiveItem & { plainMemo: string }) | null>(null);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const selectedMemoRef = useRef<(MemoArchiveItem & { plainMemo: string }) | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const selectedMonthFilter = selectedMonthKey === "all" ? null : selectedMonthKey;
  const memoQuery = useDailyLogsWithMemoQuery({
    limit: 30,
    monthKey: selectedMonthFilter,
    search: deferredSearchQuery,
    sortOrder,
  });

  const memoItems = useMemo(() => {
    return (memoQuery.data?.pages.flatMap((page) => page.items) ?? [])
      .map((item) => ({
        ...item,
        plainMemo: getMemoText(item.memo),
      }))
      .filter((item) => item.plainMemo.length > 0);
  }, [memoQuery.data]);

  const yearOptions = useMemo(() => buildYearOptions(memoItems, dateFilterYear), [dateFilterYear, memoItems]);
  const hasAnyMemo = memoItems.length > 0;
  const isAllDateFilter = selectedMonthKey === "all";
  const isFilteredView = Boolean(selectedMonthFilter || deferredSearchQuery);
  const isEmptySearch = isFilteredView && !memoQuery.isLoading && memoItems.length === 0;
  const isSearchDeferred = searchText.trim() !== deferredSearchQuery;

  const applyDateFilter = (year: number, month: number) => {
    setDateFilterYear(year);
    setDateFilterMonth(month);
    setSelectedMonthKey(formatMonthKey(year, month));
  };

  useEffect(() => {
    selectedMemoRef.current = selectedMemo;
  }, [selectedMemo]);

  useEffect(() => {
    const handlePopState = () => {
      if (!selectedMemoRef.current) {
        return;
      }
      setSelectedMemo(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const target = loadMoreRef.current;
    if (!root || !target || !memoQuery.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || memoQuery.isFetchingNextPage) {
          return;
        }
        void memoQuery.fetchNextPage();
      },
      {
        root,
        rootMargin: "160px 0px",
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [memoQuery]);

  const openMemoLayer = (item: MemoArchiveItem & { plainMemo: string }) => {
    setSelectedMemo(item);

    if (typeof window === "undefined") {
      return;
    }

    const currentState = window.history.state;
    const nextState = {
      ...(currentState && typeof currentState === "object" ? currentState : {}),
      [LOCAL_MEMO_OVERLAY_HISTORY_KEY]: item.dateKey,
    };
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (isLocalMemoOverlayHistoryState(currentState)) {
      window.history.replaceState(nextState, "", currentUrl);
      return;
    }

    window.history.pushState(nextState, "", currentUrl);
  };

  const closeMemoLayer = () => {
    setSelectedMemo(null);

    if (typeof window === "undefined") {
      return;
    }

    if (isLocalMemoOverlayHistoryState(window.history.state)) {
      window.history.back();
    }
  };

  const moveToMemoDate = () => {
    if (!selectedMemo) {
      return;
    }

    const [year, month] = selectedMemo.dateKey.split("-").map(Number);
    setSelectedDateKey(selectedMemo.dateKey);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      setViewMonth(new Date(year, month - 1, 1));
    }
    setSelectedMemo(null);
    navigate(`/calendar?sheet=1&date=${encodeURIComponent(selectedMemo.dateKey)}`);
  };

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-300 bg-base-100/80 p-4">
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-base-300/80 bg-base-200/45 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-base-content/82">
              <FiFileText size={15} className="text-info" />
              <span className="truncate">메모 {memoItems.length}개</span>
            </div>
            <div className="inline-flex h-7 shrink-0 items-center rounded-full border border-base-300/80 bg-base-100 p-0.5">
              {(["desc", "asc"] as const).map((order) => (
                <button
                  key={order}
                  type="button"
                  className={[
                    "h-6 rounded-full px-2 text-[11px] font-semibold transition-colors",
                    sortOrder === order
                      ? "bg-primary/10 text-primary"
                      : "text-base-content/48 hover:text-base-content/70",
                  ].join(" ")}
                  onClick={() => setSortOrder(order)}
                >
                  {order === "desc" ? "최신순" : "오래된순"}
                </button>
              ))}
            </div>
          </div>

          <label className="flex h-10 items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 text-sm shadow-sm">
            <FiSearch size={15} className="shrink-0 text-base-content/45" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/40"
              placeholder="메모 내용 검색"
            />
          </label>

          <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-1.5">
            <div className="min-w-0">
              <SelectDropbox
                value={isAllDateFilter ? "all" : dateFilterYear}
                className="h-9 rounded-xl px-3 text-xs font-semibold text-base-content/75"
                menuClassName="max-h-48"
                options={[
                  { value: "all", label: "전체 기간" },
                  ...yearOptions.map((year) => ({
                    value: year,
                    label: `${year}년`,
                  })),
                ]}
                onValueChange={(nextValue) => {
                  if (nextValue === "all") {
                    setSelectedMonthKey("all");
                    return;
                  }
                  applyDateFilter(Number(nextValue), dateFilterMonth);
                }}
              />
            </div>
            <div className="min-w-0">
              <SelectDropbox
                value={isAllDateFilter ? null : dateFilterMonth}
                className="h-9 rounded-xl px-3 text-xs font-semibold text-base-content/75"
                menuClassName="max-h-48"
                disabled={isAllDateFilter}
                placeholder="월 선택"
                options={Array.from({ length: 12 }, (_, index) => {
                  const month = index + 1;
                  return {
                    value: month,
                    label: `${month}월`,
                  };
                })}
                onValueChange={(nextMonth) => {
                  applyDateFilter(dateFilterYear, Number(nextMonth));
                }}
              />
            </div>
          </div>
        </div>

        <div ref={scrollContainerRef} className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {memoQuery.isLoading ? (
            <div className="space-y-2">
              <div className="h-24 animate-pulse rounded-xl border border-base-300/70 bg-base-200/55" />
              <div className="h-24 animate-pulse rounded-xl border border-base-300/70 bg-base-200/55" />
              <div className="h-24 animate-pulse rounded-xl border border-base-300/70 bg-base-200/55" />
            </div>
          ) : null}

          {memoQuery.isError ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl border border-dashed border-error/35 bg-error/5 px-5 text-center">
              <RobotCharacter className="h-24 w-24" ariaLabel="메모 오류 상태 캐릭터" showAlertBadge />
              <p className="m-0 mt-3 text-sm font-semibold text-base-content/78">메모를 불러오지 못했어요.</p>
              <p className="m-0 mt-1 text-xs leading-5 text-base-content/55">잠시 후 다시 시도해 주세요.</p>
            </div>
          ) : null}

          {!memoQuery.isLoading && !memoQuery.isError && !isFilteredView && !hasAnyMemo ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-200/35 px-5 text-center">
              <RobotCharacter className="h-24 w-24" ariaLabel="메모 빈 상태 캐릭터" mood="sad" badgeText="?" />
              <p className="m-0 mt-3 text-sm font-semibold text-base-content/78">아직 작성한 메모가 없어요.</p>
              <p className="m-0 mt-1 text-xs leading-5 text-base-content/55">
                캘린더에서 날짜를 선택해 하루 기록을 남겨보세요.
              </p>
            </div>
          ) : null}

          {!memoQuery.isLoading && !memoQuery.isError && isEmptySearch ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-200/35 px-5 text-center">
              <RobotCharacter className="h-24 w-24" ariaLabel="검색 결과 없음 캐릭터" mood="sad" badgeText="?" />
              <p className="m-0 mt-3 text-sm font-semibold text-base-content/78">검색 결과가 없어요.</p>
              <p className="m-0 mt-1 text-xs leading-5 text-base-content/55">
                다른 단어나 월 필터로 다시 찾아보세요.
              </p>
            </div>
          ) : null}

          {!memoQuery.isLoading && !memoQuery.isError && memoItems.length > 0 ? (
            <div className="space-y-2.5">
              {memoItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-xl border border-base-300/80 bg-base-100 px-3 py-3 text-left shadow-sm transition-colors hover:bg-base-200/45"
                  onClick={() => openMemoLayer(item)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-base-content/70">
                        <FiCalendar size={13} className="shrink-0 text-primary/75" />
                        <span className="truncate">{formatMemoDate(item.dateKey)}</span>
                      </div>
                      <p className="m-0 mt-1.5 line-clamp-3 text-sm leading-5 text-base-content/86">
                        {item.plainMemo}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-base-content/52">
                    <FiCheckCircle size={12} className="text-success/75" />
                    <span>
                      할 일 {item.todoCount}개
                      {item.todoCount > 0 ? ` · 완료 ${item.doneCount}개` : ""}
                    </span>
                  </div>
                </button>
              ))}
              <div ref={loadMoreRef} className="h-8">
                {memoQuery.isFetchingNextPage ? (
                  <p className="m-0 py-2 text-center text-xs text-base-content/50">메모 더 불러오는 중...</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {isSearchDeferred && !memoQuery.isLoading ? (
            <p className="m-0 pt-2 text-center text-[11px] text-base-content/45">검색어 반영 중...</p>
          ) : null}
        </div>
      </div>

      {selectedMemo ? (
        <div className="fixed inset-0 z-[90] flex min-h-0 flex-col bg-base-100" role="dialog" aria-modal="true">
          <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_auto] items-center gap-1 border-b border-base-300/80 px-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base-content/70 transition-colors hover:bg-base-200/70"
              aria-label="메모 닫기"
              onClick={closeMemoLayer}
            >
              <FiChevronLeft size={18} />
            </button>
            <h2 className="m-0 truncate px-2 text-center text-[17px] font-semibold text-base-content">
              {formatMemoDate(selectedMemo.dateKey)}
            </h2>
            <button
              type="button"
              className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
              onClick={moveToMemoDate}
            >
              날짜로 이동
            </button>
          </header>
          <div className="min-h-0 flex-1 p-2">
            <MemoEditorPanel
              dateKey={selectedMemo.dateKey}
              className="h-full rounded-xl border-base-300/70 bg-base-200/35 p-2.5"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
