import type { PrismaClient } from "@prisma/client";

export class TaskCollecitonRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getTaskCollections() {}
}
