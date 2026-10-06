import { TaskCollecitonRepository } from "./task-collection.repository.js";

const UNCATEGORIZED_COLLECTION_NAME = "미분류";
export const TASK_SUGGESTION_THRESHOLD = 3;
export const TASK_SUGGESTION_WINDOW_DAYS = 30;
export const TASK_SUGGESTION_SNOOZE_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface CreateTaskCollectionInput {
  userId: string;
  name: string;
  order?: number | null;
}

interface AddTaskInput {
  userId: string;
  collectionId: string;
  title: string;
  order?: number | null;
}

interface DeleteTaskInput {
  userId: string;
  taskId: string;
}

interface DeleteTaskCollectionInput {
  userId: string;
  collectionId: string;
}

interface MoveTaskToCollectionInput {
  userId: string;
  taskId: string;
  collectionId: string;
}

interface ReorderTaskCollectionsInput {
  userId: string;
  collectionIds: string[];
}

interface ReorderTasksInput {
  userId: string;
  taskIds: string[];
}

interface RenameTaskInput {
  userId: string;
  taskId: string;
  title: string;
}

interface RenameTaskCollectionInput {
  userId: string;
  collectionId: string;
  name: string;
}

interface SetTaskFavoriteInput {
  userId: string;
  taskId: string;
  isFavorite: boolean;
}

interface RecordTaskSuggestionUsageInput {
  userId: string;
  content: string;
  usageDateKey: string;
}

interface TaskSuggestionInput {
  userId: string;
  suggestionId: string;
}

export class TaskCollectionService {
  constructor(
    private readonly repository: TaskCollecitonRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  getTaskCollections(userId: string) {
    return this.repository.findTaskCollections(userId);
  }

  async createTaskCollection(input: CreateTaskCollectionInput) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("TASK_COLLECTION_NAME_REQUIRED");
    }

    await this.assertCollectionNameNotDuplicated(input.userId, name);

    return this.repository.createTaskCollection({
      ...input,
      name,
    });
  }

  addTask(input: AddTaskInput) {
    return this.addTaskWithValidation(input);
  }

  async deleteTask(input: DeleteTaskInput) {
    const task = await this.repository.findTaskById(input.userId, input.taskId);
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    await this.repository.deleteTask(input);
    return true;
  }

  async deleteTaskCollection(input: DeleteTaskCollectionInput) {
    const collection = await this.repository.findTaskCollection(input.userId, input.collectionId);
    if (!collection) {
      throw new Error("TASK_COLLECTION_NOT_FOUND");
    }

    if (normalizeCollectionName(collection.name) === normalizeCollectionName(UNCATEGORIZED_COLLECTION_NAME)) {
      throw new Error("UNCATEGORIZED_COLLECTION_PROTECTED");
    }

    const uncategorizedCollection =
      (await this.repository.findTaskCollectionByName(input.userId, UNCATEGORIZED_COLLECTION_NAME)) ??
      (await this.repository.createTaskCollection({
        userId: input.userId,
        name: UNCATEGORIZED_COLLECTION_NAME,
      }));

    await this.repository.deleteTaskCollection({
      ...input,
      fallbackCollectionId: uncategorizedCollection.id,
    });
    return true;
  }

  async moveTaskToCollection(input: MoveTaskToCollectionInput) {
    const task = await this.repository.findTaskById(input.userId, input.taskId);
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    const collection = await this.repository.findTaskCollection(input.userId, input.collectionId);
    if (!collection) {
      throw new Error("TASK_COLLECTION_NOT_FOUND");
    }

    if (task.collectionId === input.collectionId) {
      return task;
    }

    const normalizedTitle = normalizeTaskTitle(task.title);
    const existingTitles = await this.repository.findTaskTitles(input.userId, input.collectionId);
    const isDuplicated = existingTitles.some(
      (existingTitle) => normalizeTaskTitle(existingTitle) === normalizedTitle
    );
    if (isDuplicated) {
      throw new Error("TASK_TITLE_DUPLICATED");
    }

    return this.repository.moveTaskToCollection(input);
  }

  async reorderTaskCollections(input: ReorderTaskCollectionsInput) {
    if (input.collectionIds.length === 0) {
      return true;
    }

    await this.repository.reorderTaskCollections(input);
    return true;
  }

  async reorderTasks(input: ReorderTasksInput) {
    if (input.taskIds.length === 0) {
      return true;
    }

    await this.repository.reorderTasks(input);
    return true;
  }

  async renameTask(input: RenameTaskInput) {
    const task = await this.repository.findTaskById(input.userId, input.taskId);
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    const title = input.title.trim();
    if (!title) {
      throw new Error("TASK_TITLE_REQUIRED");
    }

    const normalizedTitle = normalizeTaskTitle(title);
    const existingTitles = await this.repository.findTaskTitles(input.userId, task.collectionId);
    const isDuplicated = existingTitles.some(
      (existingTitle) => normalizeTaskTitle(existingTitle) === normalizedTitle
    );
    if (isDuplicated && normalizeTaskTitle(task.title) !== normalizedTitle) {
      throw new Error("TASK_TITLE_DUPLICATED");
    }

    return this.repository.renameTask({
      ...input,
      title,
    });
  }

  async renameTaskCollection(input: RenameTaskCollectionInput) {
    const collection = await this.repository.findTaskCollection(input.userId, input.collectionId);
    if (!collection) {
      throw new Error("TASK_COLLECTION_NOT_FOUND");
    }

    const name = input.name.trim();
    if (!name) {
      throw new Error("TASK_COLLECTION_NAME_REQUIRED");
    }

    await this.assertCollectionNameNotDuplicated(input.userId, name, input.collectionId);

    return this.repository.renameTaskCollection({
      ...input,
      name,
    });
  }

  async setTaskFavorite(input: SetTaskFavoriteInput) {
    const task = await this.repository.findTaskById(input.userId, input.taskId);
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    const updated = await this.repository.setTaskFavorite(input);
    if (!updated) {
      throw new Error("TASK_NOT_FOUND");
    }

    return updated;
  }

  /**
   * 일회성 할 일 문구를 서로 다른 사용 날짜 기준으로 집계한다.
   * 이미 관리 중인 제목과 같거나 14일 숨김 기간인 후보는 횟수를 올리지 않으며,
   * 30일 안에 3일 사용한 후보만 저장 제안 대상으로 반환한다.
   */
  async recordTaskSuggestionUsage(input: RecordTaskSuggestionUsageInput) {
    const displayText = input.content.trim();
    if (!displayText) {
      throw new Error("TASK_SUGGESTION_CONTENT_REQUIRED");
    }
    if (!isValidDateKey(input.usageDateKey)) {
      throw new Error("TASK_SUGGESTION_DATE_INVALID");
    }

    const normalizedText = normalizeTaskTitle(displayText);
    const existingTasks = await this.repository.findTasksForTitleCheck(input.userId);
    const alreadyManaged = existingTasks.some((task) => normalizeTaskTitle(task.title) === normalizedText);
    const existingCandidate = await this.repository.findTaskSuggestionCandidate(input.userId, normalizedText);

    if (alreadyManaged) {
      if (existingCandidate) {
        await this.repository.deleteTaskSuggestionCandidate(input.userId, existingCandidate.id);
      }
      return {
        suggestionId: null,
        displayText,
        count: 0,
        shouldSuggest: false,
      };
    }

    const now = this.now();
    if (existingCandidate?.snoozedUntil && existingCandidate.snoozedUntil.getTime() > now.getTime()) {
      return {
        suggestionId: existingCandidate.id,
        displayText: existingCandidate.displayText,
        count: 0,
        shouldSuggest: false,
      };
    }

    const hasExpiredWindow = Boolean(
      existingCandidate?.countStartedAt &&
        now.getTime() - existingCandidate.countStartedAt.getTime() >= TASK_SUGGESTION_WINDOW_DAYS * DAY_IN_MS
    );
    const countedDateKeys = hasExpiredWindow || !existingCandidate
      ? []
      : existingCandidate.countedDateKeys;
    const nextCountedDateKeys = countedDateKeys.includes(input.usageDateKey)
      ? countedDateKeys
      : [...countedDateKeys, input.usageDateKey];
    const countStartedAt =
      hasExpiredWindow || !existingCandidate?.countStartedAt || existingCandidate.snoozedUntil
        ? now
        : existingCandidate.countStartedAt;
    const candidate = await this.repository.saveTaskSuggestionCandidate({
      userId: input.userId,
      normalizedText,
      displayText,
      countedDateKeys: nextCountedDateKeys,
      countStartedAt,
      snoozedUntil: null,
    });

    return {
      suggestionId: candidate.id,
      displayText: candidate.displayText,
      count: candidate.countedDateKeys.length,
      shouldSuggest: candidate.countedDateKeys.length >= TASK_SUGGESTION_THRESHOLD,
    };
  }

  /** 저장 제안을 거절한 후보의 횟수를 0으로 만들고 14일 동안 새 사용을 집계하지 않는다. */
  async dismissTaskSuggestion(input: TaskSuggestionInput) {
    const candidate = await this.repository.findTaskSuggestionCandidateById(input.userId, input.suggestionId);
    if (!candidate) {
      throw new Error("TASK_SUGGESTION_NOT_FOUND");
    }

    const snoozedUntil = new Date(this.now().getTime() + TASK_SUGGESTION_SNOOZE_DAYS * DAY_IN_MS);
    const updated = await this.repository.saveTaskSuggestionCandidate({
      userId: input.userId,
      normalizedText: candidate.normalizedText,
      displayText: candidate.displayText,
      countedDateKeys: [],
      countStartedAt: null,
      snoozedUntil,
    });

    return {
      suggestionId: updated.id,
      displayText: updated.displayText,
      count: 0,
      shouldSuggest: false,
    };
  }

  /** 제안 문구를 미분류 관리 할 일로 저장하고 같은 문구의 제안 후보를 제거한다. */
  async acceptTaskSuggestion(input: TaskSuggestionInput) {
    const candidate = await this.repository.findTaskSuggestionCandidateById(input.userId, input.suggestionId);
    if (!candidate) {
      throw new Error("TASK_SUGGESTION_NOT_FOUND");
    }

    const existingTasks = await this.repository.findTasksForTitleCheck(input.userId);
    const existingTask = existingTasks.find(
      (task) => normalizeTaskTitle(task.title) === candidate.normalizedText
    );
    if (existingTask) {
      await this.repository.deleteTaskSuggestionCandidate(input.userId, candidate.id);
      const task = await this.repository.findTaskById(input.userId, existingTask.id);
      if (!task) {
        throw new Error("TASK_NOT_FOUND");
      }
      return task;
    }

    const collection =
      (await this.repository.findTaskCollectionByName(input.userId, UNCATEGORIZED_COLLECTION_NAME)) ??
      (await this.repository.createTaskCollection({
        userId: input.userId,
        name: UNCATEGORIZED_COLLECTION_NAME,
      }));
    const task = await this.repository.createTask({
      userId: input.userId,
      collectionId: collection.id,
      title: candidate.displayText,
    });
    await this.repository.deleteTaskSuggestionCandidate(input.userId, candidate.id);
    return task;
  }

  private async addTaskWithValidation(input: AddTaskInput) {
    const collection = await this.repository.findTaskCollection(input.userId, input.collectionId);
    if (!collection) {
      throw new Error("TASK_COLLECTION_NOT_FOUND");
    }

    const title = input.title.trim();
    if (!title) {
      throw new Error("TASK_TITLE_REQUIRED");
    }

    const normalizedTitle = normalizeTaskTitle(title);
    const existingTitles = await this.repository.findTaskTitles(input.userId, input.collectionId);
    const isDuplicated = existingTitles.some(
      (existingTitle) => normalizeTaskTitle(existingTitle) === normalizedTitle
    );
    if (isDuplicated) {
      throw new Error("TASK_TITLE_DUPLICATED");
    }

    return this.repository.createTask({
      ...input,
      title
    });
  }

  private async assertCollectionNameNotDuplicated(
    userId: string,
    name: string,
    excludeCollectionId?: string
  ) {
    const normalizedName = normalizeCollectionName(name);
    const collectionNames = await this.repository.findTaskCollectionNames(userId);
    const duplicated = collectionNames.some(
      (collection) =>
        collection.id !== excludeCollectionId &&
        normalizeCollectionName(collection.name) === normalizedName
    );
    if (duplicated) {
      throw new Error("TASK_COLLECTION_NAME_DUPLICATED");
    }
  }
}

function normalizeTaskTitle(title: string) {
  return title.trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeCollectionName(name: string) {
  return name.trim().toLowerCase();
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
