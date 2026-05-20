import { randomUUID } from "node:crypto";
import {
  RoutineTemplateRepository,
  type RoutineTemplateWeekdayAssignmentRecord,
  type RoutineTemplateItemRecord,
} from "./routine-template.repository.js";

interface RoutineTemplateItemInput {
  id?: string | null;
  taskId?: string | null;
  titleSnapshot?: string | null;
  content: string;
  order?: number | null;
  scheduledTimeHHmm?: string | null;
}

interface CreateRoutineTemplateInput {
  userId: string;
  name: string;
  items: RoutineTemplateItemInput[];
}

interface UpdateRoutineTemplateInput {
  userId: string;
  routineTemplateId: string;
  name?: string | null;
  items?: RoutineTemplateItemInput[] | null;
}

interface DeleteRoutineTemplateInput {
  userId: string;
  routineTemplateId: string;
}

interface RoutineTemplateWeekdayAssignmentInput {
  weekday: number;
  routineTemplateId?: string | null;
}

interface UpdateRoutineTemplateWeekdayAssignmentsInput {
  userId: string;
  assignments: RoutineTemplateWeekdayAssignmentInput[];
}

const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MIN_WEEKDAY = 0;
const MAX_WEEKDAY = 6;

export class RoutineTemplateService {
  constructor(private readonly repository: RoutineTemplateRepository) {}

  getRoutineTemplates(userId: string) {
    return this.repository.findRoutineTemplates(userId);
  }

  async createRoutineTemplate(input: CreateRoutineTemplateInput) {
    const name = normalizeTemplateName(input.name);
    await ensureTemplateNameIsUnique(this.repository, input.userId, name);
    const items = normalizeTemplateItems(input.items);

    return this.repository.createRoutineTemplate({
      userId: input.userId,
      name,
      items,
    });
  }

  async updateRoutineTemplate(input: UpdateRoutineTemplateInput) {
    const existing = await this.repository.findRoutineTemplateById(input.userId, input.routineTemplateId);
    if (!existing) {
      throw new Error("ROUTINE_TEMPLATE_NOT_FOUND");
    }

    const nextName = input.name !== undefined && input.name !== null
      ? normalizeTemplateName(input.name)
      : undefined;
    if (nextName !== undefined && isSameTemplateName(existing.name, nextName) === false) {
      await ensureTemplateNameIsUnique(this.repository, input.userId, nextName, input.routineTemplateId);
    }
    const nextItems = input.items !== undefined && input.items !== null
      ? normalizeTemplateItems(input.items)
      : undefined;

    const updated = await this.repository.updateRoutineTemplate({
      userId: input.userId,
      routineTemplateId: input.routineTemplateId,
      ...(nextName !== undefined ? { name: nextName } : {}),
      ...(nextItems !== undefined ? { items: nextItems } : {}),
    });

    if (!updated) {
      throw new Error("ROUTINE_TEMPLATE_NOT_FOUND");
    }

    return updated;
  }

  async deleteRoutineTemplate(input: DeleteRoutineTemplateInput) {
    const existing = await this.repository.findRoutineTemplateById(input.userId, input.routineTemplateId);
    if (!existing) {
      throw new Error("ROUTINE_TEMPLATE_NOT_FOUND");
    }

    await this.repository.deleteRoutineTemplate(input.userId, input.routineTemplateId);
    return true;
  }

  async getRoutineTemplateWeekdayAssignments(userId: string) {
    const assignments = await this.repository.findRoutineTemplateWeekdayAssignments(userId);
    return fillMissingWeekdayAssignments(userId, assignments);
  }

  async updateRoutineTemplateWeekdayAssignments(input: UpdateRoutineTemplateWeekdayAssignmentsInput) {
    const normalizedAssignments = normalizeWeekdayAssignments(input.assignments);
    const routineTemplateIds = Array.from(
      new Set(
        normalizedAssignments
          .map((assignment) => assignment.routineTemplateId)
          .filter((value): value is string => typeof value === "string")
      )
    );
    if (routineTemplateIds.length > 0) {
      const templates = await this.repository.findRoutineTemplates(input.userId);
      const templateIdSet = new Set(templates.map((template) => template.id));
      for (const routineTemplateId of routineTemplateIds) {
        if (!templateIdSet.has(routineTemplateId)) {
          throw new Error("ROUTINE_TEMPLATE_NOT_FOUND");
        }
      }
    }

    await Promise.all(
      normalizedAssignments.map((assignment) =>
        this.repository.upsertRoutineTemplateWeekdayAssignment({
          userId: input.userId,
          weekday: assignment.weekday,
          routineTemplateId: assignment.routineTemplateId,
        })
      )
    );

    const updatedAssignments = await this.repository.findRoutineTemplateWeekdayAssignments(input.userId);
    return fillMissingWeekdayAssignments(input.userId, updatedAssignments);
  }
}

function normalizeTemplateName(value: string) {
  const name = value.trim();
  if (!name) {
    throw new Error("ROUTINE_TEMPLATE_NAME_REQUIRED");
  }
  return name;
}

function normalizeTemplateItems(items: RoutineTemplateItemInput[]) {
  if (items.length === 0) {
    throw new Error("ROUTINE_TEMPLATE_ITEMS_REQUIRED");
  }

  return items.map<RoutineTemplateItemRecord>((item, index) => {
    const content = item.content.trim();
    if (!content) {
      throw new Error("ROUTINE_TEMPLATE_ITEM_CONTENT_REQUIRED");
    }

    const scheduledTimeHHmm = normalizeScheduledTime(item.scheduledTimeHHmm);

    return {
      id: item.id?.trim() || randomUUID(),
      taskId: item.taskId ?? null,
      titleSnapshot: item.titleSnapshot?.trim() || null,
      content,
      order: index,
      scheduledTimeHHmm,
    };
  });
}

async function ensureTemplateNameIsUnique(
  repository: RoutineTemplateRepository,
  userId: string,
  name: string,
  exceptTemplateId?: string
) {
  const templates = await repository.findRoutineTemplates(userId);
  const normalizedInput = normalizeNameForComparison(name);
  const duplicated = templates.some(
    (template) =>
      template.id !== exceptTemplateId && normalizeNameForComparison(template.name) === normalizedInput
  );

  if (duplicated) {
    throw new Error("ROUTINE_TEMPLATE_NAME_DUPLICATED");
  }
}

function normalizeNameForComparison(value: string) {
  return value.trim().toLowerCase();
}

function isSameTemplateName(previous: string, next: string) {
  return normalizeNameForComparison(previous) === normalizeNameForComparison(next);
}

function normalizeScheduledTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!HHMM_PATTERN.test(trimmed)) {
    throw new Error("ROUTINE_TEMPLATE_ITEM_TIME_INVALID");
  }

  return trimmed;
}

function normalizeWeekdayAssignments(assignments: RoutineTemplateWeekdayAssignmentInput[]) {
  if (assignments.length === 0) {
    throw new Error("ROUTINE_WEEKDAY_ASSIGNMENTS_REQUIRED");
  }

  const weekdaySet = new Set<number>();
  return assignments.map((assignment) => {
    if (!Number.isInteger(assignment.weekday) || assignment.weekday < MIN_WEEKDAY || assignment.weekday > MAX_WEEKDAY) {
      throw new Error("ROUTINE_WEEKDAY_INVALID");
    }
    if (weekdaySet.has(assignment.weekday)) {
      throw new Error("ROUTINE_WEEKDAY_DUPLICATED");
    }
    weekdaySet.add(assignment.weekday);

    const routineTemplateId =
      typeof assignment.routineTemplateId === "string" && assignment.routineTemplateId.trim().length > 0
        ? assignment.routineTemplateId.trim()
        : null;

    return {
      weekday: assignment.weekday,
      routineTemplateId,
    };
  });
}

function fillMissingWeekdayAssignments(
  userId: string,
  assignments: RoutineTemplateWeekdayAssignmentRecord[]
) {
  const assignmentByWeekday = new Map(assignments.map((assignment) => [assignment.weekday, assignment]));

  const result: RoutineTemplateWeekdayAssignmentRecord[] = [];
  for (let weekday = MIN_WEEKDAY; weekday <= MAX_WEEKDAY; weekday += 1) {
    const existing = assignmentByWeekday.get(weekday);
    if (existing) {
      result.push(existing);
      continue;
    }

    const now = new Date();
    result.push({
      id: `virtual-${userId}-${weekday}`,
      userId,
      weekday,
      routineTemplateId: null,
      routineTemplate: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return result;
}
