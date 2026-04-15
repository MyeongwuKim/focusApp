import type { PrismaClient, PushDeviceToken } from "@prisma/client";

interface RegisterPushDeviceTokenInput {
  userId: string;
  pushToken: string;
  platform: string;
}

export class PushDeviceTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  deactivateOtherTokensByUserId(userId: string, keepPushToken: string): Promise<number> {
    return this.prisma.pushDeviceToken
      .updateMany({
        where: {
          userId,
          isActive: true,
          pushToken: { not: keepPushToken },
        },
        data: {
          isActive: false,
        },
      })
      .then((result) => result.count);
  }

  registerToken(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken> {
    return this.prisma.pushDeviceToken.upsert({
      where: {
        pushToken: input.pushToken,
      },
      create: {
        userId: input.userId,
        pushToken: input.pushToken,
        platform: input.platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: input.userId,
        platform: input.platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  deactivateToken(userId: string, pushToken: string): Promise<boolean> {
    return this.prisma.pushDeviceToken
      .updateMany({
        where: {
          userId,
          pushToken,
        },
        data: {
          isActive: false,
        },
      })
      .then((result) => result.count > 0);
  }

  deactivateTokens(pushTokens: string[]): Promise<number> {
    if (pushTokens.length === 0) {
      return Promise.resolve(0);
    }

    return this.prisma.pushDeviceToken
      .updateMany({
        where: {
          pushToken: { in: pushTokens },
        },
        data: {
          isActive: false,
        },
      })
      .then((result) => result.count);
  }

  findActiveTokensByUserIds(userIds: string[]) {
    if (userIds.length === 0) {
      return Promise.resolve([] as PushDeviceToken[]);
    }

    return this.prisma.pushDeviceToken.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }
}
