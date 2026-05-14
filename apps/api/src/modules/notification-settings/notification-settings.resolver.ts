import { gql } from "graphql-tag";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import { requireUserId } from "../../common/utils/require-user-id.js";
import type { GraphQLContext } from "../../graphql/context.js";
import { NotificationSettingsRepository } from "./notification-settings.repository.js";
import { NotificationSettingsService } from "./notification-settings.service.js";
import { refreshReminderScheduleForUser } from "../notification-batch/notification-reminder-schedule.js";
import { env } from "../../config/env.js";

export const notificationSettingsTypeDefs = gql`
  type NotificationSettings {
    id: ID!
    userId: ID!
    pushEnabled: Boolean!
    intervalMinutes: Int!
    pendingIntervalMinutes: Int
    activeStartTime: String!
    activeEndTime: String!
    dayMode: String!
    typeRestEnd: Boolean!
    typeIncomplete: Boolean!
    typeFocusStart: Boolean!
    tone: String!
    systemPermission: String
    lastEmptyTodoReminderDate: String
    nextReminderAt: String
    createdAt: String!
    updatedAt: String!
  }

  input UpdateNotificationSettingsInput {
    pushEnabled: Boolean
    intervalMinutes: Int
    activeStartTime: String
    activeEndTime: String
    dayMode: String
    typeRestEnd: Boolean
    typeIncomplete: Boolean
    typeFocusStart: Boolean
    tone: String
    systemPermission: String
    lastEmptyTodoReminderDate: String
  }

  extend type Query {
    notificationSettings: NotificationSettings!
  }

  extend type Mutation {
    updateNotificationSettings(input: UpdateNotificationSettingsInput!): NotificationSettings!
  }
`;

const notificationSettingsErrorMapping = {
  NOTIFICATION_INTERVAL_INVALID: { message: "리마인드 간격 값이 올바르지 않아요." },
  NOTIFICATION_ACTIVE_TIME_INVALID: { message: "활성화 시간은 HH:mm 형식으로 입력해 주세요." },
  NOTIFICATION_DAY_MODE_INVALID: { message: "요일 선택 값이 올바르지 않아요." },
  NOTIFICATION_TONE_INVALID: { message: "알림 톤 값이 올바르지 않아요." },
};

export const notificationSettingsResolvers = {
  Query: {
    notificationSettings: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const service = createNotificationSettingsService(context);
      return service.getNotificationSettings(getUserId(context));
    },
  },
  Mutation: {
    updateNotificationSettings: async (
      _parent: unknown,
      args: {
        input: {
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
          lastEmptyTodoReminderDate?: string | null;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        const previous = await context.prisma.notificationSettings.findUnique({
          where: { userId },
        });
        const service = createNotificationSettingsService(context);
        const updated = await service.updateNotificationSettings({
          userId,
          ...args.input,
        });
        const touchesInterval = args.input.intervalMinutes !== undefined;
        const touchesScheduleGuard = hasScheduleGuardChange(previous, args.input);

        await refreshReminderScheduleForUser({
          prisma: context.prisma,
          userId: updated.userId,
          timezone: env.NOTIFICATION_BATCH_TIMEZONE,
          preserveCurrentCycle: touchesInterval && !touchesScheduleGuard,
          preserveValidFutureReminder: true,
        });
        return context.prisma.notificationSettings.findUniqueOrThrow({
          where: { userId: updated.userId },
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, notificationSettingsErrorMapping);
      }
    },
  },
  NotificationSettings: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    nextReminderAt: (parent: { nextReminderAt: Date | null }) =>
      parent.nextReminderAt ? parent.nextReminderAt.toISOString() : null,
  },
};

function createNotificationSettingsService(context: GraphQLContext) {
  const repository = new NotificationSettingsRepository(context.prisma);
  return new NotificationSettingsService(repository);
}

function getUserId(context: GraphQLContext) {
  return requireUserId(context);
}

function hasScheduleGuardChange(
  previous: {
    pushEnabled: boolean;
    activeStartTime: string;
    activeEndTime: string;
    dayMode: string;
    typeIncomplete: boolean;
    typeFocusStart: boolean;
    systemPermission: string | null;
  } | null,
  input: {
    pushEnabled?: boolean;
    activeStartTime?: string;
    activeEndTime?: string;
    dayMode?: string;
    typeIncomplete?: boolean;
    typeFocusStart?: boolean;
    systemPermission?: string | null;
  }
) {
  if (!previous) {
    return true;
  }

  if (input.pushEnabled !== undefined && input.pushEnabled !== previous.pushEnabled) {
    return true;
  }
  if (input.activeStartTime !== undefined && input.activeStartTime.trim() !== previous.activeStartTime) {
    return true;
  }
  if (input.activeEndTime !== undefined && input.activeEndTime.trim() !== previous.activeEndTime) {
    return true;
  }
  if (input.dayMode !== undefined && input.dayMode.trim() !== previous.dayMode) {
    return true;
  }
  if (input.typeIncomplete !== undefined && input.typeIncomplete !== previous.typeIncomplete) {
    return true;
  }
  if (input.typeFocusStart !== undefined && input.typeFocusStart !== previous.typeFocusStart) {
    return true;
  }
  if (input.systemPermission !== undefined) {
    const normalizedPermission = input.systemPermission ? input.systemPermission.trim() : null;
    if (normalizedPermission !== previous.systemPermission) {
      return true;
    }
  }

  return false;
}
