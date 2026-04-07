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
      todoCount
      doneCount
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
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
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
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const DELETE_TODO_QUERY = /* GraphQL */ `
  mutation DeleteTodo($input: TodoActionInput!) {
    deleteTodo(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const START_TODO_QUERY = /* GraphQL */ `
  mutation StartTodo($input: TodoActionInput!) {
    startTodo(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const PAUSE_TODO_QUERY = /* GraphQL */ `
  mutation PauseTodo($input: TodoActionInput!) {
    pauseTodo(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const RESUME_TODO_QUERY = /* GraphQL */ `
  mutation ResumeTodo($input: TodoActionInput!) {
    resumeTodo(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const COMPLETE_TODO_QUERY = /* GraphQL */ `
  mutation CompleteTodo($input: TodoActionInput!) {
    completeTodo(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const ADD_DEVIATION_QUERY = /* GraphQL */ `
  mutation AddDeviation($input: AddDeviationInput!) {
    addDeviation(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const UPDATE_TODO_ACTUAL_FOCUS_QUERY = /* GraphQL */ `
  mutation UpdateTodoActualFocus($input: UpdateTodoActualFocusInput!) {
    updateTodoActualFocus(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const START_REST_SESSION_QUERY = /* GraphQL */ `
  mutation StartRestSession($input: RestSessionInput!) {
    startRestSession(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

const STOP_REST_SESSION_QUERY = /* GraphQL */ `
  mutation StopRestSession($input: RestSessionInput!) {
    stopRestSession(input: $input) {
      dateKey
      memo
      restAccumulatedSeconds
      restStartedAt
      todos {
        id
        content
        done
        order
        startedAt
        pausedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

type DailyLogTodo = {
  id: string;
  content: string;
  done: boolean;
  order: number;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  deviationSeconds: number;
  actualFocusSeconds: number | null;
};

type DailyLogPayload = {
  dateKey: string;
  memo: string | null;
  restAccumulatedSeconds: number;
  restStartedAt: string | null;
  todos: DailyLogTodo[];
};

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
  dailyLog: DailyLogPayload | null;
};

type AddTodosMutation = {
  addTodos: DailyLogPayload;
};

type DeleteTodoMutation = {
  deleteTodo: DailyLogPayload;
};

type StartTodoMutation = {
  startTodo: DailyLogPayload;
};

type PauseTodoMutation = {
  pauseTodo: DailyLogPayload;
};

type ResumeTodoMutation = {
  resumeTodo: DailyLogPayload;
};

type CompleteTodoMutation = {
  completeTodo: DailyLogPayload;
};

type AddDeviationMutation = {
  addDeviation: DailyLogPayload;
};

type UpdateTodoActualFocusMutation = {
  updateTodoActualFocus: DailyLogPayload;
};

type StartRestSessionMutation = {
  startRestSession: DailyLogPayload;
};

type StopRestSessionMutation = {
  stopRestSession: DailyLogPayload;
};

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

export async function deleteTodoFromDailyLog(input: { dateKey: string; todoId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: DELETE_TODO_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Delete todo failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<DeleteTodoMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL deleteTodo failed");
  }

  const next = result.data?.deleteTodo;
  if (!next) {
    throw new Error("GraphQL deleteTodo failed");
  }
  return next;
}

export async function startTodoFromDailyLog(input: { dateKey: string; todoId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: START_TODO_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Start todo failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<StartTodoMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL startTodo failed");
  }

  const next = result.data?.startTodo;
  if (!next) {
    throw new Error("GraphQL startTodo failed");
  }
  return next;
}

export async function pauseTodoFromDailyLog(input: { dateKey: string; todoId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: PAUSE_TODO_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Pause todo failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<PauseTodoMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL pauseTodo failed");
  }

  const next = result.data?.pauseTodo;
  if (!next) {
    throw new Error("GraphQL pauseTodo failed");
  }
  return next;
}

export async function resumeTodoFromDailyLog(input: { dateKey: string; todoId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: RESUME_TODO_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Resume todo failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<ResumeTodoMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL resumeTodo failed");
  }

  const next = result.data?.resumeTodo;
  if (!next) {
    throw new Error("GraphQL resumeTodo failed");
  }
  return next;
}

export async function completeTodoFromDailyLog(input: { dateKey: string; todoId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: COMPLETE_TODO_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Complete todo failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<CompleteTodoMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL completeTodo failed");
  }

  const next = result.data?.completeTodo;
  if (!next) {
    throw new Error("GraphQL completeTodo failed");
  }
  return next;
}

export async function addTodoDeviationToDailyLog(input: {
  dateKey: string;
  todoId: string;
  seconds: number;
}) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: ADD_DEVIATION_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Add deviation failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<AddDeviationMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL addDeviation failed");
  }

  const next = result.data?.addDeviation;
  if (!next) {
    throw new Error("GraphQL addDeviation failed");
  }
  return next;
}

export async function updateTodoActualFocusFromDailyLog(input: {
  dateKey: string;
  todoId: string;
  actualFocusSeconds: number;
}) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: UPDATE_TODO_ACTUAL_FOCUS_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Update actual focus failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<UpdateTodoActualFocusMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL updateTodoActualFocus failed");
  }

  const next = result.data?.updateTodoActualFocus;
  if (!next) {
    throw new Error("GraphQL updateTodoActualFocus failed");
  }
  return next;
}

export async function startRestSession(input: { dateKey: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: START_REST_SESSION_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Start rest session failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<StartRestSessionMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL startRestSession failed");
  }

  const next = result.data?.startRestSession;
  if (!next) {
    throw new Error("GraphQL startRestSession failed");
  }
  return next;
}

export async function stopRestSession(input: { dateKey: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: STOP_REST_SESSION_QUERY,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Stop rest session failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<StopRestSessionMutation>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL stopRestSession failed");
  }

  const next = result.data?.stopRestSession;
  if (!next) {
    throw new Error("GraphQL stopRestSession failed");
  }
  return next;
}
