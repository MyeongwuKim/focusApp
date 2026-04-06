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

      if (taskById.size !== uniqueTaskIds.length) {
        throw new Error("TASK_NOT_FOUND");
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
      const taskId = item.taskId ?? null;

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

    const nextTodos = [...log.todos];
    const targetTodo = nextTodos[targetIndex];
    nextTodos[targetIndex] = {
      ...targetTodo,
      done: false,
      startedAt: targetTodo.startedAt ?? new Date(),
      completedAt: null,
      actualFocusSeconds: null
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
    const startedAt = targetTodo.startedAt ?? now;
    const totalElapsedSeconds = Math.max(
      Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      0
    );
    const actualFocusSeconds = Math.max(totalElapsedSeconds - targetTodo.deviationSeconds, 0);

    nextTodos[targetIndex] = {
      ...targetTodo,
      done: true,
      startedAt,
      completedAt: now,
      actualFocusSeconds
    };

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
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}
