import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

export type NotificationSettingsDayMode = "weekday" | "everyday";
export type NotificationSettingsTone = "soft" | "balanced" | "firm";

export type NotificationSettingsRecord = {
  id: string;
  userId: string;
  pushEnabled: boolean;
  intervalMinutes: number;
  activeStartTime: string;
  activeEndTime: string;
  dayMode: NotificationSettingsDayMode;
  typeRestEnd: boolean;
  typeIncomplete: boolean;
  typeFocusStart: boolean;
  tone: NotificationSettingsTone;
  systemPermission: string | null;
  lastFocusReminderSentAt: string | null;
  lastEmptyTodoReminderDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateNotificationSettingsInput = {
  pushEnabled?: boolean;
  intervalMinutes?: number;
  activeStartTime?: string;
  activeEndTime?: string;
  dayMode?: NotificationSettingsDayMode;
  typeRestEnd?: boolean;
  typeIncomplete?: boolean;
  typeFocusStart?: boolean;
  tone?: NotificationSettingsTone;
  systemPermission?: string | null;
  lastFocusReminderSentAt?: string | null;
  lastEmptyTodoReminderDate?: string | null;
};

const NOTIFICATION_SETTINGS_QUERY = /* GraphQL */ `
  query NotificationSettings {
    notificationSettings {
      id
      userId
      pushEnabled
      intervalMinutes
      activeStartTime
      activeEndTime
      dayMode
      typeRestEnd
      typeIncomplete
      typeFocusStart
      tone
      systemPermission
      lastFocusReminderSentAt
      lastEmptyTodoReminderDate
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_NOTIFICATION_SETTINGS_MUTATION = /* GraphQL */ `
  mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {
    updateNotificationSettings(input: $input) {
      id
      userId
      pushEnabled
      intervalMinutes
      activeStartTime
      activeEndTime
      dayMode
      typeRestEnd
      typeIncomplete
      typeFocusStart
      tone
      systemPermission
      lastFocusReminderSentAt
      lastEmptyTodoReminderDate
      createdAt
      updatedAt
    }
  }
`;

type NotificationSettingsQueryPayload = {
  notificationSettings: NotificationSettingsRecord;
};

type UpdateNotificationSettingsMutationPayload = {
  updateNotificationSettings: NotificationSettingsRecord;
};

export async function fetchNotificationSettings() {
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: NOTIFICATION_SETTINGS_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Notification settings fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<NotificationSettingsQueryPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL notificationSettings failed");
  }

  const settings = result.data?.notificationSettings;
  if (!settings) {
    throw new Error("GraphQL notificationSettings failed");
  }

  return settings;
}

export async function updateNotificationSettings(input: UpdateNotificationSettingsInput) {
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: UPDATE_NOTIFICATION_SETTINGS_MUTATION,
      variables: { input },
    }),
  });

  if (!response.ok) {
    throw new Error(`Notification settings update failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<UpdateNotificationSettingsMutationPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL updateNotificationSettings failed");
  }

  const settings = result.data?.updateNotificationSettings;
  if (!settings) {
    throw new Error("GraphQL updateNotificationSettings failed");
  }

  return settings;
}
