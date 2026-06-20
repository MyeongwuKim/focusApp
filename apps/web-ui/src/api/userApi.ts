import { MeDocument } from "../graphql/generated";
import { requestGraphqlOrNull } from "./graphqlClient";

export async function fetchMe(options?: { signal?: AbortSignal }) {
  const data = await requestGraphqlOrNull(MeDocument, undefined, {
    signal: options?.signal,
  });
  return data?.me ?? null;
}
