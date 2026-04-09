import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../graphql/context.js";
import { DailyLogRepository } from "./daily-log.repository.js";
import { DailyLogService } from "./daily-log.service.js";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";

export const dailyLogTypeDefs = gql`
  type TodoItem {
    id: ID!
    content: String!
    done: Boolean!
    order: Int!
    createdAt: String!
    startedAt: String
    scheduledStartAt: String
    pausedAt: String
    completedAt: String
    deviationSeconds: Int!
    actualFocusSeconds: Int
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

  input AddDeviationInput {
    dateKey: String!
    todoId: ID!
    seconds: Int!
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

  extend type Query {
    dailyLog(dateKey: String!): DailyLog
    dailyLogsByMonth(monthKey: String!): [DailyLog!]!
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
    addDeviation(input: AddDeviationInput!): DailyLog!
    updateTodoActualFocus(input: UpdateTodoActualFocusInput!): DailyLog!
    updateTodoSchedule(input: UpdateTodoScheduleInput!): DailyLog!
    startRestSession(input: RestSessionInput!): DailyLog!
    stopRestSession(input: RestSessionInput!): DailyLog!
  }
`;

function buildService(context: GraphQLContext) {
  const repository = new DailyLogRepository(context.prisma);
  return new DailyLogService(repository);
}

function toISOStringOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

const dailyLogErrorMapping = {
  DAILY_LOG_NOT_FOUND: { message: "데일리 로그를 찾을 수 없어요." },
  TODO_NOT_FOUND: { message: "할일을 찾을 수 없어요." },
  ANOTHER_TODO_ALREADY_IN_PROGRESS: { message: "진행 중인 할일이 있어요." },
  TODO_NOT_IN_PROGRESS: { message: "진행 중인 할일이 아니에요." },
  TODO_NOT_DONE: { message: "완료된 할일만 수정할 수 있어요." },
  INVALID_ACTUAL_FOCUS_SECONDS: { message: "집중 시간이 올바르지 않아요." },
  INVALID_SCHEDULED_START_AT: { message: "시작 예정 시간이 올바르지 않아요." },
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
      return service.upsertDailyLog({
        userId: getUserId(context),
        dateKey: args.input.dateKey,
        memo: args.input.memo,
      });
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
        return await service.addTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          content: args.input.content,
          taskId: args.input.taskId,
          order: args.input.order,
        });
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
        return await service.addTodos({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          items: args.input.items,
        });
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
        return await service.startTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
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
        return await service.pauseTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
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
        return await service.resumeTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
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
        return await service.completeTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
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
        return await service.resetTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
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
        return await service.deleteTodo({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    },
    addDeviation: async (
      _parent: unknown,
      args: { input: { dateKey: string; todoId: string; seconds: number } },
      context: GraphQLContext
    ) => {
      try {
        const service = buildService(context);
        return await service.addDeviation({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
          seconds: args.input.seconds,
        });
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
        return await service.updateTodoActualFocusSeconds({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
          actualFocusSeconds: args.input.actualFocusSeconds,
        });
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
        return await service.updateTodoSchedule({
          userId: getUserId(context),
          dateKey: args.input.dateKey,
          todoId: args.input.todoId,
          scheduledStartAt: args.input.scheduledStartAt,
        });
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
  },
};

function getUserId(context: GraphQLContext) {
  return context.userId ?? "local-dev-user";
}
