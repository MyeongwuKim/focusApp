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
    isFavorite: Boolean!
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

  input MoveTaskToCollectionInput {
    taskId: ID!
    collectionId: ID!
  }

  input ReorderTaskCollectionsInput {
    collectionIds: [ID!]!
  }

  input ReorderTasksInput {
    taskIds: [ID!]!
  }

  input RenameTaskInput {
    taskId: ID!
    title: String!
  }

  input RenameTaskCollectionInput {
    collectionId: ID!
    name: String!
  }

  input SetTaskFavoriteInput {
    taskId: ID!
    isFavorite: Boolean!
  }

  extend type Query {
    taskCollections: [TaskCollection!]!
  }

  extend type Mutation {
    createTaskCollection(input: CreateTaskCollectionInput!): TaskCollection!
    addTask(input: AddTaskInput!): Task!
    moveTaskToCollection(input: MoveTaskToCollectionInput!): Task!
    reorderTaskCollections(input: ReorderTaskCollectionsInput!): Boolean!
    reorderTasks(input: ReorderTasksInput!): Boolean!
    renameTask(input: RenameTaskInput!): Task!
    renameTaskCollection(input: RenameTaskCollectionInput!): TaskCollection!
    setTaskFavorite(input: SetTaskFavoriteInput!): Task!
    deleteTask(input: DeleteTaskInput!): Boolean!
    deleteTaskCollection(input: DeleteTaskCollectionInput!): Boolean!
  }
`;

const taskCollectionErrorMapping = {
  TASK_COLLECTION_NOT_FOUND: { message: "태스크 컬렉션을 찾을 수 없어요." },
  TASK_NOT_FOUND: { message: "태스크를 찾을 수 없어요." },
  TASK_TITLE_REQUIRED: { message: "태스크 제목을 입력해 주세요." },
  TASK_TITLE_DUPLICATED: { message: "같은 컬렉션에 동일한 제목의 태스크가 이미 있어요." },
  TASK_COLLECTION_NAME_REQUIRED: { message: "컬렉션 이름을 입력해 주세요." },
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
    moveTaskToCollection: async (
      _parent: unknown,
      args: { input: { taskId: string; collectionId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.moveTaskToCollection({
          userId: getUserId(context),
          taskId: args.input.taskId,
          collectionId: args.input.collectionId,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, taskCollectionErrorMapping);
      }
    },
    reorderTaskCollections: async (
      _parent: unknown,
      args: { input: { collectionIds: string[] } },
      context: GraphQLContext
    ) => {
      const service = createTaskCollectionService(context);
      return service.reorderTaskCollections({
        userId: getUserId(context),
        collectionIds: args.input.collectionIds,
      });
    },
    reorderTasks: async (
      _parent: unknown,
      args: { input: { taskIds: string[] } },
      context: GraphQLContext
    ) => {
      const service = createTaskCollectionService(context);
      return service.reorderTasks({
        userId: getUserId(context),
        taskIds: args.input.taskIds,
      });
    },
    renameTask: async (
      _parent: unknown,
      args: { input: { taskId: string; title: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.renameTask({
          userId: getUserId(context),
          taskId: args.input.taskId,
          title: args.input.title,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, taskCollectionErrorMapping);
      }
    },
    renameTaskCollection: async (
      _parent: unknown,
      args: { input: { collectionId: string; name: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.renameTaskCollection({
          userId: getUserId(context),
          collectionId: args.input.collectionId,
          name: args.input.name,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, taskCollectionErrorMapping);
      }
    },
    setTaskFavorite: async (
      _parent: unknown,
      args: { input: { taskId: string; isFavorite: boolean } },
      context: GraphQLContext
    ) => {
      try {
        const service = createTaskCollectionService(context);
        return await service.setTaskFavorite({
          userId: getUserId(context),
          taskId: args.input.taskId,
          isFavorite: args.input.isFavorite,
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
    isFavorite: (parent: { isFavorite: boolean | null | undefined }) => Boolean(parent.isFavorite),
    lastUsedAt: (parent: { lastUsedAt: Date | null }) =>
      parent.lastUsedAt ? parent.lastUsedAt.toISOString() : null,
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
  },
};

function getUserId(context: GraphQLContext) {
  return context.userId ?? "local-dev-user";
}
