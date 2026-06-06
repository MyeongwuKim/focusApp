import { Button } from "../../../components/ui/Button";
import type { AchievementEventRecord } from "../../../api/achievementApi";
import { AchievementHistoryEmptyState } from "./AchievementHistoryEmptyState";
import { AchievementHistoryEventCard } from "./AchievementHistoryEventCard";
import type { RefObject } from "react";

type HistoryFilter = "all" | "permanent" | "weekly";

type AchievementHistoryTabProps = {
  activeHistoryFilter: HistoryFilter;
  onChangeHistoryFilter: (value: HistoryFilter) => void;
  permanentHistoryRows: AchievementEventRecord[];
  weeklyHistoryRows: AchievementEventRecord[];
  filteredHistoryRows: AchievementEventRecord[];
  loadMoreRef: RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
};

export function AchievementHistoryTab({
  activeHistoryFilter,
  onChangeHistoryFilter,
  permanentHistoryRows,
  weeklyHistoryRows,
  filteredHistoryRows,
  loadMoreRef,
  isFetchingNextPage,
}: AchievementHistoryTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="xs"
          variant={activeHistoryFilter === "all" ? "primary" : "default"}
          onClick={() => onChangeHistoryFilter("all")}
        >
          전체
        </Button>
        <Button
          size="xs"
          variant={activeHistoryFilter === "permanent" ? "primary" : "default"}
          onClick={() => onChangeHistoryFilter("permanent")}
        >
          누적 기록
        </Button>
        <Button
          size="xs"
          variant={activeHistoryFilter === "weekly" ? "primary" : "default"}
          onClick={() => onChangeHistoryFilter("weekly")}
        >
          주간 도전
        </Button>
      </div>

      {filteredHistoryRows.length === 0 ? (
        <AchievementHistoryEmptyState variant={activeHistoryFilter === "all" ? "all" : activeHistoryFilter} />
      ) : activeHistoryFilter === "all" ? (
        <>
          <div className="space-y-2">
            {permanentHistoryRows.length > 0 ? (
              permanentHistoryRows.map((event) => <AchievementHistoryEventCard key={event.id} event={event} />)
            ) : (
              <AchievementHistoryEmptyState variant="permanent" />
            )}
          </div>
          <div className="space-y-2">
            {weeklyHistoryRows.length > 0 ? (
              weeklyHistoryRows.map((event) => <AchievementHistoryEventCard key={event.id} event={event} />)
            ) : (
              <AchievementHistoryEmptyState variant="weekly" />
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {filteredHistoryRows.map((event) => (
            <AchievementHistoryEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="h-5" />
      {isFetchingNextPage ? <p className="text-center text-xs text-base-content/60">히스토리 더 불러오는 중...</p> : null}
    </div>
  );
}
