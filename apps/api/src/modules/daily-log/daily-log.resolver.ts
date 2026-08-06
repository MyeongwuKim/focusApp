import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../graphql/context.js";
import { DailyLogRepository } from "./daily-log.repository.js";
import { DailyLogService } from "./daily-log.service.js";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import { requireUserId } from "../../common/utils/require-user-id.js";
import { refreshReminderScheduleForUser } from "../notification-batch/notification-reminder-schedule.js";
import { env } from "../../config/env.js";

export const dailyLogTypeDefs = gql`
  type TodoItem {
    id: ID!
    taskId: ID
    titleSnapshot: String
    content: String!
    done: Boolean!
    order: Int!
    createdAt: String!
    startedAt: String
    scheduledStartAt: String
    targetFocusMinutes: Int
    pausedAt: String
    completedAt: String
    deviationSeconds: Int!
    resumeCount: Int!
    actualFocusSeconds: Int
    muteReminderDateKey: String
  }

  type DailyLog {
    id: ID!
    userId: ID!
    dateKey: String!
    monthKey: String!
    memo: String
    todos: [TodoItem!]!
    restAccumulatedSeconds: Int!
    restStartedAt: String
    todoCount: Int!
    doneCount: Int!
    previewTodos: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  type DailyLogMemoConnection {
    items: [DailyLog!]!
    nextCursorDateKey: String
    hasNextPage: Boolean!
  }

  input UpsertDailyLogInput {
    dateKey: String!
    memo: String
  }

  input AddTodoInput {
    dateKey: String!
    content: String!
    taskId: ID
    order: Int
  }

  input AddTodoItemInput {
    content: String!
    taskId: ID
    scheduledStartAt: String
  }

  input AddTodosInput {
    dateKey: String!
    items: [AddTodoItemInput!]!
  }

  input TodoActionInput {
    dateKey: String!
    todoId: ID!
  }

  input ReorderTodosInput {
    dateKey: String!
    todoIds: [ID!]!
  }

  input RestSessionInput {
    dateKey: String!
  }

  input UpdateTodoActualFocusInput {
    dateKey: String!
    todoId: ID!
    actualFocusSeconds: Int!
  }

  input UpdateTodoScheduleInput {
    dateKey: String!
    todoId: ID!
    scheduledStartAt: String
  }

  input UpdateTodoTargetFocusInput {
    dateKey: String!
    todoId: ID!
    targetFocusMinutes: Int
  }

  extend type Query {
    dailyLog(dateKey: String!): DailyLog
    dailyLogsByMonth(monthKey: String!): [DailyLog!]!
    dailyLogsWithMemo(
      limit: Int
      cursorDateKey: String
      monthKey: String
      search: String
      sortOrder: String
    ): DailyLogMemoConnection!
  }

  extend type Mutation {
    upsertDailyLog(input: UpsertDailyLogInput!): DailyLog!
    addTodo(input: AddTodoInput!): DailyLog!
    addTodos(input: AddTodosInput!): DailyLog!
    startTodo(input: TodoActionInput!): DailyLog!
    pauseTodo(input: TodoActionInput!): DailyLog!
    resumeTodo(input: TodoActionInput!): DailyLog!
    completeTodo(input: TodoActionInput!): DailyLog!
    resetTodo(input: TodoActionInput!): DailyLog!
    deleteTodo(input: TodoActionInput!): DailyLog!
    reorderTodos(input: ReorderTodosInput!): DailyLog!
    updateTodoActualFocus(input: UpdateTodoActualFocusInput!): DailyLog!
    updateTodoSchedule(input: UpdateTodoScheduleInput!): DailyLog!
    updateTodoTargetFocus(input: UpdateTodoTargetFocusInput!): DailyLog!
    muteTodoReminderToday(input: TodoActionInput!): DailyLog!
    unmuteTodoReminder(input: TodoActionInput!): DailyLog!
    startRestSession(input: RestSessionInput!): DailyLog!
    stopRestSession(input: RestSessionInput!): DailyLog!
  }
`;

function buildService(context: GraphQLContext) {
  const repository = new DailyLogRepository(context.prisma);
  return new DailyLogService(repository, env.NOTIFICATION_BATCH_TIMEZONE);
}

function toISOStringOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

const dailyLogErrorMapping = {
  DAILY_LOG_NOT_FOUND: { message: "데일리 로그를 찾을 수 없어요." },
  TODO_NOT_FOUND: { message: "할일을 찾을 수 없어요." },
  ANOTHER_TODO_ALREADY_IN_PROGRESS: { message: "진행 중인 할일이 있어요." },
  FUTURE_TODO_CANNOT_START: { message: "미래 날짜의 할일은 시작하거나 재개할 수 없어요." },
  TODO_NOT_IN_PROGRESS: { message: "진행 중인 할일이 아니에요." },
  TODO_NOT_DONE: { message: "완료된 할일만 수정할 수 있어요." },
  INVALID_TODO_ORDER_IDS: { message: "정렬할 할일 목록이 올바르지 않아요." },
  INVALID_ACTUAL_FOCUS_SECONDS: { message: "집중 시간이 올바르지 않아요." },
  INVALID_SCHEDULED_START_AT: { message: "시작 예정 시간이 올바르지 않아요." },
  INVALID_TARGET_FOCUS_MINUTES: { message: "목표 집중 시간은 1분 이상으로 설정해 주세요." },
  SCHEDULE_MUST_BE_FUTURE_FOR_TODAY: { message: "오늘 일정은 현재 시각 이후로만 설정할 수 있어요." },
  TASK_NOT_FOUND: { message: "태스크를 찾을 수 없어요." },
};

export const dailyLogResolvers = {
  Query: {
    dailyLog: async (_parent: unknown, args: { dateKey: string }, context: GraphQLContext) => {
      const service = buildService(context);
      return service.getDailyLog(getUserId(context), args.dateKey);
    },
    dailyLogsByMonth: async (_parent: unknown, args: { monthKey: string }, context: GraphQLContext) => {
      const service = buildService(context);
      return service.getDailyLogsByMonth(getUserId(context), args.monthKey);
    },
    dailyLogsWithMemo: async (
      _parent: unknown,
      args: {
        limit?: number | null;
        cursorDateKey?: string | null;
        monthKey?: string | null;
        search?: string | null;
        sortOrder?: string | null;
      },
      context: GraphQLContext
    ) => {
      const service = buildService(context);
      return service.getDailyLogsWithMemo({
        userId: getUserId(context),
        limit: args.limit,
        cursorDateKey: args.cursorDateKey,
        monthKey: args.monthKey,
        search: args.search,
        sortOrder: args.sortOrder,
      });
    },
  },
  Mutation: {
    upsertDailyLog: async (
      _parent: unknown,
      args: {
        input: { dateKey: string; memo?: string | null };
      },
      context: GraphQLContext
    ) => {
      const service = buildService(context);
      const userId = getUserId(context);
      const result = await service.upsertDailyLog({
        userId,
        dateKey: args.input.dateKey,
        memo: args.input.memo,
      });
      await refreshReminderScheduleForUser({
        prisma: context.prisma,
        userId,
        timezone: env.NOTIFICATION_BATCH_TIMEZONE,
      });
      return result;
    },
    addTodo: async (
      _parent: unknown,
      args: {
        input: {
          dateKey: string;
          content: string;
          taskId?: string | null;
          order?: number | null;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.addTodo({
          userId,
          dateKey: args.input.dateKey,
          content: args.input.content,
          taskId: args.input.taskId,
          order: args.input.order,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    addTodos: async (
      _parent: unknown,
      args: {
        input: {
          dateKey: string;
          items: Array<{
            content: string;
            taskId?: string | null;
            scheduledStartAt?: string | null;
          }>;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.addTodos({
          userId,
          dateKey: args.input.dateKey,
          items: args.input.items,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    startTodo: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.startTodo({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    pauseTodo: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.pauseTodo({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    resumeTodo: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.resumeTodo({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    completeTodo: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.completeTodo({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    resetTodo: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.resetTodo({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    deleteTodo: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.deleteTodo({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    reorderTodos: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoIds: string[] } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.reorderTodos({
          userId,
          dateKey: args.input.dateKey,
          todoIds: args.input.todoIds,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    updateTodoActualFocus: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string; actualFocusSeconds: number } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.updateTodoActualFocusSeconds({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
          actualFocusSeconds: args.input.actualFocusSeconds,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    updateTodoSchedule: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string; scheduledStartAt: string | null } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.updateTodoSchedule({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
          scheduledStartAt: args.input.scheduledStartAt,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    updateTodoTargetFocus: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string; targetFocusMinutes: number | null } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        return await service.updateTodoTargetFocus({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
          targetFocusMinutes: args.input.targetFocusMinutes ?? null,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    muteTodoReminderToday: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.muteTodoReminderToday({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    unmuteTodoReminder: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        const userId = getUserId(context);
        const result = await service.unmuteTodoReminder({
          userId,
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        });
        return result;
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    startRestSession: async (
      _parent: unknown,
      args: { input: { dateKey: string } },
      context: GraphQLContext
    ) => {
      const service = buildService(context);
      return service.startRestSession({
        userId: getUserId(context),
        dateKey: args.input.dateKey,
      });
    },
    stopRestSession: async (
      _parent: unknown,
      args: { input: { dateKey: string } },
      context: GraphQLContext
    ) => {
      const service = buildService(context);
      return service.stopRestSession({
        userId: getUserId(context),
        dateKey: args.input.dateKey,
      });
    },
  },
  DailyLog: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    restStartedAt: (parent: { restStartedAt: Date | null }) => toISOStringOrNull(parent.restStartedAt),
  },
  TodoItem: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    startedAt: (parent: { startedAt: Date | null }) => toISOStringOrNull(parent.startedAt),
    scheduledStartAt: (parent: { scheduledStartAt: Date | null }) =>
      toISOStringOrNull(parent.scheduledStartAt),
    pausedAt: (parent: { pausedAt: Date | null }) => toISOStringOrNull(parent.pausedAt),
    completedAt: (parent: { completedAt: Date | null }) => toISOStringOrNull(parent.completedAt),
    muteReminderDateKey: (parent: { muteReminderDateKey?: string | null }) =>
      typeof parent.muteReminderDateKey === "string" ? parent.muteReminderDateKey : null,
  },
};

function getUserId(context: GraphQLContext) {
  return requireUserId(context);
}
