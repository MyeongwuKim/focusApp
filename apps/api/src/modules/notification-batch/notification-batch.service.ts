import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";

type ReminderTone = "soft" | "balanced" | "firm";
type ReminderKind = "focus_start" | "empty_todo_start" | "incomplete_todo" | "scheduled_todo_start";

type RunNotificationBatchInput = {
  prisma: PrismaClient;
  now?: Date;
  dryRun?: boolean;
  force?: boolean;
  timezone?: string;
  logger?: FastifyBaseLogger;
};

export type NotificationBatchDelivery = {
  userId: string;
  kind: ReminderKind;
  title: string;
  body: string;
  tone: ReminderTone;
};

export type NotificationBatchResult = {
  checkedUsers: number;
  eligibleUsers: number;
  sentCount: number;
  attemptedTokenCount: number;
  dryRun: boolean;
  force: boolean;
  deliveries: NotificationBatchDelivery[];
};

const DEFAULT_TIMEZONE = "Asia/Seoul";
const WEEKDAY_SET = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

const FOCUS_COPY: Record<ReminderTone, string> = {
  soft: "집중 시간이에요. 오늘 목표부터 차분히 시작해볼까요?",
  balanced: "집중 시작 시간입니다. 우선순위 작업부터 진행해보세요.",
  firm: "집중 시작 시간입니다. 즉시 핵심 작업을 시작해 주세요.",
};

const EMPTY_TODO_COPY: Record<ReminderTone, string> = {
  soft: "오늘 할일이 아직 없어요. 가볍게 하나부터 시작해볼까요?",
  balanced: "오늘 할일을 추가하고 하루를 시작해보세요.",
  firm: "오늘 할일이 비어 있습니다. 지금 바로 첫 할일을 추가해 주세요.",
};

const INCOMPLETE_COPY_BY_TONE: Record<ReminderTone, string> = {
  soft: "아직 진행하지 않은 작업이에요. 가볍게 시작해볼까요?",
  balanced: "아직 진행 중인 작업이 남아 있어요. 지금 이어가면 흐름을 유지할 수 있어요.",
  firm: "진행 중인 작업이 남아 있습니다. 지금 바로 시작해 주세요.",
};

const SCHEDULED_START_COPY_BY_TONE: Record<ReminderTone, string> = {
  soft: "설정해둔 시작 시간이 됐어요. 가볍게 시작해볼까요?",
  balanced: "설정해둔 시작 시간이 됐어요. 지금 시작해볼까요?",
  firm: "설정해둔 시작 시간이 됐습니다. 지금 바로 시작해 주세요.",
};

const sentScheduledReminderMap = new Map<string, number>();
const SCHEDULED_REMINDER_DEDUPE_TTL_MS = 10 * 60 * 1000;

export async function runNotificationBatch(input: RunNotificationBatchInput): Promise<NotificationBatchResult> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const dryRun = input.dryRun ?? false;
  const force = input.force ?? false;

  const settingsList = await input.prisma.notificationSettings.findMany({
    where: {
      pushEnabled: true,
      systemPermission: "granted",
      OR: [{ typeFocusStart: true }, { typeIncomplete: true }],
    },
  });

  const nowInTimezone = getZonedNow(now, timezone);
  const deliveries: NotificationBatchDelivery[] = [];
  let eligibleUsers = 0;
  let attemptedTokenCount = 0;

  for (const settings of settingsList) {
    if (!force) {
      if (!isDayAllowed(settings.dayMode, nowInTimezone.weekdayShort)) {
        continue;
      }

      const startMinutes = parseHHmmToMinutes(settings.activeStartTime);
      const endMinutes = parseHHmmToMinutes(settings.activeEndTime);
      if (startMinutes === null || endMinutes === null) {
        continue;
      }

      const nowMinutes = nowInTimezone.hour * 60 + nowInTimezone.minute;
      if (!isWithinWindow(nowMinutes, startMinutes, endMinutes)) {
        continue;
      }

    }

    eligibleUsers += 1;

    const dailyLog = await input.prisma.dailyLog.findUnique({
      where: {
        userId_dateKey: {
          userId: settings.userId,
          dateKey: nowInTimezone.dateKey,
        },
      },
      select: {
        todoCount: true,
        todos: true,
      },
    });

    const todos = dailyLog?.todos ?? [];
    const todoCount = dailyLog?.todoCount ?? todos.length;
    const incompleteCount = todos.filter((todo) => !todo.done).length;
    const tone = normalizeTone(settings.tone);
    const scheduleWindowMs = Math.max(env.NOTIFICATION_BATCH_INTERVAL_SECONDS * 2 * 1000 + 10000, 130 * 1000);
    const scheduledTargets = pickDueScheduledTodos({
      todos,
      now,
      scheduleWindowMs,
    });

    if (scheduledTargets.length > 0 && settings.typeFocusStart) {
      const dedupeTargets = scheduledTargets.filter((target) => {
        const scheduledBucket = Math.floor(target.scheduledAtMs / 60000);
        const dedupeKey = `${settings.userId}:${target.todoId}:${scheduledBucket}`;
        const sentAt = sentScheduledReminderMap.get(dedupeKey);
        return !(sentAt && now.getTime() - sentAt <= SCHEDULED_REMINDER_DEDUPE_TTL_MS);
      });

      if (dedupeTargets.length === 0) {
        continue;
      }

      const scheduledLabel = dedupeTargets[0].label;
      const scheduledCountSuffix =
        dedupeTargets.length > 1 ? ` 외 ${dedupeTargets.length - 1}개 할일` : "";
      const scheduledBody = `${scheduledLabel}, ${SCHEDULED_START_COPY_BY_TONE[tone]}`;
      const scheduledBodyWithCount =
        dedupeTargets.length > 1
          ? `${scheduledLabel}${scheduledCountSuffix}, ${SCHEDULED_START_COPY_BY_TONE[tone]}`
          : scheduledBody;

      deliveries.push({
        userId: settings.userId,
        kind: "scheduled_todo_start",
        title: "할일 시작 시간",
        body: scheduledBodyWithCount,
        tone,
      });

      if (!dryRun) {
        const targetPath = `/date-tasks?date=${nowInTimezone.dateKey}`;
        const tokens = await input.prisma.pushDeviceToken.findMany({
          where: { userId: settings.userId, isActive: true },
          select: { pushToken: true },
        });
        attemptedTokenCount += tokens.length;
        if (tokens.length > 0) {
          await sendExpoPushMessages({
            entries: tokens.map((token) => ({
              pushToken: token.pushToken,
              title: "할일 시작 시간",
              body: scheduledBodyWithCount,
              data: {
                kind: "scheduled_todo_start",
                taskLabel: scheduledLabel,
                taskCount: dedupeTargets.length,
                dateKey: nowInTimezone.dateKey,
                targetPath,
              },
            })),
            prisma: input.prisma,
          });
          dedupeTargets.forEach((target) => {
            const scheduledBucket = Math.floor(target.scheduledAtMs / 60000);
            const dedupeKey = `${settings.userId}:${target.todoId}:${scheduledBucket}`;
            sentScheduledReminderMap.set(dedupeKey, now.getTime());
          });
        }
      }

      continue;
    }

    if (
      !force &&
      !isReminderDue({
        now,
        nowDateKey: nowInTimezone.dateKey,
        nowMinutes: nowInTimezone.hour * 60 + nowInTimezone.minute,
        startMinutes: parseHHmmToMinutes(settings.activeStartTime) ?? 0,
        lastSentAt: settings.lastFocusReminderSentAt,
        intervalMinutes: settings.intervalMinutes,
        timezone,
      })
    ) {
      continue;
    }

    if (todoCount === 0) {
      if (!settings.typeFocusStart) {
        continue;
      }
      if (!force && settings.lastEmptyTodoReminderDate === nowInTimezone.dateKey) {
        continue;
      }

      deliveries.push({
        userId: settings.userId,
        kind: "empty_todo_start",
        title: "오늘 할일 시작",
        body: EMPTY_TODO_COPY[tone],
        tone,
      });

      if (!dryRun) {
        const targetPath = `/date-tasks?date=${nowInTimezone.dateKey}`;
        const tokens = await input.prisma.pushDeviceToken.findMany({
          where: { userId: settings.userId, isActive: true },
          select: { pushToken: true },
        });
        attemptedTokenCount += tokens.length;
        if (tokens.length > 0) {
          await sendExpoPushMessages({
            entries: tokens.map((token) => ({
              pushToken: token.pushToken,
              title: "오늘 할일 시작",
              body: EMPTY_TODO_COPY[tone],
              data: {
                kind: "empty_todo_start",
                dateKey: nowInTimezone.dateKey,
                targetPath,
              },
            })),
            prisma: input.prisma,
          });
          await updateReminderMarkers(input.prisma, settings.userId, {
            lastFocusReminderSentAt: now,
            lastEmptyTodoReminderDate: nowInTimezone.dateKey,
          });
        }
      }
      continue;
    }

    if (incompleteCount > 0 && settings.typeIncomplete) {
      const incompleteLabel = pickFirstIncompleteTodoLabel(todos) ?? "미완료 작업";
      const incompleteBody = `${incompleteLabel}, ${INCOMPLETE_COPY_BY_TONE[tone]}`;

      deliveries.push({
        userId: settings.userId,
        kind: "incomplete_todo",
        title: "작업 리마인드",
        body: incompleteBody,
        tone,
      });

      if (!dryRun) {
        const targetPath = `/date-tasks?date=${nowInTimezone.dateKey}`;
        const tokens = await input.prisma.pushDeviceToken.findMany({
          where: { userId: settings.userId, isActive: true },
          select: { pushToken: true },
        });
        attemptedTokenCount += tokens.length;
        if (tokens.length > 0) {
          await sendExpoPushMessages({
            entries: tokens.map((token) => ({
              pushToken: token.pushToken,
              title: "작업 리마인드",
              body: incompleteBody,
              data: {
                kind: "incomplete_todo",
                taskLabel: incompleteLabel,
                dateKey: nowInTimezone.dateKey,
                targetPath,
              },
            })),
            prisma: input.prisma,
          });
          await updateReminderMarkers(input.prisma, settings.userId, {
            lastFocusReminderSentAt: now,
          });
        }
      }
      continue;
    }

    if (!settings.typeFocusStart) {
      continue;
    }

    deliveries.push({
      userId: settings.userId,
      kind: "focus_start",
      title: "집중 시작",
      body: FOCUS_COPY[tone],
      tone,
    });

    if (!dryRun) {
      const targetPath = `/date-tasks?date=${nowInTimezone.dateKey}`;
      const tokens = await input.prisma.pushDeviceToken.findMany({
        where: { userId: settings.userId, isActive: true },
        select: { pushToken: true },
      });
      attemptedTokenCount += tokens.length;
      if (tokens.length > 0) {
        await sendExpoPushMessages({
          entries: tokens.map((token) => ({
            pushToken: token.pushToken,
            title: "집중 시작",
            body: FOCUS_COPY[tone],
            data: {
              kind: "focus_start",
              dateKey: nowInTimezone.dateKey,
              targetPath,
            },
          })),
          prisma: input.prisma,
        });
        await updateReminderMarkers(input.prisma, settings.userId, {
          lastFocusReminderSentAt: now,
        });
      }
    }
  }

  if (deliveries.length > 0) {
    input.logger?.info(
      {
        checkedUsers: settingsList.length,
        eligibleUsers,
        sentCount: deliveries.length,
        attemptedTokenCount,
        dryRun,
        force,
        deliveries,
      },
      "[notification-batch] run completed"
    );
  }

  return {
    checkedUsers: settingsList.length,
    eligibleUsers,
    sentCount: deliveries.length,
    attemptedTokenCount,
    dryRun,
    force,
    deliveries,
  };
}

type ExpoPushEntry = {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

async function sendExpoPushMessages(input: { entries: ExpoPushEntry[]; prisma: PrismaClient }) {
  if (input.entries.length === 0) {
    return;
  }

  const invalidTokens = new Set<string>();

  for (const entry of input.entries) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify([
          {
            to: entry.pushToken,
            sound: "default",
            title: entry.title,
            body: entry.body,
            data: entry.data ?? {},
          },
        ]),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.warn(`[expo-push] send failed: ${response.status} ${detail}`);
        continue;
      }

      const result = (await response.json()) as {
        data?: Array<{
          id?: string;
          status?: "ok" | "error";
          details?: { error?: string };
          message?: string;
        }>;
      };

      const ticket = result.data?.[0];
      if (!ticket) {
        continue;
      }
      if (ticket.status === "error") {
        const errorCode = ticket.details?.error ?? ticket.message ?? "unknown";
        console.warn("[expo-push] ticket error:", errorCode);
        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.add(entry.pushToken);
        }
        continue;
      }

      if (!ticket.id) {
        continue;
      }

      const receiptResponse = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify({ ids: [ticket.id] }),
      });

      if (!receiptResponse.ok) {
        console.warn(`[expo-push] receipt fetch failed: ${receiptResponse.status}`);
        continue;
      }

      const receiptResult = (await receiptResponse.json()) as {
        data?: Record<
          string,
          {
            status?: "ok" | "error";
            details?: { error?: string };
            message?: string;
          }
        >;
      };

      const receipt = receiptResult.data?.[ticket.id];
      if (!receipt || receipt.status === "ok") {
        continue;
      }
      const errorCode = receipt.details?.error ?? "unknown";
      console.warn("[expo-push] receipt error:", errorCode, receipt.message ?? "");
      if (errorCode === "DeviceNotRegistered") {
        invalidTokens.add(entry.pushToken);
      }
    } catch (error) {
      console.warn("[expo-push] unexpected send error:", error);
    }
  }

  if (invalidTokens.size > 0) {
    await input.prisma.pushDeviceToken.updateMany({
      where: { pushToken: { in: Array.from(invalidTokens) } },
      data: { isActive: false },
    });
  }
}

async function updateReminderMarkers(
  prisma: PrismaClient,
  userId: string,
  input: { lastFocusReminderSentAt: Date; lastEmptyTodoReminderDate?: string }
) {
  await prisma.notificationSettings.update({
    where: { userId },
    data: {
      lastFocusReminderSentAt: input.lastFocusReminderSentAt,
      ...(input.lastEmptyTodoReminderDate ? { lastEmptyTodoReminderDate: input.lastEmptyTodoReminderDate } : {}),
    },
  });
}

function isDayAllowed(dayMode: string, weekdayShort: string) {
  if (dayMode === "everyday") {
    return true;
  }
  return WEEKDAY_SET.has(weekdayShort);
}

function parseHHmmToMinutes(value: string): number | null {
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!matched) {
    return null;
  }
  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  return hours * 60 + minutes;
}

function isWithinWindow(nowMinutes: number, startMinutes: number, endMinutes: number) {
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function isReminderDue(input: {
  now: Date;
  nowDateKey: string;
  nowMinutes: number;
  startMinutes: number;
  lastSentAt: Date | null;
  intervalMinutes: number;
  timezone: string;
}) {
  if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes <= 0) {
    return false;
  }

  if (!input.lastSentAt) {
    return input.nowMinutes >= input.startMinutes;
  }

  const lastSentDateKey = getDateKeyInTimezone(input.lastSentAt, input.timezone);
  if (lastSentDateKey !== input.nowDateKey) {
    return input.nowMinutes >= input.startMinutes;
  }

  const diffMs = input.now.getTime() - input.lastSentAt.getTime();
  if (diffMs < 0) {
    return false;
  }

  return diffMs >= input.intervalMinutes * 60 * 1000;
}

function normalizeTone(value: string): ReminderTone {
  if (value === "balanced" || value === "firm") {
    return value;
  }
  return "soft";
}

function getDateKeyInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getZonedNow(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  const year = partValue("year");
  const month = partValue("month");
  const day = partValue("day");
  const hour = Number(partValue("hour"));
  const minute = Number(partValue("minute"));
  const weekdayShort = partValue("weekday");

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    weekdayShort,
  };
}

function pickFirstIncompleteTodoLabel(
  todos: Array<{ done: boolean; content?: string | null; titleSnapshot?: string | null; order?: number }>
) {
  const sorted = [...todos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const firstIncomplete = sorted.find((todo) => !todo.done);
  if (!firstIncomplete) {
    return null;
  }

  const snapshot = firstIncomplete.titleSnapshot?.trim();
  if (snapshot) {
    return snapshot;
  }

  const content = firstIncomplete.content?.trim();
  if (content) {
    return content;
  }

  return "미완료 작업";
}

function pickDueScheduledTodos(input: {
  todos: Array<{
    id?: string;
    done: boolean;
    startedAt?: Date | null;
    pausedAt?: Date | null;
    completedAt?: Date | null;
    scheduledStartAt?: Date | null;
    content?: string | null;
    titleSnapshot?: string | null;
    order?: number;
  }>;
  now: Date;
  scheduleWindowMs: number;
}) {
  const sorted = [...input.todos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const matches: Array<{ label: string; todoId: string; scheduledAtMs: number }> = [];

  for (const todo of sorted) {
    if (todo.done || todo.completedAt || !todo.scheduledStartAt) {
      continue;
    }

    const scheduledAt = new Date(todo.scheduledStartAt).getTime();
    if (!Number.isFinite(scheduledAt)) {
      continue;
    }

    const diffMs = input.now.getTime() - scheduledAt;
    if (diffMs < 0 || diffMs > input.scheduleWindowMs) {
      continue;
    }

    const label = todo.titleSnapshot?.trim() || todo.content?.trim() || "할일";
    matches.push({
      label,
      todoId: todo.id ?? label,
      scheduledAtMs: scheduledAt,
    });
  }

  return matches;
}
