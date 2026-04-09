import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

export type RoutineTemplateItem = {
  id: string;
  taskId: string | null;
  titleSnapshot: string | null;
  content: string;
  order: number;
  scheduledTimeHHmm: string | null;
};

export type RoutineTemplate = {
  id: string;
  userId: string;
  name: string;
  items: RoutineTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

export type RoutineTemplateItemInput = {
  id?: string;
  taskId?: string | null;
  titleSnapshot?: string | null;
  content: string;
  order?: number;
  scheduledTimeHHmm?: string | null;
};

const ROUTINE_TEMPLATES_QUERY = /* GraphQL */ `
  query RoutineTemplates {
    routineTemplates {
      id
      userId
      name
      items {
        id
        taskId
        titleSnapshot
        content
        order
        scheduledTimeHHmm
      }
      createdAt
      updatedAt
    }
  }
`;

const CREATE_ROUTINE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation CreateRoutineTemplate($input: CreateRoutineTemplateInput!) {
    createRoutineTemplate(input: $input) {
      id
      userId
      name
      items {
        id
        taskId
        titleSnapshot
        content
        order
        scheduledTimeHHmm
      }
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_ROUTINE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation UpdateRoutineTemplate($input: UpdateRoutineTemplateInput!) {
    updateRoutineTemplate(input: $input) {
      id
      userId
      name
      items {
        id
        taskId
        titleSnapshot
        content
        order
        scheduledTimeHHmm
      }
      createdAt
      updatedAt
    }
  }
`;

const DELETE_ROUTINE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation DeleteRoutineTemplate($input: DeleteRoutineTemplateInput!) {
    deleteRoutineTemplate(input: $input)
  }
`;

type RoutineTemplatesQueryResponse = {
  routineTemplates: RoutineTemplate[];
};

type CreateRoutineTemplateMutationResponse = {
  createRoutineTemplate: RoutineTemplate;
};

type UpdateRoutineTemplateMutationResponse = {
  updateRoutineTemplate: RoutineTemplate;
};

type DeleteRoutineTemplateMutationResponse = {
  deleteRoutineTemplate: boolean;
};

async function postGraphql<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Routine template request failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<T>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Routine template GraphQL request failed");
  }

  return result.data;
}

export async function fetchRoutineTemplates() {
  const data = await postGraphql<RoutineTemplatesQueryResponse>(ROUTINE_TEMPLATES_QUERY);
  return data?.routineTemplates ?? [];
}

export async function createRoutineTemplate(input: {
  name: string;
  items: RoutineTemplateItemInput[];
}) {
  const data = await postGraphql<CreateRoutineTemplateMutationResponse>(
    CREATE_ROUTINE_TEMPLATE_MUTATION,
    { input }
  );
  if (!data?.createRoutineTemplate) {
    throw new Error("GraphQL createRoutineTemplate failed");
  }
  return data.createRoutineTemplate;
}

export async function updateRoutineTemplate(input: {
  routineTemplateId: string;
  name?: string;
  items?: RoutineTemplateItemInput[];
}) {
  const data = await postGraphql<UpdateRoutineTemplateMutationResponse>(
    UPDATE_ROUTINE_TEMPLATE_MUTATION,
    { input }
  );
  if (!data?.updateRoutineTemplate) {
    throw new Error("GraphQL updateRoutineTemplate failed");
  }
  return data.updateRoutineTemplate;
}

export async function deleteRoutineTemplate(input: { routineTemplateId: string }) {
  const data = await postGraphql<DeleteRoutineTemplateMutationResponse>(
    DELETE_ROUTINE_TEMPLATE_MUTATION,
    { input }
  );
  return data?.deleteRoutineTemplate ?? false;
}
