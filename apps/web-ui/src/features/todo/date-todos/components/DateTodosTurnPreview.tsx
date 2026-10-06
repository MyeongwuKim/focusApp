import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FiClipboard } from "react-icons/fi";
import { fetchDailyLogByDate } from "../../../../api/dailyLogApi";
import { dailyLogByDateQueryKey } from "../../../../queries/daily-log/queries";
import { TodoItemCard } from "../../components/TodoItemCard";
import { mapDailyLogPreviewToTaskItems } from "../utils/dateTodosPreview";

type DateTodosTurnPreviewProps = {
  dateKey: string;
};

/**
 * 전체 페이지를 넘기는 동안 다음 또는 이전 날짜의 실제 할 일 목록을 뒤쪽 종이에 미리 표시한다.
 * 조회 결과는 일일 기록 캐시를 공유하며, 미리보기 안에서는 시작·수정·삭제 동작을 실행하지 않는다.
 */
export function DateTodosTurnPreview({ dateKey }: DateTodosTurnPreviewProps) {
  const dailyLogQuery = useQuery({
    queryKey: dailyLogByDateQueryKey(dateKey),
    queryFn: () => fetchDailyLogByDate(dateKey),
    staleTime: 30 * 1000,
    retry: 0,
    meta: {
      skipGlobalErrorToast: true,
    },
  });
  const items = useMemo(
    () => mapDailyLogPreviewToTaskItems(dateKey, dailyLogQuery.data ?? null),
    [dailyLogQuery.data, dateKey]
  );

  return (
    <div className="date-todos-turn-preview relative flex min-h-0 flex-1 flex-col overflow-hidden px-1 py-1">
      <div className="date-todos-board relative min-h-0 flex-1 overflow-hidden rounded-xl border border-base-300/80 bg-base-100/65 p-2.5">
        {dailyLogQuery.isLoading && items.length === 0 ? (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
            <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
          </div>
        ) : items.length > 0 ? (
          <div className="todo-item-list space-y-2">
            {items.map((item) => (
              <TodoItemCard
                key={`turn-preview-${item.id}`}
                item={item}
                onTaskAction={() => undefined}
                onOpenMenu={() => undefined}
                disableActions
                canRunFocus={false}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-base-content/55">
            <FiClipboard size={20} />
            <p className="m-0 text-sm font-semibold">등록된 할 일 없음</p>
          </div>
        )}
      </div>
      <div className="date-todos-turn-preview__footer" aria-hidden="true">
        <div className="date-todos-turn-preview__actions">
          <span />
          <span />
          <span />
        </div>
        <i />
        <i />
      </div>
    </div>
  );
}
