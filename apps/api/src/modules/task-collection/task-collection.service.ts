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
