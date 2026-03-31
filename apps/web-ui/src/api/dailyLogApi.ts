export type DailyLogTodo = {
  id: string;
  content: string;
  done: boolean;
  order: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  deviationSeconds: number;
  actualFocusSeconds: number | null;
};

export type DailyLog = {
  id: string;
  userId: string;
  dateKey: string;
  monthKey: string;
  memo: string | null;
  todos: DailyLogTodo[];
  todoCount: number;
  doneCount: number;
  previewTodos: string[];
  createdAt: string;
  updatedAt: string;
};

type DailyLogsByMonthQueryResponse = {
  dailyLogsByMonth: DailyLog[];
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const DAILY_LOGS_BY_MONTH_QUERY = `
  query DailyLogsByMonth($monthKey: String!) {
    dailyLogsByMonth(monthKey: $monthKey) {
      id
      userId
      dateKey
      monthKey
      memo
      todoCount
      doneCount
      previewTodos
      createdAt
      updatedAt
      todos {
        id
        content
        done
        order
        createdAt
        startedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

export async function fetchDailyLogsByMonth(monthKey: string) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: DAILY_LOGS_BY_MONTH_QUERY,
      variables: { monthKey },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily logs fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<DailyLogsByMonthQueryResponse>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL dailyLogsByMonth failed");
  }
  return result.data?.dailyLogsByMonth ?? [];
}
