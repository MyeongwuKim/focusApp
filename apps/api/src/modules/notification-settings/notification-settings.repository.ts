import type { NotificationSettings, PrismaClient } from "@prisma/client";

export interface NotificationSettingsUpdateInput {
  pushEnabled?: boolean;
  intervalMinutes?: number;
  activeStartTime?: string;
  activeEndTime?: string;
  dayMode?: string;
  typeRestEnd?: boolean;
  typeIncomplete?: boolean;
  typeFocusStart?: boolean;
  tone?: string;
  systemPermission?: string | null;
  lastFocusReminderSentAt?: Date | null;
  lastEmptyTodoReminderDate?: string | null;
}

export class NotificationSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

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
