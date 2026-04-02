import { GraphQLError } from "graphql";

interface GraphQLErrorMappingItem {
  message: string;
  code?: string;
}

type GraphQLErrorMapping = Record<string, GraphQLErrorMappingItem>;

export function rethrowMappedGraphQLError(error: unknown, mapping: GraphQLErrorMapping): never {
  if (error instanceof Error) {
    const matched = mapping[error.message];
    if (matched) {
      throw new GraphQLError(matched.message, {
        extensions: { code: matched.code ?? "BAD_USER_INPUT" }
      });
    }
  }

  throw error;
}
