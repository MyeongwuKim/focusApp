import { randomUUID } from "node:crypto";
import { DailyLogRepository, type TodoItemRecord } from "./daily-log.repository.js";

interface BaseInput {
  userId: string;
  dateKey: string;
}

interface AddTodoInput extends BaseInput {
  content: string;
  taskId?: string | null;
  order?: number | null;
}

interface AddTodoBatchItemInput {
  content: string;
  taskId?: string | null;
  scheduledStartAt?: string | null;
}

interface AddTodosInput extends BaseInput {
  items: AddTodoBatchItemInput[];
}

interface CompleteTodoInput extends BaseInput {
  todoId: string;
}

interface AddDeviationInput extends BaseInput {
  todoId: string;
  seconds: number;
}

interface RestSessionInput extends BaseInput {}

interface UpdateTodoActualFocusInput extends BaseInput {
  todoId: string;
  actualFocusSeconds: number;
}

interface UpdateTodoScheduleInput extends BaseInput {
  todoId: string;
  scheduledStartAt: string | null;
}

export class DailyLogService {
  constructor(private readonly repository: DailyLogRepository) {}

  getDailyLog(userId: string, dateKey: string) {
    return this.repository.findByDate(userId, dateKey);
  }

  getDailyLogsByMonth(userId: string, monthKey: string) {
    return this.repository.findByMonth(userId, monthKey);
  }

  upsertDailyLog(input: BaseInput & { memo?: string | null }) {
    return this.repository.upsertDailyLog({
      userId: input.userId,
      dateKey: input.dateKey,
      monthKey: getMonthKey(input.dateKey),
      memo: input.memo
    });
  }

  async addTodo(input: AddTodoInput) {
    const log = await this.repository.upsertDailyLog({
      userId: input.userId,
      dateKey: input.dateKey,
      monthKey: getMonthKey(input.dateKey)
    });

    let linkedTaskTitle: string | null = null;
    if (input.taskId) {
      const linkedTask = await this.repository.findTaskById(input.userId, input.taskId);
      if (!linkedTask) {
        throw new Error("TASK_NOT_FOUND");
      }
      linkedTaskTitle = linkedTask.title;
    }

    const createdAt = new Date();
    const todo: TodoItemRecord = {
      id: randomUUID(),
      taskId: input.taskId ?? null,
      titleSnapshot: linkedTaskTitle,
      content: input.content,
      done: false,
      order: input.order ?? log.todos.length,
      createdAt,
      startedAt: null,
      scheduledStartAt: null,
      pausedAt: null,
      completedAt: null,
      deviationSeconds: 0,
      actualFocusSeconds: null
    };

    const nextTodos = [...log.todos, todo];
    const nextLog = await this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);

    if (input.taskId) {
      await this.repository.updateTaskLastUsedAt(input.userId, input.taskId, createdAt);
    }

    return nextLog;
  }

  async addTodos(input: AddTodosInput) {
    const log = await this.repository.upsertDailyLog({
      userId: input.userId,
      dateKey: input.dateKey,
      monthKey: getMonthKey(input.dateKey)
    });

    const uniqueTaskIds = Array.from(
      new Set(
        input.items
          .map((item) => item.taskId ?? null)
          .filter((taskId): taskId is string => typeof taskId === "string" && taskId.length > 0)
      )
    );

    const taskById = new Map<string, { id: string; title: string }>();
    if (uniqueTaskIds.length > 0) {
      const tasks = await this.repository.findTasksByIds(input.userId, uniqueTaskIds);
      for (const task of tasks) {
        taskById.set(task.id, { id: task.id, title: task.title });
      }
    }

    const existingTaskIdSet = new Set(
      log.todos
        .map((todo) => todo.taskId ?? null)
        .filter((taskId): taskId is string => typeof taskId === "string" && taskId.length > 0)
    );
    const existingContentSet = new Set(
      log.todos.map((todo) => todo.content.trim().toLowerCase()).filter((content) => content.length > 0)
    );

    const createdAt = new Date();
    const appendedTodos: TodoItemRecord[] = [];
    for (const item of input.items) {
      const content = item.content.trim();
      if (!content) {
        continue;
      }

      const normalizedContent = content.toLowerCase();
      const rawTaskId = item.taskId ?? null;
      const taskId = rawTaskId && taskById.has(rawTaskId) ? rawTaskId : null;

      if (taskId && existingTaskIdSet.has(taskId)) {
        continue;
      }
      if (!taskId && existingContentSet.has(normalizedContent)) {
        continue;
      }

      appendedTodos.push({
        id: randomUUID(),
        taskId,
        titleSnapshot: taskId ? taskById.get(taskId)?.title ?? null : null,
        content,
        done: false,
        order: log.todos.length + appendedTodos.length,
        createdAt,
        startedAt: null,
        scheduledStartAt: parseScheduledStartAt(item.scheduledStartAt),
        pausedAt: null,
        completedAt: null,
        deviationSeconds: 0,
        actualFocusSeconds: null
      });

      if (taskId) {
        existingTaskIdSet.add(taskId);
      } else {
        existingContentSet.add(normalizedContent);
      }
    }

    if (appendedTodos.length === 0) {
      return log;
    }

    const nextLog = await this.repository.replaceTodos(input.userId, input.dateKey, [
      ...log.todos,
      ...appendedTodos
    ]);

    await Promise.all(
      Array.from(
        new Set(appendedTodos.map((todo) => todo.taskId ?? null).filter((taskId): taskId is string => Boolean(taskId)))
      ).map((taskId) => this.repository.updateTaskLastUsedAt(input.userId, taskId, createdAt))
    );

    return nextLog;
  }

  async startTodo(input: CompleteTodoInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }
    if (hasAnotherInProgressTodo(log.todos, input.todoId)) {
      throw new Error("ANOTHER_TODO_ALREADY_IN_PROGRESS");
    }

    const nextTodos = [...log.todos];
    const targetTodo = nextTodos[targetIndex];
    nextTodos[targetIndex] = {
      ...targetTodo,
      done: false,
      startedAt: targetTodo.startedAt ?? new Date(),
      scheduledStartAt: null,
      pausedAt: null,
      completedAt: null,
      actualFocusSeconds: null
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async pauseTodo(input: CompleteTodoInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    const targetTodo = log.todos[targetIndex];
    if (targetTodo.done) {
      throw new Error("TODO_NOT_IN_PROGRESS");
    }
    if (!targetTodo.startedAt) {
      throw new Error("TODO_NOT_IN_PROGRESS");
    }
    if (targetTodo.pausedAt) {
      return log;
    }

    const nextTodos = [...log.todos];
    nextTodos[targetIndex] = {
      ...targetTodo,
      pausedAt: new Date()
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async resumeTodo(input: CompleteTodoInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }
    if (hasAnotherInProgressTodo(log.todos, input.todoId)) {
      throw new Error("ANOTHER_TODO_ALREADY_IN_PROGRESS");
    }

    const targetTodo = log.todos[targetIndex];
    if (targetTodo.done) {
      throw new Error("TODO_NOT_IN_PROGRESS");
    }
    if (!targetTodo.startedAt || !targetTodo.pausedAt) {
      throw new Error("TODO_NOT_IN_PROGRESS");
    }

    const pausedSeconds = Math.max(
      Math.floor((Date.now() - targetTodo.pausedAt.getTime()) / 1000),
      0
    );

    const nextTodos = [...log.todos];
    nextTodos[targetIndex] = {
      ...targetTodo,
      pausedAt: null,
      scheduledStartAt: null,
      deviationSeconds: targetTodo.deviationSeconds + pausedSeconds
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async completeTodo(input: CompleteTodoInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    const now = new Date();
    const nextTodos = [...log.todos];
    const targetTodo = nextTodos[targetIndex];
    const pausedSeconds = targetTodo.pausedAt
      ? Math.max(Math.floor((now.getTime() - targetTodo.pausedAt.getTime()) / 1000), 0)
      : 0;
    const startedAt = targetTodo.startedAt ?? now;
    const totalElapsedSeconds = Math.max(
      Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      0
    );
    const actualFocusSeconds = Math.max(
      totalElapsedSeconds - (targetTodo.deviationSeconds + pausedSeconds),
      0
    );

    nextTodos[targetIndex] = {
      ...targetTodo,
      done: true,
      startedAt,
      scheduledStartAt: null,
      pausedAt: null,
      completedAt: now,
      deviationSeconds: targetTodo.deviationSeconds + pausedSeconds,
      actualFocusSeconds
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async resetTodo(input: CompleteTodoInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    const targetTodo = log.todos[targetIndex];
    if (
      !targetTodo.done &&
      !targetTodo.startedAt &&
      !targetTodo.pausedAt &&
      !targetTodo.completedAt &&
      targetTodo.deviationSeconds === 0 &&
      targetTodo.actualFocusSeconds === null
    ) {
      return log;
    }

    const nextTodos = [...log.todos];
    nextTodos[targetIndex] = {
      ...targetTodo,
      done: false,
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      deviationSeconds: 0,
      actualFocusSeconds: null
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async deleteTodo(input: CompleteTodoInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    const nextTodos = log.todos
      .filter((todo) => todo.id !== input.todoId)
      .map((todo, index) => ({
        ...todo,
        order: index,
      }));

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async addDeviation(input: AddDeviationInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    const nextTodos = [...log.todos];
    const targetTodo = nextTodos[targetIndex];
    nextTodos[targetIndex] = {
      ...targetTodo,
      deviationSeconds: targetTodo.deviationSeconds + Math.max(input.seconds, 0)
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async updateTodoActualFocusSeconds(input: UpdateTodoActualFocusInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    if (!Number.isFinite(input.actualFocusSeconds)) {
      throw new Error("INVALID_ACTUAL_FOCUS_SECONDS");
    }
    const nextActualFocusSeconds = Math.max(Math.floor(input.actualFocusSeconds), 0);

    const nextTodos = [...log.todos];
    const targetTodo = nextTodos[targetIndex];
    if (!targetTodo.done) {
      throw new Error("TODO_NOT_DONE");
    }

    const startedAt = targetTodo.startedAt ?? targetTodo.completedAt ?? new Date();
    const deviationSeconds = Math.max(targetTodo.deviationSeconds, 0);
    const nextCompletedAt = new Date(
      startedAt.getTime() + (nextActualFocusSeconds + deviationSeconds) * 1000
    );

    nextTodos[targetIndex] = {
      ...targetTodo,
      startedAt,
      pausedAt: null,
      completedAt: nextCompletedAt,
      actualFocusSeconds: nextActualFocusSeconds
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async updateTodoSchedule(input: UpdateTodoScheduleInput) {
    const log = await this.repository.findByDate(input.userId, input.dateKey);
    if (!log) {
      throw new Error("DAILY_LOG_NOT_FOUND");
    }

    const targetIndex = log.todos.findIndex((todo) => todo.id === input.todoId);
    if (targetIndex < 0) {
      throw new Error("TODO_NOT_FOUND");
    }

    let nextScheduledStartAt: Date | null = null;
    if (input.scheduledStartAt) {
      nextScheduledStartAt = new Date(input.scheduledStartAt);
      if (Number.isNaN(nextScheduledStartAt.getTime())) {
        throw new Error("INVALID_SCHEDULED_START_AT");
      }

      if (input.dateKey === getTodayDateKey() && nextScheduledStartAt.getTime() <= Date.now()) {
        throw new Error("SCHEDULE_MUST_BE_FUTURE_FOR_TODAY");
      }
    }

    const nextTodos = [...log.todos];
    const targetTodo = nextTodos[targetIndex];
    nextTodos[targetIndex] = {
      ...targetTodo,
      scheduledStartAt: nextScheduledStartAt,
    };

    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
  }

  async startRestSession(input: RestSessionInput) {
    const log = await this.repository.upsertDailyLog({
      userId: input.userId,
      dateKey: input.dateKey,
      monthKey: getMonthKey(input.dateKey)
    });

    if (log.restStartedAt) {
      return log;
    }

    return this.repository.startRestSession(input.userId, input.dateKey, new Date());
  }

  async stopRestSession(input: RestSessionInput) {
    const log = await this.repository.upsertDailyLog({
      userId: input.userId,
      dateKey: input.dateKey,
      monthKey: getMonthKey(input.dateKey)
    });

    if (!log.restStartedAt) {
      return log;
    }

    const elapsedSeconds = Math.max(
      Math.floor((Date.now() - log.restStartedAt.getTime()) / 1000),
      0
    );
    const nextAccumulatedSeconds = log.restAccumulatedSeconds + elapsedSeconds;

    return this.repository.stopRestSession(
      input.userId,
      input.dateKey,
      nextAccumulatedSeconds
    );
  }
}

function hasAnotherInProgressTodo(todos: TodoItemRecord[], excludeTodoId: string) {
  return todos.some(
    (todo) => todo.id !== excludeTodoId && !todo.done && Boolean(todo.startedAt) && !todo.pausedAt
  );
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function parseScheduledStartAt(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_SCHEDULED_START_AT");
  }

  return parsed;
}
