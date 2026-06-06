import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAchievementHistory, fetchAchievementProgressList, syncAchievements } from "../api/achievementApi";
import { RobotCharacter } from "../components/RobotCharacter";
import { Button } from "../components/ui/Button";
import { AchievementHistoryTab } from "../features/achievement/components/AchievementHistoryTab";
import { AchievementProgressTab } from "../features/achievement/components/AchievementProgressTab";

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
    staleTime: 10 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: syncAchievements,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY }),
      ]);
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

  const progressRows = progressQuery.data ?? [];
  const historyRows = historyQuery.data?.pages.flatMap((page) => page) ?? [];

  const permanentRows = progressRows.filter((row) => row.scope !== "weekly");
  const weeklyChallengeRows = progressRows.filter((row) => row.scope === "weekly");

  const unlockedCount = permanentRows.filter((row) => row.isAchieved).length;
  const totalCount = permanentRows.length;
  const focusBestStreak = resolveBestStreak(progressRows, "focus-streak-bronze");
  const doneBestStreak = resolveBestStreak(progressRows, "done-streak-bronze");
  const weeklyBestStreak = progressRows
    .filter((row) => row.scope === "weekly")
    .reduce((acc, row) => Math.max(acc, row.bestWeeklyStreak), 0);
  const weeklyAchievedCount = weeklyChallengeRows.filter((row) => row.isAchieved).length;

  const filteredProgressRows = useMemo(() => {
    if (activeCategory === "all") {
      return permanentRows;
    }
    return permanentRows.filter((row) => row.category === activeCategory);
  }, [activeCategory, permanentRows]);

  const permanentHistoryRows = historyRows.filter((row) => row.scope !== "weekly");
  const weeklyHistoryRows = historyRows.filter((row) => row.scope === "weekly");
  const filteredHistoryRows =
    activeHistoryFilter === "permanent"
      ? permanentHistoryRows
      : activeHistoryFilter === "weekly"
        ? weeklyHistoryRows
        : historyRows;

  const isBusy = progressQuery.isFetching || historyQuery.isFetching || syncMutation.isPending;
  const isInitialAchievementLoading =
    !hasCompletedInitialSync || progressQuery.isLoading || historyQuery.isLoading;

  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5">
      {isInitialAchievementLoading ? (
        <AchievementInitialLoadingState />
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
              activeCategory={activeCategory}
              onChangeCategory={setActiveCategory}
              filteredProgressRows={filteredProgressRows}
            />
          ) : (
            <AchievementHistoryTab
              activeHistoryFilter={activeHistoryFilter}
              onChangeHistoryFilter={setActiveHistoryFilter}
              permanentHistoryRows={permanentHistoryRows}
              weeklyHistoryRows={weeklyHistoryRows}
              filteredHistoryRows={filteredHistoryRows}
              loadMoreRef={loadMoreRef}
              isFetchingNextPage={historyQuery.isFetchingNextPage}
            />
          )}

          {isBusy ? <p className="text-xs text-base-content/60">업적 데이터 동기화 중...</p> : null}
        </div>
      )}
    </section>
  );
}
