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

  extend type Query {
    dailyLog(dateKey: String!): DailyLog
    dailyLogsByMonth(monthKey: String!): [DailyLog!]!
  }

  extend type Mutation {
    upsertDailyLog(input: UpsertDailyLogInput!): DailyLog!
    addTodo(input: AddTodoInput!): DailyLog!
    addTodos(input: AddTodosInput!): DailyLog!
    startTodo(input: TodoActionInput!): DailyLog!
    completeTodo(input: TodoActionInput!): DailyLog!
    addDeviation(input: AddDeviationInput!): DailyLog!
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
  TASK_NOT_FOUND: { message: "태스크를 찾을 수 없어요." }
};

export const dailyLogResolvers = {
  Query: {
    dailyLog: async (_parent: unknown, args: { dateKey: string }, context: GraphQLContext) => {
      const service = buildService(context);
      return service.getDailyLog(getUserId(context), args.dateKey);
    },
    dailyLogsByMonth: async (
      _parent: unknown,
      args: { monthKey: string },
      context: GraphQLContext
    ) => {
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
        memo: args.input.memo
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
          order: args.input.order
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
          items: args.input.items
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
          todoId: args.input.todoId
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
          todoId: args.input.todoId
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
          seconds: args.input.seconds
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, dailyLogErrorMapping);
      }
    }
  },
  DailyLog: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString()
  },
  TodoItem: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    startedAt: (parent: { startedAt: Date | null }) => toISOStringOrNull(parent.startedAt),
    completedAt: (parent: { completedAt: Date | null }) => toISOStringOrNull(parent.completedAt)
  }
};

function getUserId(context: GraphQLContext) {
  return context.userId ?? "local-dev-user";
}
