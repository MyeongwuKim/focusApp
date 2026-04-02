import type { DailyLogsByMonthQuery } from "../graphql/generated.ts";
import type { GraphQLResponse } from "./graphqlResponse";

const DAILY_LOGS_BY_MONTH_QUERY = /* GraphQL */ `
  query DailyLogsByMonth($monthKey: String!) {
    dailyLogsByMonth(monthKey: $monthKey) {
      id
      userId
      dateKey
      monthKey
      memo
      todoCount
      doneCount
      previewTodos
      createdAt
      updatedAt
      todos {
        id
        content
        done
        order
        createdAt
        startedAt
        completedAt
        deviationSeconds
        actualFocusSeconds
      }
    }
  }
`;

export async function fetchDailyLogsByMonth(monthKey: string) {
  console.log(monthKey);
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: DAILY_LOGS_BY_MONTH_QUERY,
      variables: { monthKey },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily logs fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<DailyLogsByMonthQuery>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL dailyLogsByMonth failed");
  }
  return result.data?.dailyLogsByMonth ?? [];
}
