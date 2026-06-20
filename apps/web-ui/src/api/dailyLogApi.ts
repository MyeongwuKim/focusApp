import {
  AddTodosDocument,
  CompleteTodoDocument,
  DailyLogByDateDocument,
  DailyLogDocument,
  DailyLogsByMonthDocument,
  DailyLogsWithMemoDocument,
  DeleteTodoDocument,
  MuteTodoReminderTodayDocument,
  PauseTodoDocument,
  ReorderTodosDocument,
  ResetTodoDocument,
  ResumeTodoDocument,
  StartRestSessionDocument,
  StartTodoDocument,
  StopRestSessionDocument,
  UnmuteTodoReminderDocument,
  UpdateTodoActualFocusDocument,
  UpdateTodoScheduleDocument,
  UpdateTodoTargetFocusDocument,
  UpsertDailyLogDocument,
  type AddTodosInput,
  type ReorderTodosInput,
  type RestSessionInput,
  type TodoActionInput,
  type UpdateTodoActualFocusInput,
  type UpdateTodoScheduleInput,
  type UpdateTodoTargetFocusInput,
  type UpsertDailyLogInput,
} from "../graphql/generated";
import { requestGraphql } from "./graphqlClient";

type DailyLogTodo = {
  id: string;
  taskId: string | null;
  titleSnapshot: string | null;
  content: string;
  done: boolean;
  order: number;
  startedAt: string | null;
  scheduledStartAt: string | null;
  targetFocusMinutes: number | null;
  pausedAt: string | null;
  completedAt: string | null;
  deviationSeconds: number;
  resumeCount: number;
  actualFocusSeconds: number | null;
  muteReminderDateKey: string | null;
};

type DailyLogPayload = {
  dateKey: string;
  memo: string | null;
  restAccumulatedSeconds: number;
  restStartedAt: string | null;
  todos: DailyLogTodo[];
};

type DailyLogsByMonthItem = {
  id: string;
  userId: string;
  dateKey: string;
  monthKey: string;
  memo: string | null;
  todoCount: number;
  doneCount: number;
  previewTodos: string[];
  todos: Array<{
    id: string;
    taskId: string | null;
    titleSnapshot: string | null;
    content: string;
    done: boolean;
    order: number;
  }>;
};

type DailyLogMemo = {
  dateKey: string;
  memo: string | null;
};

type DailyLogsWithMemoResult = {
  items: Array<{
    id: string;
    dateKey: string;
    monthKey: string;
    memo: string | null;
    todoCount: number;
    doneCount: number;
    previewTodos: string[];
  }>;
  nextCursorDateKey: string | null;
  hasNextPage: boolean;
};

export async function fetchDailyLogsByMonth(monthKey: string) {
  const data = await requestGraphql(DailyLogsByMonthDocument, { monthKey });
  return data.dailyLogsByMonth as DailyLogsByMonthItem[];
}

export type FetchDailyLogsWithMemoInput = {
  limit?: number;
  cursorDateKey?: string | null;
  monthKey?: string | null;
  search?: string | null;
  sortOrder?: "asc" | "desc";
};

export async function fetchDailyLogsWithMemo(input: FetchDailyLogsWithMemoInput = {}) {
  const data = await requestGraphql(DailyLogsWithMemoDocument, {
    limit: input.limit ?? 30,
    cursorDateKey: input.cursorDateKey ?? null,
    monthKey: input.monthKey ?? null,
    search: input.search ?? null,
    sortOrder: input.sortOrder ?? "desc",
  });

  return (data.dailyLogsWithMemo ?? {
    items: [],
    nextCursorDateKey: null,
    hasNextPage: false,
  }) as DailyLogsWithMemoResult;
}

export async function fetchDailyLogMemo(dateKey: string) {
  const data = await requestGraphql(DailyLogDocument, { dateKey });
  return (data.dailyLog ?? null) as DailyLogMemo | null;
}

export async function upsertDailyLogMemo(input: UpsertDailyLogInput & { memo: string }) {
  const data = await requestGraphql(UpsertDailyLogDocument, { input });
  return data.upsertDailyLog as DailyLogMemo;
}

export async function fetchDailyLogByDate(dateKey: string) {
  const data = await requestGraphql(DailyLogByDateDocument, { dateKey });
  return (data.dailyLog ?? null) as DailyLogPayload | null;
}

export async function addTodosToDailyLog(input: AddTodosInput) {
  const data = await requestGraphql(AddTodosDocument, { input });
  return data.addTodos as DailyLogPayload;
}

export async function deleteTodoFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(DeleteTodoDocument, { input });
  return data.deleteTodo as DailyLogPayload;
}

export async function startTodoFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(StartTodoDocument, { input });
  return data.startTodo as DailyLogPayload;
}

export async function pauseTodoFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(PauseTodoDocument, { input });
  return data.pauseTodo as DailyLogPayload;
}

export async function resumeTodoFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(ResumeTodoDocument, { input });
  return data.resumeTodo as DailyLogPayload;
}

export async function completeTodoFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(CompleteTodoDocument, { input });
  return data.completeTodo as DailyLogPayload;
}

export async function resetTodoFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(ResetTodoDocument, { input });
  return data.resetTodo as DailyLogPayload;
}

export async function reorderTodosFromDailyLog(input: ReorderTodosInput) {
  const data = await requestGraphql(ReorderTodosDocument, { input });
  return data.reorderTodos as DailyLogPayload;
}

export async function updateTodoActualFocusFromDailyLog(input: UpdateTodoActualFocusInput) {
  const data = await requestGraphql(UpdateTodoActualFocusDocument, { input });
  return data.updateTodoActualFocus as DailyLogPayload;
}

export async function updateTodoScheduleFromDailyLog(input: UpdateTodoScheduleInput) {
  const data = await requestGraphql(UpdateTodoScheduleDocument, { input });
  return data.updateTodoSchedule as DailyLogPayload;
}

export async function updateTodoTargetFocusFromDailyLog(input: UpdateTodoTargetFocusInput) {
  const data = await requestGraphql(UpdateTodoTargetFocusDocument, { input });
  return data.updateTodoTargetFocus as DailyLogPayload;
}

export async function muteTodoReminderTodayFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(MuteTodoReminderTodayDocument, { input });
  return data.muteTodoReminderToday as DailyLogPayload;
}

export async function unmuteTodoReminderFromDailyLog(input: TodoActionInput) {
  const data = await requestGraphql(UnmuteTodoReminderDocument, { input });
  return data.unmuteTodoReminder as DailyLogPayload;
}

export async function startRestSession(input: RestSessionInput) {
  const data = await requestGraphql(StartRestSessionDocument, { input });
  return data.startRestSession as DailyLogPayload;
}

export async function stopRestSession(input: RestSessionInput) {
  const data = await requestGraphql(StopRestSessionDocument, { input });
  return data.stopRestSession as DailyLogPayload;
}
