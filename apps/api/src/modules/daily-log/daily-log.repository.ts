import type { PrismaClient } from "@prisma/client";

export interface UpsertDailyLogInput {
  userId: string;
  dateKey: string;
  monthKey: string;
  memo?: string | null;
}

export interface TodoItemRecord {
  id: string;
  taskId?: string | null;
  titleSnapshot?: string | null;
  content: string;
  done: boolean;
  order: number;
  createdAt: Date;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  deviationSeconds: number;
  actualFocusSeconds: number | null;
}

export class DailyLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByDate(userId: string, dateKey: string) {
    return this.prisma.dailyLog.findUnique({
      where: {
        userId_dateKey: {
          userId,
          dateKey
        }
      }
    });
  }

  findByMonth(userId: string, monthKey: string) {
    return this.prisma.dailyLog.findMany({
      where: {
        userId,
        monthKey
      },
      orderBy: {
        dateKey: "asc"
      }
    });
  }

  upsertDailyLog(input: UpsertDailyLogInput) {
    return this.prisma.dailyLog.upsert({
      where: {
        userId_dateKey: {
          userId: input.userId,
          dateKey: input.dateKey
        }
      },
      create: {
        userId: input.userId,
        dateKey: input.dateKey,
        monthKey: input.monthKey,
        memo: input.memo ?? null,
        todos: [],
        todoCount: 0,
        doneCount: 0,
        previewTodos: []
      },
      update: {
        monthKey: input.monthKey,
        ...(input.memo !== undefined ? { memo: input.memo } : {})
      }
    });
  }

  updateMemo(userId: string, dateKey: string, memo: string | null) {
    return this.prisma.dailyLog.update({
      where: {
        userId_dateKey: {
          userId,
          dateKey
        }
      },
      data: { memo }
    });
  }

  replaceTodos(userId: string, dateKey: string, todos: TodoItemRecord[]) {
    const todoCount = todos.length;
    const doneCount = todos.filter((todo) => todo.done).length;
    const previewTodos = todos
      .slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, 3)
      .map((todo) => todo.content);

    return this.prisma.dailyLog.update({
      where: {
        userId_dateKey: {
          userId,
          dateKey
        }
      },
      data: {
        todos: todos as never,
        todoCount,
        doneCount,
        previewTodos
      }
    });
  }

  startRestSession(userId: string, dateKey: string, startedAt: Date) {
    return this.prisma.dailyLog.update({
      where: {
        userId_dateKey: {
          userId,
          dateKey
        }
      },
      data: {
        restStartedAt: startedAt
      }
    });
  }

  stopRestSession(userId: string, dateKey: string, nextAccumulatedSeconds: number) {
    return this.prisma.dailyLog.update({
      where: {
        userId_dateKey: {
          userId,
          dateKey
        }
      },
      data: {
        restAccumulatedSeconds: nextAccumulatedSeconds,
        restStartedAt: null
      }
    });
  }

  findTaskById(userId: string, taskId: string) {
    return this.prisma.task.findFirst({
      where: {
        id: taskId,
        userId
      }
    });
  }

  findTasksByIds(userId: string, taskIds: string[]) {
    return this.prisma.task.findMany({
      where: {
        userId,
        id: {
          in: taskIds
        }
      }
    });
  }

  updateTaskLastUsedAt(userId: string, taskId: string, lastUsedAt: Date) {
    return this.prisma.task.update({
      where: {
        id: taskId
      },
      data: {
        lastUsedAt
      }
    });
  }
}
