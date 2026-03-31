import { useDailyLogsByMonthQuery } from "../queries/useDailyLogsByMonthQuery";

type QueryTestPageProps = {
  title: string;
};

export function QueryTestPage({ title }: QueryTestPageProps) {
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const dailyLogsQuery = useDailyLogsByMonthQuery(monthKey);

  return (
    <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
      <h2 className="m-0 text-base font-semibold text-base-content">{title}</h2>
      <p className="mt-2 text-sm text-base-content/70">GraphQL dailyLogsByMonth 조회 테스트 화면입니다.</p>
      <p className="mt-1 text-xs text-base-content/60">monthKey: {monthKey}</p>

      <div className="mt-4 rounded-xl border border-base-300 bg-base-100/80 p-3 text-sm">
        {dailyLogsQuery.isPending ? <p className="m-0">로딩 중...</p> : null}

        {dailyLogsQuery.isError ? (
          <p className="m-0 text-error">
            요청 실패: {dailyLogsQuery.error instanceof Error ? dailyLogsQuery.error.message : "알 수 없음"}
          </p>
        ) : null}

        {dailyLogsQuery.data ? (
          <div className="space-y-2">
            <p className="m-0">
              <strong>월 로그 수</strong>: {dailyLogsQuery.data.length}
            </p>
            {dailyLogsQuery.data.slice(0, 7).map((log) => (
              <p key={log.id} className="m-0 text-xs text-base-content/80">
                {log.dateKey} / todo {log.todoCount} / done {log.doneCount}
              </p>
            ))}
          </div>
        ) : null}

        {!dailyLogsQuery.isPending && !dailyLogsQuery.isError && dailyLogsQuery.data?.length === 0 ? (
          <p className="m-0 text-base-content/70">해당 월 DailyLog 데이터 없음</p>
        ) : null}
      </div>

      <button
        type="button"
        className="btn btn-sm btn-outline mt-3"
        onClick={() => void dailyLogsQuery.refetch()}
      >
        다시 요청
      </button>
    </section>
  );
}
