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
  fallbackCollectionId: string;
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

interface SaveTaskSuggestionCandidateInput {
  userId: string;
  normalizedText: string;
  displayText: string;
  countedDateKeys: string[];
  countStartedAt: Date | null;
  snoozedUntil: Date | null;
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

  async findTaskCollectionByName(userId: string, name: string) {
    return this.prisma.taskCollection.findFirst({
      where: {
        userId,
        name,
      },
      orderBy: {
        order: "asc",
      },
    });
  }

  findTaskCollectionNames(userId: string) {
    return this.prisma.taskCollection.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
      },
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

  /** 사용자의 관리 할 일 전체에서 정규화된 제목 중복을 확인할 때 사용할 제목과 ID를 조회한다. */
  findTasksForTitleCheck(userId: string) {
    return this.prisma.task.findMany({
      where: {
        userId,
        isArchived: false,
      },
      select: {
        id: true,
        title: true,
      },
    });
  }

  /** 정규화된 문구를 기준으로 사용자의 반복 입력 후보를 조회한다. */
  findTaskSuggestionCandidate(userId: string, normalizedText: string) {
    return this.prisma.taskSuggestionCandidate.findUnique({
      where: {
        userId_normalizedText: {
          userId,
          normalizedText,
        },
      },
    });
  }

  /** 저장 제안 횟수·집계 시작일·숨김 기한을 현재 후보 상태로 생성하거나 교체한다. */
  saveTaskSuggestionCandidate(input: SaveTaskSuggestionCandidateInput) {
    return this.prisma.taskSuggestionCandidate.upsert({
      where: {
        userId_normalizedText: {
          userId: input.userId,
          normalizedText: input.normalizedText,
        },
      },
      create: input,
      update: {
        displayText: input.displayText,
        countedDateKeys: input.countedDateKeys,
        countStartedAt: input.countStartedAt,
        snoozedUntil: input.snoozedUntil,
      },
    });
  }

  /** 저장 또는 거절할 후보가 현재 사용자에게 속하는지 확인하며 ID로 조회한다. */
  findTaskSuggestionCandidateById(userId: string, suggestionId: string) {
    return this.prisma.taskSuggestionCandidate.findFirst({
      where: {
        id: suggestionId,
        userId,
      },
    });
  }

  /** 제안을 수락했거나 이미 관리 중인 문구로 확인된 후보를 집계 대상에서 제거한다. */
  deleteTaskSuggestionCandidate(userId: string, suggestionId: string) {
    return this.prisma.taskSuggestionCandidate.deleteMany({
      where: {
        id: suggestionId,
        userId,
      },
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
    const tasksToMove = await this.prisma.task.findMany({
      where: {
        userId: input.userId,
        collectionId: input.collectionId,
      },
      orderBy: {
        order: "asc",
      },
      select: {
        id: true,
      },
    });
    const fallbackOrderStart = await this.getNextTaskOrder({
      userId: input.userId,
      collectionId: input.fallbackCollectionId,
    });

    await this.prisma.$transaction([
      ...tasksToMove.map((task, index) =>
        this.prisma.task.updateMany({
          where: {
            id: task.id,
            userId: input.userId,
          },
          data: {
            collectionId: input.fallbackCollectionId,
            order: fallbackOrderStart + index,
          },
        })
      ),
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
