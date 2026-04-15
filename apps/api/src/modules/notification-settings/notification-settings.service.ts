import {
  NotificationSettingsRepository,
  type NotificationSettingsUpdateInput,
} from "./notification-settings.repository.js";

interface UpdateNotificationSettingsInput {
  userId: string;
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
}

const ALLOWED_INTERVAL_MINUTES = new Set([1, 30, 60, 90, 120]);
const ALLOWED_DAY_MODE = new Set(["weekday", "everyday"]);
const ALLOWED_TONE = new Set(["soft", "balanced", "firm"]);
const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class NotificationSettingsService {
  constructor(private readonly repository: NotificationSettingsRepository) {}

  getNotificationSettings(userId: string) {
    return this.repository.upsertDefaults(userId);
  }

  async updateNotificationSettings(input: UpdateNotificationSettingsInput) {
    const normalized = normalizeUpdateInput(input);
    return this.repository.updateByUserId(input.userId, normalized);
  }
}

function normalizeUpdateInput(input: UpdateNotificationSettingsInput): NotificationSettingsUpdateInput {
  const next: NotificationSettingsUpdateInput = {};

  if (typeof input.pushEnabled === "boolean") {
    next.pushEnabled = input.pushEnabled;
  }

  if (input.intervalMinutes !== undefined) {
    if (!ALLOWED_INTERVAL_MINUTES.has(input.intervalMinutes)) {
      throw new Error("NOTIFICATION_INTERVAL_INVALID");
    }
    next.intervalMinutes = input.intervalMinutes;
  }

  if (input.activeStartTime !== undefined) {
    const start = input.activeStartTime.trim();
    if (!HHMM_PATTERN.test(start)) {
      throw new Error("NOTIFICATION_ACTIVE_TIME_INVALID");
    }
    next.activeStartTime = start;
  }

  if (input.activeEndTime !== undefined) {
    const end = input.activeEndTime.trim();
    if (!HHMM_PATTERN.test(end)) {
      throw new Error("NOTIFICATION_ACTIVE_TIME_INVALID");
    }
    next.activeEndTime = end;
  }

  if (input.dayMode !== undefined) {
    const dayMode = input.dayMode.trim();
    if (!ALLOWED_DAY_MODE.has(dayMode)) {
      throw new Error("NOTIFICATION_DAY_MODE_INVALID");
    }
    next.dayMode = dayMode;
  }

  if (typeof input.typeRestEnd === "boolean") {
    next.typeRestEnd = input.typeRestEnd;
  }

  if (typeof input.typeIncomplete === "boolean") {
    next.typeIncomplete = input.typeIncomplete;
  }

  if (typeof input.typeFocusStart === "boolean") {
    next.typeFocusStart = input.typeFocusStart;
  }

  if (input.tone !== undefined) {
    const tone = input.tone.trim();
    if (!ALLOWED_TONE.has(tone)) {
      throw new Error("NOTIFICATION_TONE_INVALID");
    }
    next.tone = tone;
  }

  if (input.systemPermission !== undefined) {
    next.systemPermission = input.systemPermission ? input.systemPermission.trim() : null;
  }

  if (input.lastFocusReminderSentAt !== undefined) {
    if (input.lastFocusReminderSentAt === null) {
      next.lastFocusReminderSentAt = null;
    } else {
      const parsed = new Date(input.lastFocusReminderSentAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("NOTIFICATION_LAST_FOCUS_SENT_AT_INVALID");
      }
      next.lastFocusReminderSentAt = parsed;
    }
  }

  if (input.lastEmptyTodoReminderDate !== undefined) {
    next.lastEmptyTodoReminderDate = input.lastEmptyTodoReminderDate
      ? input.lastEmptyTodoReminderDate.trim()
      : null;
  }

  return next;
}
