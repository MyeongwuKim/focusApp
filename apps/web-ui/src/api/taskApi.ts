import type {
  AddTaskInput,
  CreateTaskCollectionInput,
  Mutation,
  TaskCollectionsQuery,
} from "../graphql/generated.ts";
import type { GraphQLResponse } from "./graphqlResponse";

const TASK_COLLECTIONS_QUERY = /* GraphQL */ `
  query TaskCollections {
    taskCollections {
      id
      name
      order
      createdAt
      updatedAt
      tasks {
        id
        userId
        collectionId
        title
        isArchived
        order
        lastUsedAt
        createdAt
        updatedAt
      }
    }
  }
`;

export const addTaskQuery = /* GraphQL */ `
  mutation AddTask($input: AddTaskInput!) {
    addTask(input: $input) {
      id
      collectionId
      title
      order
      lastUsedAt
    }
  }
`;

export const addTaskCollectionQuery = /* GraphQL */ `
  mutation CreateTaskCollection($input: CreateTaskCollectionInput!) {
    createTaskCollection(input: $input) {
      id
      name
      order
    }
  }
`;

export const deleteTaskQuery = /* GraphQL */ `
  mutation DeleteTask($input: DeleteTaskInput!) {
    deleteTask(input: $input)
  }
`;

export const deleteTaskCollectionQuery = /* GraphQL */ `
  mutation DeleteTaskCollection($input: DeleteTaskCollectionInput!) {
    deleteTaskCollection(input: $input)
  }
`;

export async function fetchTaskCollections() {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: TASK_COLLECTIONS_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Task collections fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<TaskCollectionsQuery>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL taskCollections failed");
  }

  return result.data?.taskCollections ?? [];
}

type MutationType = {
  createTaskCollection: Pick<Mutation["createTaskCollection"], "id" | "name" | "order">;
  addTask: Pick<Mutation["addTask"], "id" | "collectionId" | "order" | "title" | "lastUsedAt">;
  deleteTask: boolean;
  deleteTaskCollection: boolean;
};

export async function addTaskCollection(input: CreateTaskCollectionInput) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: addTaskCollectionQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task collection create failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL createTaskCollection failed");
  }

  const created = result.data?.createTaskCollection;
  if (!created) {
    throw new Error("GraphQL createTaskCollection failed");
  }
  return created;
}

export async function addTask(input: AddTaskInput) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: addTaskQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task add failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL addTask failed");
  }

  const created = result.data?.addTask;

  if (!created) {
    throw new Error("GraphQL addTask failed");
  }
  return created;
}

export async function deleteTask(input: { taskId: string }) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: deleteTaskQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task delete failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL deleteTask failed");
  }
  return result.data?.deleteTask ?? false;
}

export async function deleteTaskCollection(input: { collectionId: string }) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: deleteTaskCollectionQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task collection delete failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL deleteTaskCollection failed");
  }
  return result.data?.deleteTaskCollection ?? false;
}
