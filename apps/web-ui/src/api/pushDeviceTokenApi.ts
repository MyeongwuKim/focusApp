import { buildAuthHeaders } from "./authHeaders";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

export type RegisterPushDeviceTokenInput = {
  pushToken: string;
  platform: "ios" | "android" | "unknown";
};

const REGISTER_PUSH_DEVICE_TOKEN_MUTATION = /* GraphQL */ `
  mutation RegisterPushDeviceToken($input: RegisterPushDeviceTokenInput!) {
    registerPushDeviceToken(input: $input) {
      id
      pushToken
      platform
      isActive
      updatedAt
    }
  }
`;

type RegisterPushDeviceTokenPayload = {
  registerPushDeviceToken: {
    id: string;
    pushToken: string;
    platform: string;
    isActive: boolean;
    updatedAt: string;
  };
};

export async function registerPushDeviceToken(input: RegisterPushDeviceTokenInput) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: REGISTER_PUSH_DEVICE_TOKEN_MUTATION,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Push token register failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<RegisterPushDeviceTokenPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL registerPushDeviceToken failed");
  }

  const tokenInfo = result.data?.registerPushDeviceToken;
  if (!tokenInfo) {
    throw new Error("GraphQL registerPushDeviceToken failed");
  }

  return tokenInfo;
}
