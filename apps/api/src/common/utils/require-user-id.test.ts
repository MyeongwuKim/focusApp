import { GraphQLError } from "graphql";
import { describe, expect, it } from "vitest";
import { requireUserId } from "./require-user-id.js";

describe("requireUserId", () => {
  it("userId가 있으면 그대로 반환한다", () => {
    expect(requireUserId({ userId: "user-1" })).toBe("user-1");
  });

  it("userId가 없으면 UNAUTHORIZED 에러를 던진다", () => {
    try {
      requireUserId({ userId: null });
      throw new Error("expected error");
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError);
      expect(error).toMatchObject({
        message: "로그인이 필요해요.",
        extensions: { code: "UNAUTHORIZED" },
      });
    }
  });
});
