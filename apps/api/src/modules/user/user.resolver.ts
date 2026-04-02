import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../graphql/context.js";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

const userTypeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateUserInput {
    email: String!
    name: String
  }

  extend type Query {
    me: User
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
  }
`;

const userResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const userRepository = new UserRepository(context.prisma);
      const userService = new UserService(userRepository);
      return userService.getMe(context.userId);
    },
  },
  Mutation: {
    createUser: async (
      _parent: unknown,
      args: { input: { email: string; name?: string | null } },
      context: GraphQLContext
    ) => {
      try {
        const userRepository = new UserRepository(context.prisma);
        const userService = new UserService(userRepository);
        return await userService.createUser(args.input);
      } catch (error) {
        rethrowMappedGraphQLError(error, {
          EMAIL_ALREADY_EXISTS: { message: "Email already exists" }
        });
      }
    },
  },
};

export { userResolvers, userTypeDefs };
