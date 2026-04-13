import type {
  AddTaskInput,
  CreateTaskCollectionInput,
} from "../graphql/generated.ts";
import { buildAuthHeaders } from "./authHeaders";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
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
        isFavorite
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

export const moveTaskToCollectionQuery = /* GraphQL */ `
  mutation MoveTaskToCollection($input: MoveTaskToCollectionInput!) {
    moveTaskToCollection(input: $input) {
      id
      collectionId
      title
      order
      lastUsedAt
    }
  }
`;

export const reorderTaskCollectionsQuery = /* GraphQL */ `
  mutation ReorderTaskCollections($input: ReorderTaskCollectionsInput!) {
    reorderTaskCollections(input: $input)
  }
`;

export const reorderTasksQuery = /* GraphQL */ `
  mutation ReorderTasks($input: ReorderTasksInput!) {
    reorderTasks(input: $input)
  }
`;

export const renameTaskQuery = /* GraphQL */ `
  mutation RenameTask($input: RenameTaskInput!) {
    renameTask(input: $input) {
      id
      collectionId
      title
      order
      lastUsedAt
    }
  }
`;

export const setTaskFavoriteQuery = /* GraphQL */ `
  mutation SetTaskFavorite($input: SetTaskFavoriteInput!) {
    setTaskFavorite(input: $input) {
      id
      collectionId
      title
      isFavorite
      order
      lastUsedAt
    }
  }
`;

export const renameTaskCollectionQuery = /* GraphQL */ `
  mutation RenameTaskCollection($input: RenameTaskCollectionInput!) {
    renameTaskCollection(input: $input) {
      id
      name
      order
    }
  }
`;

export const deleteTaskCollectionQuery = /* GraphQL */ `
  mutation DeleteTaskCollection($input: DeleteTaskCollectionInput!) {
    deleteTaskCollection(input: $input)
  }
`;

export async function fetchTaskCollections() {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: TASK_COLLECTIONS_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Task collections fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<TaskCollectionsPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL taskCollections failed");
  }

  return result.data?.taskCollections ?? [];
}

type MutationType = {
  createTaskCollection: {
    id: string;
    name: string;
    order: number;
  };
  addTask: {
    id: string;
    collectionId: string;
    order: number;
    title: string;
    lastUsedAt?: string | null;
    isFavorite?: boolean | null;
  };
  moveTaskToCollection: {
    id: string;
    collectionId: string;
    order: number;
    title: string;
    lastUsedAt?: string | null;
    isFavorite?: boolean | null;
  };
  reorderTaskCollections: boolean;
  reorderTasks: boolean;
  renameTask: {
    id: string;
    collectionId: string;
    order: number;
    title: string;
    lastUsedAt?: string | null;
    isFavorite?: boolean | null;
  };
  renameTaskCollection: {
    id: string;
    name: string;
    order: number;
  };
  setTaskFavorite: {
    id: string;
    collectionId: string;
    order: number;
    title: string;
    lastUsedAt?: string | null;
    isFavorite?: boolean | null;
  };
  deleteTask: boolean;
  deleteTaskCollection: boolean;
};

type TaskCollectionsPayload = {
  taskCollections: Array<{
    id: string;
    name: string;
    order: number;
    createdAt: string;
    updatedAt: string;
    tasks: Array<{
      id: string;
      userId: string;
      collectionId: string;
      title: string;
      isFavorite?: boolean | null;
      isArchived: boolean;
      order: number;
      lastUsedAt?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
  }>;
};

export async function addTaskCollection(input: CreateTaskCollectionInput) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
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
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
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
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
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

export async function moveTaskToCollection(input: { taskId: string; collectionId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: moveTaskToCollectionQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task move failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL moveTaskToCollection failed");
  }

  const moved = result.data?.moveTaskToCollection;
  if (!moved) {
    throw new Error("GraphQL moveTaskToCollection failed");
  }
  return moved;
}

export async function reorderTaskCollections(input: { collectionIds: string[] }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: reorderTaskCollectionsQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task collection reorder failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL reorderTaskCollections failed");
  }
  return result.data?.reorderTaskCollections ?? false;
}

export async function reorderTasks(input: { taskIds: string[] }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: reorderTasksQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task reorder failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL reorderTasks failed");
  }
  return result.data?.reorderTasks ?? false;
}

export async function renameTask(input: { taskId: string; title: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: renameTaskQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task rename failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL renameTask failed");
  }

  const renamed = result.data?.renameTask;
  if (!renamed) {
    throw new Error("GraphQL renameTask failed");
  }
  return renamed;
}

export async function renameTaskCollection(input: { collectionId: string; name: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: renameTaskCollectionQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task collection rename failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL renameTaskCollection failed");
  }

  const renamed = result.data?.renameTaskCollection;
  if (!renamed) {
    throw new Error("GraphQL renameTaskCollection failed");
  }
  return renamed;
}

export async function deleteTaskCollection(input: { collectionId: string }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
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

export async function setTaskFavorite(input: { taskId: string; isFavorite: boolean }) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: setTaskFavoriteQuery,
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Task favorite update failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<MutationType>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL setTaskFavorite failed");
  }

  const updated = result.data?.setTaskFavorite;
  if (!updated) {
    throw new Error("GraphQL setTaskFavorite failed");
  }
  return updated;
}
