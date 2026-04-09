import { randomUUID } from "node:crypto";
import {
  RoutineTemplateRepository,
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

const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
