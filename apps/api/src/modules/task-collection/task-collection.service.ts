import { TaskCollecitonRepository } from "./task-collection.repository.js";

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

export class TaskCollectionService {
  constructor(private readonly repository: TaskCollecitonRepository) {}

  getTaskCollections(userId: string) {
    return this.repository.findTaskCollections(userId);
  }

  createTaskCollection(input: CreateTaskCollectionInput) {
    return this.repository.createTaskCollection(input);
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

    await this.repository.deleteTaskCollection(input);
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

    return this.repository.renameTaskCollection({
      ...input,
      name,
    });
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
}

function normalizeTaskTitle(title: string) {
  return title.trim().replace(/\s+/g, "").toLowerCase();
}
