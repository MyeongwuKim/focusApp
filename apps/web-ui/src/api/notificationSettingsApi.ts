import {
  NotificationSettingsDocument,
  UpdateNotificationSettingsDocument,
  type NotificationSettingsQuery,
  type UpdateNotificationSettingsInput as GeneratedUpdateNotificationSettingsInput,
} from "../graphql/generated";
import { requestGraphql } from "./graphqlClient";

export type NotificationSettingsDayMode = "weekday" | "everyday";
export type NotificationSettingsTone = "soft" | "balanced" | "firm";

export type NotificationSettingsRecord = Omit<
  NotificationSettingsQuery["notificationSettings"],
  "dayMode" | "tone"
> & {
  dayMode: NotificationSettingsDayMode;
  tone: NotificationSettingsTone;
};

export type UpdateNotificationSettingsInput = Omit<
  GeneratedUpdateNotificationSettingsInput,
  "dayMode" | "tone"
> & {
  dayMode?: NotificationSettingsDayMode;
  tone?: NotificationSettingsTone;
};

export async function fetchNotificationSettings() {
  const data = await requestGraphql(NotificationSettingsDocument);
  return data.notificationSettings as NotificationSettingsRecord;
}

export async function updateNotificationSettings(input: UpdateNotificationSettingsInput) {
  const data = await requestGraphql(UpdateNotificationSettingsDocument, { input });
  return data.updateNotificationSettings as NotificationSettingsRecord;
}
