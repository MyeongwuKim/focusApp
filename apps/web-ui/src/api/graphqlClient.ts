import type { TypedDocumentString } from "../graphql/generated";
import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

type RequestGraphqlOptions = {
  signal?: AbortSignal;
};

type RequestVariables<TVariables> = {} extends TVariables
  ? [] | [TVariables] | [TVariables | undefined, RequestGraphqlOptions]
  : [TVariables] | [TVariables, RequestGraphqlOptions];

export async function requestGraphql<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  ...variablesInput: RequestVariables<TVariables>
) {
  const data = await executeGraphql(document, variablesInput, {
    returnNullOnUnauthorized: false,
  });

  if (!data) {
    throw new Error("GraphQL response data is empty");
  }

  return data;
}

export async function requestGraphqlOrNull<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  ...variablesInput: RequestVariables<TVariables>
) {
  return executeGraphql(document, variablesInput, {
    returnNullOnUnauthorized: true,
  });
}

async function executeGraphql<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  variablesInput: RequestVariables<TVariables>,
  options: { returnNullOnUnauthorized: boolean }
) {
  const variables = variablesInput[0];
  const requestOptions = variablesInput[1];
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    signal: requestOptions?.signal,
    body: JSON.stringify({
      query: document.toString(),
      ...(variables === undefined ? {} : { variables }),
    }),
  });

  if (response.status === 401 && options.returnNullOnUnauthorized) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<TResult>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL request failed");
  }

  if (!result.data) {
    throw new Error("GraphQL response data is empty");
  }

  return result.data;
}
