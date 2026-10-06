import type { fetchDailyLogByDate } from "../../../../api/dailyLogApi";
import { formatDateKey } from "../../../../utils/holidays";
import type { TaskItem } from "../../types";

type DailyLogPreview = Awaited<ReturnType<typeof fetchDailyLogByDate>>;

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

/**
 * 인접 날짜의 일일 기록을 페이지 전환 미리보기에 사용하는 읽기 전용 할 일 목록으로 바꾼다.
 * 원본 순서는 변경하지 않으며 지난 날짜의 미완료 항목은 overdue 상태로 표시한다.
 */
export function mapDailyLogPreviewToTaskItems(
  dateKey: string,
  log: DailyLogPreview
): TaskItem[] {
  const todos = log?.todos ?? [];
  const todayKey = formatDateKey(new Date());
  const isPastDate = dateKey < todayKey;

  return [...todos]
    .sort((a, b) => a.order - b.order)
    .map((todo) => {
      const startedAt = toEpochMillis(todo.startedAt);
      const scheduledStartAt = toEpochMillis(todo.scheduledStartAt);
      const targetFocusMinutes = typeof todo.targetFocusMinutes === "number"
        ? Math.floor(todo.targetFocusMinutes)
        : null;
      const completedAt = toEpochMillis(todo.completedAt);
      const completedDurationMs = todo.done ? (todo.actualFocusSeconds ?? 0) * 1000 : null;
      const status: TaskItem["status"] = todo.done
        ? "done"
        : isPastDate
          ? "overdue"
          : todo.pausedAt
            ? "paused"
            : startedAt
              ? "in_progress"
              : "todo";

      return {
        id: todo.id,
        label: todo.content,
        status,
        accumulatedMs: completedDurationMs ?? 0,
        startedAt: status === "in_progress" ? startedAt : null,
        deviationSeconds:
          typeof todo.deviationSeconds === "number" && Number.isFinite(todo.deviationSeconds)
            ? Math.max(Math.floor(todo.deviationSeconds), 0)
            : 0,
        scheduledStartAt,
        targetFocusMinutes,
        completedAt: status === "done" ? completedAt : null,
        completedDurationMs,
      };
    });
}
