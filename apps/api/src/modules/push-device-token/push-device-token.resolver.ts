import { gql } from "graphql-tag";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import { requireUserId } from "../../common/utils/require-user-id.js";
import type { GraphQLContext } from "../../graphql/context.js";
import { PushDeviceTokenRepository } from "./push-device-token.repository.js";
import { PushDeviceTokenService } from "./push-device-token.service.js";

export const pushDeviceTokenTypeDefs = gql`
  type PushDeviceToken {
    id: ID!
    userId: ID!
    pushToken: String!
    platform: String!
    isActive: Boolean!
    lastSeenAt: String!
    createdAt: String!
    updatedAt: String!
  }

  input RegisterPushDeviceTokenInput {
    pushToken: String!
    platform: String!
  }

  input DeactivatePushDeviceTokenInput {
    pushToken: String!
  }

  extend type Mutation {
    registerPushDeviceToken(input: RegisterPushDeviceTokenInput!): PushDeviceToken!
    deactivatePushDeviceToken(input: DeactivatePushDeviceTokenInput!): Boolean!
  }
`;

const errorMapping = {
  PUSH_TOKEN_REQUIRED: { message: "푸쉬 토큰이 필요해요." },
  PUSH_TOKEN_INVALID: { message: "푸쉬 토큰 형식이 올바르지 않아요." },
};

export const pushDeviceTokenResolvers = {
  Mutation: {
    registerPushDeviceToken: async (
      _parent: unknown,
      args: { input: { pushToken: string; platform: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createPushDeviceTokenService(context);
        return await service.registerPushDeviceToken({
          userId: getUserId(context),
          pushToken: args.input.pushToken,
          platform: args.input.platform,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, errorMapping);
      }
    },
    deactivatePushDeviceToken: async (
      _parent: unknown,
      args: { input: { pushToken: string } },
      context: GraphQLContext
    ) => {
      try {
        const service = createPushDeviceTokenService(context);
        return await service.deactivatePushDeviceToken({
          userId: getUserId(context),
          pushToken: args.input.pushToken,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, errorMapping);
      }
    },
  },
  PushDeviceToken: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    lastSeenAt: (parent: { lastSeenAt: Date }) => parent.lastSeenAt.toISOString(),
  },
};

function createPushDeviceTokenService(context: GraphQLContext) {
  const repository = new PushDeviceTokenRepository(context.prisma);
  return new PushDeviceTokenService(repository);
}

function getUserId(context: GraphQLContext) {
  return requireUserId(context);
}
