import type { TaskItem } from "../../types";

export type DateTodosSummary = {
  completedCount: number;
  totalCount: number;
  totalMinutes: number;
  progressPercent: number;
};

/**
 * 날짜 화면의 할 일 수, 완료 수, 완료 집중 시간과 진행률을 계산한다.
 * excludedTaskId가 있으면 되돌리기 대기 중인 항목을 제외해 서버 삭제 전에도 화면 요약을 즉시 갱신한다.
 */
export function summarizeDateTodoItems(
  items: TaskItem[],
  excludedTaskId: string | null = null
): DateTodosSummary {
  const visibleItems = excludedTaskId
    ? items.filter((item) => item.id !== excludedTaskId)
    : items;
  const totalCount = visibleItems.length;
  const completedItems = visibleItems.filter((item) => item.status === "done");
  const completedCount = completedItems.length;
  const completedMs = completedItems.reduce(
    (acc, item) => acc + (item.completedDurationMs ?? item.accumulatedMs),
    0
  );
  const totalMinutes = Math.round(completedMs / 60000);
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return { totalCount, completedCount, totalMinutes, progressPercent };
}
