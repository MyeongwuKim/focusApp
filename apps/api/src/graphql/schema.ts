import { gql } from "graphql-tag";
import { dailyLogResolvers, dailyLogTypeDefs } from "../modules/daily-log/daily-log.resolver.js";
import { userResolvers, userTypeDefs } from "../modules/user/user.resolver.js";
import {
  taskCollectionResolvers,
  taskCollectionTypeDefs
} from "../modules/task-collection/task-collection.resolver.js";

type ResolverRecord = Record<string, Record<string, unknown>>;

function mergeResolvers(...resolverGroups: ResolverRecord[]): ResolverRecord {
  return resolverGroups.reduce<ResolverRecord>((acc, current) => {
    for (const key of Object.keys(current)) {
      acc[key] = {
        ...(acc[key] ?? {}),
        ...current[key],
      };
    }
    return acc;
  }, {});
}

export const typeDefs = [
  gql`
    schema {
      query: Query
      mutation: Mutation
    }

    type Query {
      _empty: String
    }
  `,

  dailyLogTypeDefs,
  userTypeDefs,
  taskCollectionTypeDefs,
];

export const resolvers = mergeResolvers(dailyLogResolvers, userResolvers, taskCollectionResolvers);
