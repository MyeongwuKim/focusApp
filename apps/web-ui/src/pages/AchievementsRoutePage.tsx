import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAchievementHistory,
  fetchAchievementProgressList,
  syncAchievements,
  type AchievementProgressRecord,
} from "../api/achievementApi";
import { RobotCharacter } from "../components/RobotCharacter";
import { Button } from "../components/ui/Button";
import { AchievementHistoryTab } from "../features/achievement/components/AchievementHistoryTab";
import { AchievementProgressTab } from "../features/achievement/components/AchievementProgressTab";
import { toast } from "../stores";
import { getUserFacingErrorMessage } from "../utils/errorMessage";

type AchievementsRoutePageProps = {
  forcedSearch?: string;
};

type AchievementsTab = "progress" | "history";
type CategoryFilter = "all" | "focus" | "done" | "streak";
type HistoryFilter = "all" | "permanent" | "weekly";

const PROGRESS_QUERY_KEY = ["achievement-progress-list"] as const;
const HISTORY_QUERY_KEY = ["achievement-history-list"] as const;
const HISTORY_PAGE_SIZE = 30;

function resolveBestStreak(
  progressRows: Array<{ badgeId: string; currentValue: number }>,
  badgePrefix: string
) {
  const target = progressRows.find((row) => row.badgeId === badgePrefix);
  return target?.currentValue ?? 0;
}

function progressRatio(row: AchievementProgressRecord) {
  return row.goal > 0 ? Math.min(row.currentValue / row.goal, 1) : 0;
}

function sortAchievementRows(rows: AchievementProgressRecord[]) {
  return [...rows].sort((left, right) => {
    if (left.isAchieved !== right.isAchieved) {
      return left.isAchieved ? 1 : -1;
    }
    if (!left.isAchieved) {
      return progressRatio(right) - progressRatio(left) || left.goal - right.goal;
    }
    return (right.lastAchievedAt ?? "").localeCompare(left.lastAchievedAt ?? "") || right.goal - left.goal;
  });
}

function AchievementLoadingSignal() {
  return (
    <span className="absolute left-1/2 top-0 block h-10 w-12 -translate-x-1/2" aria-hidden="true">
      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary shadow-sm shadow-primary/30" />
      <span className="absolute bottom-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-t-full border-t-2 border-primary/80 motion-safe:animate-ping" />
      <span className="absolute bottom-1 left-1/2 h-6 w-6 -translate-x-1/2 rounded-t-full border-t-2 border-primary/55 motion-safe:animate-pulse" />
      <span className="absolute bottom-1 left-1/2 h-8 w-8 -translate-x-1/2 rounded-t-full border-t-2 border-primary/25 motion-safe:animate-pulse" />
    </span>
  );
}

function AchievementInitialLoadingState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center" aria-live="polite">
      <div className="relative h-36 w-32">
        <AchievementLoadingSignal />
        <RobotCharacter
          className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 drop-shadow-sm"
          ariaLabel="업적을 불러오는 로봇 캐릭터"
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-base-content">업적 데이터 불러오는 중...</p>
        <p className="text-xs text-base-content/60">이번 주 진행 상황을 정리하고 있어요.</p>
      </div>
    </div>
  );
}

function AchievementErrorState({
  error,
  isRetrying,
  onRetry,
}: {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center" role="alert">
      <RobotCharacter className="h-24 w-24" ariaLabel="업적 불러오기 실패 캐릭터" mood="sad" />
      <div className="space-y-1">
        <p className="m-0 text-sm font-semibold text-base-content/85">업적을 불러오지 못했어요.</p>
        <p className="m-0 text-xs text-base-content/60">
          {getUserFacingErrorMessage(error, "잠시 후 다시 시도해 주세요.")}
        </p>
      </div>
      <Button size="sm" variant="primary" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "다시 불러오는 중..." : "다시 시도"}
      </Button>
    </div>
  );
}

export function AchievementsRoutePage({ forcedSearch }: AchievementsRoutePageProps) {
  void forcedSearch;
  const queryClient = useQueryClient();
  const didSyncRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<AchievementsTab>("progress");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeHistoryFilter, setActiveHistoryFilter] = useState<HistoryFilter>("all");
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);

  const progressQuery = useQuery({
    queryKey: PROGRESS_QUERY_KEY,
    queryFn: fetchAchievementProgressList,
    staleTime: 10 * 1000,
  });

  const historyQuery = useInfiniteQuery({
    queryKey: HISTORY_QUERY_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchAchievementHistory({
        limit: HISTORY_PAGE_SIZE,
        offset: typeof pageParam === "number" ? pageParam : 0,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < HISTORY_PAGE_SIZE) {
        return undefined;
      }
      return allPages.reduce((acc, page) => acc + page.length, 0);
    },
    enabled: activeTab === "history",
    staleTime: 10 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: syncAchievements,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY }),
      ]);
      if (result.newEventCount > 0) {
        toast.positive(
          `새 업적 ${result.newEventCount}개를 달성했어요. 히스토리에서 확인해 보세요.`,
          "업적 달성"
        );
      }
      setHasCompletedInitialSync(true);
    },
    onError: () => {
      setHasCompletedInitialSync(true);
    },
  });

  useEffect(() => {
    if (didSyncRef.current) {
      return;
    }
    didSyncRef.current = true;
    syncMutation.mutate();
  }, [syncMutation]);

  useEffect(() => {
    if (activeTab !== "history") {
      return;
    }
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) {
          return;
        }
        if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
          void historyQuery.fetchNextPage();
        }
      },
      { root: null, rootMargin: "0px 0px 240px 0px", threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, historyQuery]);

  const progressRows = useMemo(() => progressQuery.data ?? [], [progressQuery.data]);
  const historyRows = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page) ?? [],
    [historyQuery.data]
  );

  const permanentRows = useMemo(
    () => progressRows.filter((row) => row.scope !== "weekly"),
    [progressRows]
  );
  const weeklyChallengeRows = useMemo(
    () => progressRows.filter((row) => row.scope === "weekly"),
    [progressRows]
  );

  const unlockedCount = permanentRows.filter((row) => row.isAchieved).length;
  const totalCount = permanentRows.length;
  const focusBestStreak = resolveBestStreak(progressRows, "focus-streak-bronze");
  const doneBestStreak = resolveBestStreak(progressRows, "done-streak-bronze");
  const weeklyBestStreak = progressRows
    .filter((row) => row.scope === "weekly")
    .reduce((acc, row) => Math.max(acc, row.bestWeeklyStreak), 0);
  const weeklyAchievedCount = weeklyChallengeRows.filter((row) => row.isAchieved).length;
  const nextAchievement = useMemo(
    () =>
      permanentRows
        .filter((row) => !row.isAchieved)
        .sort((left, right) => progressRatio(right) - progressRatio(left) || left.goal - right.goal)[0] ??
      null,
    [permanentRows]
  );

  const filteredProgressRows = useMemo(() => {
    const categoryRows =
      activeCategory === "all"
        ? permanentRows
        : permanentRows.filter((row) => row.category === activeCategory);
    return sortAchievementRows(categoryRows);
  }, [activeCategory, permanentRows]);

  const filteredHistoryRows =
    activeHistoryFilter === "permanent"
      ? historyRows.filter((row) => row.scope !== "weekly")
      : activeHistoryFilter === "weekly"
        ? historyRows.filter((row) => row.scope === "weekly")
        : historyRows;

  const isBusy =
    progressQuery.isFetching ||
    (activeTab === "history" && historyQuery.isFetching) ||
    syncMutation.isPending;
  const isInitialAchievementLoading =
    !hasCompletedInitialSync || progressQuery.isLoading;
  const isProgressUnavailable =
    progressRows.length === 0 && (progressQuery.isError || syncMutation.isError);

  const retryAchievementData = () => {
    setHasCompletedInitialSync(false);
    void progressQuery.refetch();
    if (activeTab === "history") {
      void historyQuery.refetch();
    }
    syncMutation.mutate();
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5">
      {isInitialAchievementLoading ? (
        <AchievementInitialLoadingState />
      ) : isProgressUnavailable ? (
        <AchievementErrorState
          error={progressQuery.error ?? syncMutation.error}
          isRetrying={progressQuery.isFetching || syncMutation.isPending}
          onRetry={retryAchievementData}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-base-300/80 bg-base-200/35 p-1">
            <Button
              size="sm"
              variant={activeTab === "progress" ? "primary" : "ghost"}
              onClick={() => setActiveTab("progress")}
            >
              업적 진행상황
            </Button>
            <Button
              size="sm"
              variant={activeTab === "history" ? "primary" : "ghost"}
              onClick={() => setActiveTab("history")}
            >
              업적 히스토리
            </Button>
          </div>

          {activeTab === "progress" ? (
            <AchievementProgressTab
              unlockedCount={unlockedCount}
              totalCount={totalCount}
              focusBestStreak={focusBestStreak}
              doneBestStreak={doneBestStreak}
              weeklyBestStreak={weeklyBestStreak}
              weeklyAchievedCount={weeklyAchievedCount}
              weeklyChallengeRows={weeklyChallengeRows}
              nextAchievement={nextAchievement}
              activeCategory={activeCategory}
              onChangeCategory={setActiveCategory}
              filteredProgressRows={filteredProgressRows}
            />
          ) : historyQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center" aria-live="polite">
              <p className="text-xs text-base-content/60">업적 히스토리 불러오는 중...</p>
            </div>
          ) : historyQuery.isError ? (
            <AchievementErrorState
              error={historyQuery.error}
              isRetrying={historyQuery.isFetching}
              onRetry={() => void historyQuery.refetch()}
            />
          ) : (
            <AchievementHistoryTab
              activeHistoryFilter={activeHistoryFilter}
              onChangeHistoryFilter={setActiveHistoryFilter}
              filteredHistoryRows={filteredHistoryRows}
              loadMoreRef={loadMoreRef}
              isFetchingNextPage={historyQuery.isFetchingNextPage}
            />
          )}

          {isBusy ? <p className="text-xs text-base-content/60">업적 데이터 동기화 중...</p> : null}
          {syncMutation.isError && progressRows.length > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2">
              <p className="m-0 text-xs text-error">최신 업적 반영에 실패했어요.</p>
              <Button size="xs" variant="default" onClick={() => syncMutation.mutate()}>
                다시 동기화
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
