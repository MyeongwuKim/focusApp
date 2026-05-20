import type { PrismaClient } from "@prisma/client";

export interface RoutineTemplateItemRecord {
  id: string;
  taskId?: string | null;
  titleSnapshot?: string | null;
  content: string;
  order: number;
  scheduledTimeHHmm?: string | null;
}

interface CreateRoutineTemplateInput {
  userId: string;
  name: string;
  items: RoutineTemplateItemRecord[];
}

interface UpdateRoutineTemplateInput {
  userId: string;
  routineTemplateId: string;
  name?: string;
  items?: RoutineTemplateItemRecord[];
}

export interface RoutineTemplateWeekdayAssignmentRecord {
  id: string;
  userId: string;
  weekday: number;
  routineTemplateId: string | null;
  routineTemplate: {
    id: string;
    userId: string;
    name: string;
    items: RoutineTemplateItemRecord[];
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpsertRoutineTemplateWeekdayAssignmentInput {
  userId: string;
  weekday: number;
  routineTemplateId: string | null;
}

export class RoutineTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findRoutineTemplates(userId: string) {
    return this.prisma.routineTemplate.findMany({
      where: { userId },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  findRoutineTemplateById(userId: string, routineTemplateId: string) {
    return this.prisma.routineTemplate.findFirst({
      where: {
        id: routineTemplateId,
        userId,
      },
    });
  }

  findRoutineTemplateWeekdayAssignments(userId: string): Promise<RoutineTemplateWeekdayAssignmentRecord[]> {
    return this.prisma.routineTemplateWeekdayAssignment.findMany({
      where: {
        userId,
      },
      orderBy: {
        weekday: "asc",
      },
      include: {
        routineTemplate: true,
      },
    }) as Promise<RoutineTemplateWeekdayAssignmentRecord[]>;
  }

  createRoutineTemplate(input: CreateRoutineTemplateInput) {
    return this.prisma.routineTemplate.create({
      data: {
        userId: input.userId,
        name: input.name,
        items: input.items as never,
      },
    });
  }

  async updateRoutineTemplate(input: UpdateRoutineTemplateInput) {
    await this.prisma.routineTemplate.updateMany({
      where: {
        id: input.routineTemplateId,
        userId: input.userId,
      },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.items !== undefined ? { items: input.items as never } : {}),
      },
    });

    return this.findRoutineTemplateById(input.userId, input.routineTemplateId);
  }

  async deleteRoutineTemplate(userId: string, routineTemplateId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.routineTemplateWeekdayAssignment.updateMany({
        where: {
          userId,
          routineTemplateId,
        },
        data: {
          routineTemplateId: null,
        },
      });

      return tx.routineTemplate.deleteMany({
        where: {
          id: routineTemplateId,
          userId,
        },
      });
    });

    return result.count > 0;
  }

  upsertRoutineTemplateWeekdayAssignment(input: UpsertRoutineTemplateWeekdayAssignmentInput) {
    return this.prisma.routineTemplateWeekdayAssignment.upsert({
      where: {
        userId_weekday: {
          userId: input.userId,
          weekday: input.weekday,
        },
      },
      create: {
        userId: input.userId,
        weekday: input.weekday,
        routineTemplateId: input.routineTemplateId,
      },
      update: {
        routineTemplateId: input.routineTemplateId,
      },
      include: {
        routineTemplate: true,
      },
    }) as Promise<RoutineTemplateWeekdayAssignmentRecord>;
  }
}
