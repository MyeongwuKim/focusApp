import type { DailyLogsByMonthQuery } from "../graphql/generated.ts";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

const DAILY_LOGS_BY_MONTH_QUERY = /* GraphQL */ `
  query DailyLogsByMonth($monthKey: String!) {
    dailyLogsByMonth(monthKey: $monthKey) {
      id
      userId
      dateKey
      monthKey
      previewTodos
      todos {
        id
        content
        done
        order
      }
    }
  }
`;

const DAILY_LOG_QUERY = /* GraphQL */ `
  query DailyLog($dateKey: String!) {
    dailyLog(dateKey: $dateKey) {
      dateKey
      memo
    }
  }
`;

const UPSERT_DAILY_LOG_QUERY = /* GraphQL */ `
  mutation UpsertDailyLog($input: UpsertDailyLogInput!) {
    upsertDailyLog(input: $input) {
      dateKey
      memo
    }
  }
`;

const DAILY_LOG_BY_DATE_QUERY = /* GraphQL */ `
  query DailyLogByDate($dateKey: String!) {
    dailyLog(dateKey: $dateKey) {
      dateKey
      memo
      todos {
        id
        content
        done
        order
        startedAt
        completedAt
        actualFocusSeconds
      }
    }
  }
`;

const ADD_TODOS_QUERY = /* GraphQL */ `
  mutation AddTodos($input: AddTodosInput!) {
    addTodos(input: $input) {
      dateKey
      memo
      todos {
        id
        content
        done
        order
        startedAt
        completedAt
        actualFocusSeconds
      }
    }
  }
`;

export async function fetchDailyLogsByMonth(monthKey: string) {
  const response = await fetch(getGraphqlEndpoint(), {
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

  const result = (await response.json()) as GraphQLResponse<DailyLogsByMonthQuery>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL dailyLogsByMonth failed");
  }
  return result.data?.dailyLogsByMonth ?? [];
}

type DailyLogMemoQuery = {
  dailyLog: {
    dateKey: string;
    memo: string | null;
  } | null;
};

type UpsertDailyLogMemoMutation = {
  upsertDailyLog: {
    dateKey: string;
    memo: string | null;
  };
};

type DailyLogByDateQuery = {
  dailyLog: {
    dateKey: string;
    memo: string | null;
    todos: Array<{
      id: string;
      content: string;
      done: boolean;
      order: number;
      startedAt: string | null;
      completedAt: string | null;
      actualFocusSeconds: number | null;
    }>;
  } | null;
};

type AddTodosMutation = {
  addTodos: {
    dateKey: string;
    memo: string | null;
    todos: Array<{
      id: string;
      content: string;
      done: boolean;
      order: number;
      startedAt: string | null;
      completedAt: string | null;
      actualFocusSeconds: number | null;
    }>;
  };
};

export async function fetchDailyLogMemo(dateKey: string) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: DAILY_LOG_QUERY,
      variables: { dateKey },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily log fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<DailyLogMemoQuery>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL dailyLog failed");
  }

  return result.data?.dailyLog ?? null;
}

export async function upsertDailyLogMemo(input: { dateKey: string; memo: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: UPSERT_DAILY_LOG_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily log upsert failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<UpsertDailyLogMemoMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL upsertDailyLog failed");
  }

  const next = result.data?.upsertDailyLog;
  if (!next) {
    throw new Error("GraphQL upsertDailyLog failed");
  }
  return next;
}

export async function fetchDailyLogByDate(dateKey: string) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: DAILY_LOG_BY_DATE_QUERY,
      variables: { dateKey },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily log fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<DailyLogByDateQuery>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL dailyLogByDate failed");
  }

  return result.data?.dailyLog ?? null;
}

export async function addTodosToDailyLog(input: {
  dateKey: string;
  items: Array<{
    content: string;
    taskId?: string | null;
  }>;
}) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: ADD_TODOS_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Add todos failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<AddTodosMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL addTodos failed");
  }

  const next = result.data?.addTodos;
  if (!next) {
    throw new Error("GraphQL addTodos failed");
  }
  return next;
}
