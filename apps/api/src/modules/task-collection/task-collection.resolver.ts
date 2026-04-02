import { gql } from "graphql-tag";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import type { GraphQLContext } from "../../graphql/context.js";
import { createTaskCollectionService } from "./factory/create-task-collection-service.js";

export const taskCollectionTypeDefs = gql`
  type Task {
    id: ID!
    userId: String!
    collectionId: String!
    title: String!
    isArchived: Boolean!
    order: Int!
    lastUsedAt: String
    createdAt: String
    updatedAt: String
  }
  type TaskCollection {
    id: ID!
    userId: String!
    name: String!
    order: Int!
    createdAt: String!
    updatedAt: String!
    tasks: [Task!]!
  }

  input CreateTaskCollectionInput {
    name: String!
    order: Int
  }

  input AddTaskInput {
    collectionId: ID!
    title: String!
    order: Int
  }

  input DeleteTaskInput {
    taskId: ID!
  }

  input DeleteTaskCollectionInput {
    collectionId: ID!
  }

  extend type Query {
    taskCollections: [TaskCollection!]!
  }

  extend type Mutation {
    createTaskCollection(input: CreateTaskCollectionInput!): TaskCollection!
    addTask(input: AddTaskInput!): Task!
    deleteTask(input: DeleteTaskInput!): Boolean!
    deleteTaskCollection(input: DeleteTaskCollectionInput!): Boolean!
  }
`;

const taskCollectionErrorMapping = {
  TASK_COLLECTION_NOT_FOUND: { message: "태스크 컬렉션을 찾을 수 없어요." },
  TASK_NOT_FOUND: { message: "태스크를 찾을 수 없어요." },
  TASK_TITLE_REQUIRED: { message: "태스크 제목을 입력해 주세요." },
  TASK_TITLE_DUPLICATED: { message: "같은 컬렉션에 동일한 제목의 태스크가 이미 있어요." },
};

export const taskCollectionResolvers = {
  Query: {
    taskCollections: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const service = createTaskCollectionService(context);
      return service.getTaskCollections(getUserId(context));
    },
  },
  Mutation: {
    createTaskCollection: async (
      _parent: unknown,
      args: { input: { name: string; order?: number | null } },
      context: GraphQLContext
    ) => {
      const service = createTaskCollectionService(context);
      return service.createTaskCollection({
        userId: getUserId(context),
        name: args.input.name,
        order: args.input.order,
      });
    },
    addTask: async (
      _parent: unknown,
      args: { input: { collectionId: string; title: string; order?: number | null } },
      context: GraphQLContext
    ) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.addTask({
          userId: getUserId(context),
          collectionId: args.input.collectionId,
          title: args.input.title,
          order: args.input.order,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, taskCollectionErrorMapping);
      }
    },
    deleteTask: async (_parent: unknown, args: { input: { taskId: string } }, context: GraphQLContext) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.deleteTask({
          userId: getUserId(context),
          taskId: args.input.taskId,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, taskCollectionErrorMapping);
      }
    },
    deleteTaskCollection: async (
      _parent: unknown,
      args: { input: { collectionId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.deleteTaskCollection({
          userId: getUserId(context),
          collectionId: args.input.collectionId,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, taskCollectionErrorMapping);
      }
    },
  },
  TaskCollection: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
  },
  Task: {
    lastUsedAt: (parent: { lastUsedAt: Date | null }) =>
      parent.lastUsedAt ? parent.lastUsedAt.toISOString() : null,
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
  },
};

function getUserId(context: GraphQLContext) {
  return context.userId ?? "local-dev-user";
}
