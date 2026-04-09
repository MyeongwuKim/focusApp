import type { PrismaClient } from "@prisma/client";

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

export class TaskCollecitonRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findTaskCollections(userId: string) {
    return this.prisma.taskCollection.findMany({
      where: {
        userId,
      },
      include: {
        tasks: {
          orderBy: {
            order: "asc"
          }
        }
      },
      orderBy: {
        order: "asc"
      }
    });
  }

  async createTaskCollection(input: CreateTaskCollectionInput) {
    const nextOrder = input.order ?? (await this.getNextCollectionOrder(input.userId));

    return this.prisma.taskCollection.create({
      data: {
        userId: input.userId,
        name: input.name,
        order: nextOrder
      },
      include: {
        tasks: {
          orderBy: {
            order: "asc"
          }
        }
      }
    });
  }

  async createTask(input: AddTaskInput) {
    const nextOrder =
      input.order ??
      (await this.getNextTaskOrder({
        userId: input.userId,
        collectionId: input.collectionId
      }));

    return this.prisma.task.create({
      data: {
        userId: input.userId,
        collectionId: input.collectionId,
        title: input.title,
        order: nextOrder
      }
    });
  }

  async findTaskCollection(userId: string, collectionId: string) {
    return this.prisma.taskCollection.findFirst({
      where: {
        id: collectionId,
        userId
      }
    });
  }

  async findTaskTitles(userId: string, collectionId: string) {
    const rows = await this.prisma.task.findMany({
      where: {
        userId,
        collectionId
      },
      select: {
        title: true
      }
    });
    return rows.map((row) => row.title);
  }

  findTaskById(userId: string, taskId: string) {
    return this.prisma.task.findFirst({
      where: {
        id: taskId,
        userId
      }
    });
  }

  async deleteTask(input: DeleteTaskInput) {
    await this.prisma.task.deleteMany({
      where: {
        id: input.taskId,
        userId: input.userId
      }
    });
  }

  async deleteTaskCollection(input: DeleteTaskCollectionInput) {
    await this.prisma.$transaction([
      this.prisma.task.deleteMany({
        where: {
          userId: input.userId,
          collectionId: input.collectionId
        }
      }),
      this.prisma.taskCollection.deleteMany({
        where: {
          id: input.collectionId,
          userId: input.userId
        }
      })
    ]);
  }

  async moveTaskToCollection(input: MoveTaskToCollectionInput) {
    const nextOrder = await this.getNextTaskOrder({
      userId: input.userId,
      collectionId: input.collectionId
    });

    return this.prisma.task.update({
      where: {
        id: input.taskId
      },
      data: {
        collectionId: input.collectionId,
        order: nextOrder
      }
    });
  }

  async reorderTaskCollections(input: ReorderTaskCollectionsInput) {
    await this.prisma.$transaction(
      input.collectionIds.map((collectionId, order) =>
        this.prisma.taskCollection.updateMany({
          where: {
            id: collectionId,
            userId: input.userId
          },
          data: {
            order
          }
        })
      )
    );
  }

  async reorderTasks(input: ReorderTasksInput) {
    await this.prisma.$transaction(
      input.taskIds.map((taskId, order) =>
        this.prisma.task.updateMany({
          where: {
            id: taskId,
            userId: input.userId
          },
          data: {
            order
          }
        })
      )
    );
  }

  renameTask(input: RenameTaskInput) {
    return this.prisma.task.update({
      where: {
        id: input.taskId,
      },
      data: {
        title: input.title,
      },
    });
  }

  renameTaskCollection(input: RenameTaskCollectionInput) {
    return this.prisma.taskCollection.update({
      where: {
        id: input.collectionId,
      },
      data: {
        name: input.name,
      },
    });
  }

  async setTaskFavorite(input: SetTaskFavoriteInput) {
    const result = await this.prisma.task.updateMany({
      where: {
        id: input.taskId,
        userId: input.userId,
      },
      data: {
        isFavorite: input.isFavorite,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findTaskById(input.userId, input.taskId);
  }

  private async getNextCollectionOrder(userId: string) {
    const latestCollection = await this.prisma.taskCollection.findFirst({
      where: { userId },
      orderBy: { order: "desc" }
    });
    return (latestCollection?.order ?? -1) + 1;
  }

  private async getNextTaskOrder(input: { userId: string; collectionId: string }) {
    const latestTask = await this.prisma.task.findFirst({
      where: {
        userId: input.userId,
        collectionId: input.collectionId
      },
      orderBy: { order: "desc" }
    });
    return (latestTask?.order ?? -1) + 1;
  }
}
