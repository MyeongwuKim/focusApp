import { GraphQLError } from "graphql";

type AuthContextLike = {
  userId: string | null;
};

export function requireUserId(context: AuthContextLike) {
  if (!context.userId) {
    throw new GraphQLError("로그인이 필요해요.", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }

  return context.userId;
}
