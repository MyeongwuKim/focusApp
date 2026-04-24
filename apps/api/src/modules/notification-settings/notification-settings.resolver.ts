import { gql } from "graphql-tag";
import { rethrowMappedGraphQLError } from "../../common/utils/graphql-error.js";
import { requireUserId } from "../../common/utils/require-user-id.js";
import type { GraphQLContext } from "../../graphql/context.js";
import { NotificationSettingsRepository } from "./notification-settings.repository.js";
import { NotificationSettingsService } from "./notification-settings.service.js";

export const notificationSettingsTypeDefs = gql`
  type NotificationSettings {
    id: ID!
    userId: ID!
    pushEnabled: Boolean!
    intervalMinutes: Int!
    activeStartTime: String!
    activeEndTime: String!
    dayMode: String!
    typeRestEnd: Boolean!
    typeIncomplete: Boolean!
    typeFocusStart: Boolean!
    tone: String!
    systemPermission: String
    lastFocusReminderSentAt: String
    lastEmptyTodoReminderDate: String
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
    lastFocusReminderSentAt: String
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
  NOTIFICATION_LAST_FOCUS_SENT_AT_INVALID: { message: "마지막 발송 시간 값이 올바르지 않아요." },
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
          lastFocusReminderSentAt?: string | null;
          lastEmptyTodoReminderDate?: string | null;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const service = createNotificationSettingsService(context);
        return await service.updateNotificationSettings({
          userId: getUserId(context),
          ...args.input,
        });
      } catch (error) {
        rethrowMappedGraphQLError(error, notificationSettingsErrorMapping);
      }
    },
  },
  NotificationSettings: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    lastFocusReminderSentAt: (parent: { lastFocusReminderSentAt: Date | null }) =>
      parent.lastFocusReminderSentAt ? parent.lastFocusReminderSentAt.toISOString() : null,
  },
};

function createNotificationSettingsService(context: GraphQLContext) {
  const repository = new NotificationSettingsRepository(context.prisma);
  return new NotificationSettingsService(repository);
}

function getUserId(context: GraphQLContext) {
  return requireUserId(context);
}
