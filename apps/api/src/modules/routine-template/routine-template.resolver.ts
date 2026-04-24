import { gql } from "graphql-tag";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import { requireUserId } from "../../common/utils/require-user-id.js";
import type { GraphQLContext } from "../../graphql/context.js";
import { createRoutineTemplateService } from "./factory/create-routine-template-service.js";

export const routineTemplateTypeDefs = gql`
  type RoutineTemplateItem {
    id: ID!
    taskId: ID
    titleSnapshot: String
    content: String!
    order: Int!
    scheduledTimeHHmm: String
  }

  type RoutineTemplate {
    id: ID!
    userId: ID!
    name: String!
    items: [RoutineTemplateItem!]!
    createdAt: String!
    updatedAt: String!
  }

  input RoutineTemplateItemInput {
    id: ID
    taskId: ID
    titleSnapshot: String
    content: String!
    order: Int
    scheduledTimeHHmm: String
  }

  input CreateRoutineTemplateInput {
    name: String!
    items: [RoutineTemplateItemInput!]!
  }

  input UpdateRoutineTemplateInput {
    routineTemplateId: ID!
    name: String
    items: [RoutineTemplateItemInput!]
  }

  input DeleteRoutineTemplateInput {
    routineTemplateId: ID!
  }

  extend type Query {
    routineTemplates: [RoutineTemplate!]!
  }

  extend type Mutation {
    createRoutineTemplate(input: CreateRoutineTemplateInput!): RoutineTemplate!
    updateRoutineTemplate(input: UpdateRoutineTemplateInput!): RoutineTemplate!
    deleteRoutineTemplate(input: DeleteRoutineTemplateInput!): Boolean!
  }
`;

const routineTemplateErrorMapping = {
  ROUTINE_TEMPLATE_NOT_FOUND: { message: "루틴 템플릿을 찾을 수 없어요." },
  ROUTINE_TEMPLATE_NAME_REQUIRED: { message: "루틴 이름을 입력해 주세요." },
  ROUTINE_TEMPLATE_NAME_DUPLICATED: { message: "같은 이름의 루틴이 이미 있어요." },
  ROUTINE_TEMPLATE_ITEMS_REQUIRED: { message: "루틴 항목을 1개 이상 추가해 주세요." },
  ROUTINE_TEMPLATE_ITEM_CONTENT_REQUIRED: { message: "루틴 항목 내용을 입력해 주세요." },
  ROUTINE_TEMPLATE_ITEM_TIME_INVALID: { message: "시작 시간은 HH:mm 형식으로 입력해 주세요." },
};

export const routineTemplateResolvers = {
  Query: {
    routineTemplates: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const service = createRoutineTemplateService(context);
      return service.getRoutineTemplates(getUserId(context));
    },
  },
  Mutation: {
    createRoutineTemplate: async (
      _parent: unknown,
      args: {
        input: {
          name: string;
          items: Array<{
            id?: string | null;
            taskId?: string | null;
            titleSnapshot?: string | null;
            content: string;
            order?: number | null;
            scheduledTimeHHmm?: string | null;
          }>;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const service = createRoutineTemplateService(context);
        return await service.createRoutineTemplate({
          userId: getUserId(context),
          name: args.input.name,
          items: args.input.items,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, routineTemplateErrorMapping);
      }
    },
    updateRoutineTemplate: async (
      _parent: unknown,
      args: {
        input: {
          routineTemplateId: string;
          name?: string | null;
          items?: Array<{
            id?: string | null;
            taskId?: string | null;
            titleSnapshot?: string | null;
            content: string;
            order?: number | null;
            scheduledTimeHHmm?: string | null;
          }> | null;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const service = createRoutineTemplateService(context);
        return await service.updateRoutineTemplate({
          userId: getUserId(context),
          routineTemplateId: args.input.routineTemplateId,
          name: args.input.name,
          items: args.input.items,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, routineTemplateErrorMapping);
      }
    },
    deleteRoutineTemplate: async (
      _parent: unknown,
      args: { input: { routineTemplateId: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createRoutineTemplateService(context);
        return await service.deleteRoutineTemplate({
          userId: getUserId(context),
          routineTemplateId: args.input.routineTemplateId,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, routineTemplateErrorMapping);
      }
    },
  },
  RoutineTemplate: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
  },
};

function getUserId(context: GraphQLContext) {
  return requireUserId(context);
}
