import {
  CreateRoutineTemplateDocument,
  DeleteRoutineTemplateDocument,
  RoutineTemplateWeekdayAssignmentsDocument,
  RoutineTemplatesDocument,
  UpdateRoutineTemplateDocument,
  UpdateRoutineTemplateWeekdayAssignmentsDocument,
} from "../graphql/generated";
import { requestGraphql } from "./graphqlClient";

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

export type RoutineTemplateWeekdayAssignment = {
  id: string;
  userId: string;
  weekday: number;
  routineTemplateId: string | null;
  routineTemplate: RoutineTemplate | null;
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

export async function fetchRoutineTemplates() {
  const data = await requestGraphql(RoutineTemplatesDocument);
  return data.routineTemplates as RoutineTemplate[];
}

export async function fetchRoutineTemplateWeekdayAssignments() {
  const data = await requestGraphql(RoutineTemplateWeekdayAssignmentsDocument);
  return data.routineTemplateWeekdayAssignments as RoutineTemplateWeekdayAssignment[];
}

export async function createRoutineTemplate(input: {
  name: string;
  items: RoutineTemplateItemInput[];
}) {
  const data = await requestGraphql(CreateRoutineTemplateDocument, { input });
  return data.createRoutineTemplate as RoutineTemplate;
}

export async function updateRoutineTemplate(input: {
  routineTemplateId: string;
  name?: string;
  items?: RoutineTemplateItemInput[];
}) {
  const data = await requestGraphql(UpdateRoutineTemplateDocument, { input });
  return data.updateRoutineTemplate as RoutineTemplate;
}

export async function deleteRoutineTemplate(input: { routineTemplateId: string }) {
  const data = await requestGraphql(DeleteRoutineTemplateDocument, { input });
  return data.deleteRoutineTemplate;
}

export async function updateRoutineTemplateWeekdayAssignments(input: {
  assignments: Array<{
    weekday: number;
    routineTemplateId?: string | null;
  }>;
}) {
  const data = await requestGraphql(UpdateRoutineTemplateWeekdayAssignmentsDocument, { input });
  return data.updateRoutineTemplateWeekdayAssignments as RoutineTemplateWeekdayAssignment[];
}
