import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      email
    }
  }
`;

type MePayload = {
  me: {
    id: string;
    email: string;
  } | null;
};

export async function fetchMe(options?: { signal?: AbortSignal }) {
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ query: ME_QUERY }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Me fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MePayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL me failed");
  }

  return result.data?.me ?? null;
}
