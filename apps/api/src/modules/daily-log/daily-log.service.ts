import { randomUUID } from "node:crypto";
import { DailyLogRepository, type TodoItemRecord } from "./daily-log.repository.js";

interface BaseInput {
  userId: string;
  dateKey: string;
}

interface AddTodoInput extends BaseInput {
  content: string;
  order?: number | null;
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

    const todo: TodoItemRecord = {
      id: randomUUID(),
      content: input.content,
      done: false,
      order: input.order ?? log.todos.length,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      deviationSeconds: 0,
      actualFocusSeconds: null
    };

    const nextTodos = [...log.todos, todo];
    return this.repository.replaceTodos(input.userId, input.dateKey, nextTodos);
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
