import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../graphql/context.js";
import { DailyLogRepository } from "./daily-log.repository.js";
import { DailyLogService } from "./daily-log.service.js";

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
    order: Int
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

function mapKnownError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "DAILY_LOG_NOT_FOUND") {
      throw new GraphQLError("Daily log not found", {
        extensions: { code: "BAD_USER_INPUT" }
      });
    }

    if (error.message === "TODO_NOT_FOUND") {
      throw new GraphQLError("Todo not found", {
        extensions: { code: "BAD_USER_INPUT" }
      });
    }
  }

  throw error;
}

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
          order: args.input.order
        });
      } catch (error) {
        mapKnownError(error);
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
        mapKnownError(error);
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
        mapKnownError(error);
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
        mapKnownError(error);
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
