import type { NotificationSettings, PrismaClient } from "@prisma/client";

export interface NotificationSettingsUpdateInput {
  pushEnabled?: boolean;
  intervalMinutes?: number;
  pendingIntervalMinutes?: number | null;
  activeStartTime?: string;
  activeEndTime?: string;
  dayMode?: string;
  typeRestEnd?: boolean;
  typeIncomplete?: boolean;
  typeFocusStart?: boolean;
  tone?: string;
  systemPermission?: string | null;
  lastEmptyTodoReminderDate?: string | null;
}

export class NotificationSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByUserId(userId: string): Promise<NotificationSettings | null> {
    return this.prisma.notificationSettings.findUnique({
      where: { userId },
    });
  }

  upsertDefaults(userId: string): Promise<NotificationSettings> {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
      },
      update: {},
    });
  }

  updateByUserId(userId: string, input: NotificationSettingsUpdateInput): Promise<NotificationSettings> {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...input,
      },
      update: {
        ...input,
      },
    });
  }
}
