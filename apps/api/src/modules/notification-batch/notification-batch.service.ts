import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import {
  computeNextReminderAtAfterRun,
  computeNextReminderAtForSettingsRefresh,
} from "./notification-reminder-schedule.js";
import {
  getTodoReminderStatus,
  getZonedNow,
  getTodoLabel,
  isDayAllowed,
  isWithinWindow,
  normalizeTone,
  parseHHmmToMinutes,
  pickFirstOpenTodo,
  type ReminderTone,
} from "./notification-batch.utils.js";

type ReminderKind =
  | "empty_todo_start"
  | "incomplete_todo";

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
const NEW_USER_REMINDER_GRACE_MS = 24 * 60 * 60 * 1000;
const INCOMPLETE_TODO_TITLE = "할일 이어가기";

type EmptyTodoMessage = {
  title: string;
  body: string;
};

const EMPTY_TODO_MESSAGES_BY_TONE: Record<ReminderTone, readonly EmptyTodoMessage[]> = {
  soft: [
    {
      title: "오늘은 뭐부터 해볼까요?",
      body: "떠오르는 일 하나만 가볍게 적어봐요.",
    },
    {
      title: "천천히 시작해도 괜찮아요",
      body: "지금 생각나는 일 하나만 적어둘까요?",
    },
    {
      title: "오늘 할 일, 하나만 골라봐요",
      body: "작은 것부터 시작하면 마음도 조금 가벼워져요.",
    },
    {
      title: "아직 비어 있어도 괜찮아요",
      body: "부담 없는 일부터 하나씩 정해봐요.",
    },
  ],
  balanced: [
    {
      title: "오늘 뭐부터 할까요?",
      body: "가장 먼저 끝내고 싶은 일 하나를 적어봐요.",
    },
    {
      title: "잠깐, 오늘 할 일은 정했나요?",
      body: "생각해둔 게 있다면 잊기 전에 적어둬요.",
    },
    {
      title: "오늘 계획이 아직 비어 있어요",
      body: "지금 떠오르는 일부터 하나 추가해봐요.",
    },
    {
      title: "하루 시작 전에 하나만",
      body: "오늘 꼭 하고 싶은 일을 먼저 골라봐요.",
    },
  ],
  firm: [
    {
      title: "오늘 할 일, 아직 안 정했어요",
      body: "지금 해야 할 일 하나부터 적어봐요.",
    },
    {
      title: "미루기 전에 하나만 정해요",
      body: "가장 중요한 일이 뭔지 지금 골라봐요.",
    },
    {
      title: "오늘 계획이 아직 비어 있어요",
      body: "지금 바로 시작할 일 하나를 적어봐요.",
    },
    {
      title: "이제 첫 할 일을 정할 때예요",
      body: "고민은 잠깐 멈추고 하나부터 골라봐요.",
    },
  ],
};

const INCOMPLETE_COPY_BY_TONE: Record<ReminderTone, string> = {
  soft: "가볍게 이어가볼까요?",
  balanced: "지금 이어가면 흐름을 다시 잡을 수 있어요.",
  firm: "다음 할일로 남아 있어요. 지금 시작해 주세요.",
};

const REMINDER_LOCK_TTL_MS = 90 * 1000;

function pickEmptyTodoMessage(tone: ReminderTone) {
  const candidates = EMPTY_TODO_MESSAGES_BY_TONE[tone];
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? candidates[0];
}

export async function runNotificationBatch(input: RunNotificationBatchInput): Promise<NotificationBatchResult> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const dryRun = input.dryRun ?? false;
  const force = input.force ?? false;

  const settingsList = await input.prisma.notificationSettings.findMany({
    where: {
      pushEnabled: true,
      systemPermission: "granted",
      AND: [{ OR: [{ typeFocusStart: true }, { typeIncomplete: true }] }],
    },
  });

  const nowInTimezone = getZonedNow(now, timezone);
  const userCreatedAtById = new Map<string, Date>();
  if (!force && settingsList.length > 0) {
    const users = await input.prisma.user.findMany({
      where: {
        id: {
          in: Array.from(new Set(settingsList.map((settings) => settings.userId))),
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
    users.forEach((user) => {
      userCreatedAtById.set(user.id, user.createdAt);
    });
  }

  const deliveries: NotificationBatchDelivery[] = [];
  let eligibleUsers = 0;
  let attemptedTokenCount = 0;

  for (const settings of settingsList) {
    let acquiredLockToken: string | null = null;
    const reminderScheduleSettings = {
      userId: settings.userId,
      pushEnabled: settings.pushEnabled,
      intervalMinutes: settings.intervalMinutes,
      pendingIntervalMinutes: settings.pendingIntervalMinutes,
      activeStartTime: settings.activeStartTime,
      activeEndTime: settings.activeEndTime,
      dayMode: settings.dayMode,
      typeIncomplete: settings.typeIncomplete,
      typeFocusStart: settings.typeFocusStart,
      systemPermission: settings.systemPermission,
      nextReminderAt: settings.nextReminderAt,
    };
    const reminderIntervalMs = Math.max(settings.intervalMinutes, 1) * 60 * 1000;

    if (!force) {
      const createdAt = userCreatedAtById.get(settings.userId);
      if (createdAt && now.getTime() - createdAt.getTime() < NEW_USER_REMINDER_GRACE_MS) {
        continue;
      }

      if (settings.nextReminderAt) {
        const nextReminderAtMs = settings.nextReminderAt.getTime();
        const nowMs = now.getTime();

        if (Number.isFinite(nextReminderAtMs) && nextReminderAtMs > nowMs + reminderIntervalMs) {
          const repairedNextReminderAt = computeNextReminderAtForSettingsRefresh({
            settings: reminderScheduleSettings,
            now,
            timezone,
          });

          if (!dryRun) {
            await input.prisma.notificationSettings.update({
              where: { userId: settings.userId },
              data: { nextReminderAt: repairedNextReminderAt },
            });
          }
          if (!repairedNextReminderAt || repairedNextReminderAt.getTime() > nowMs) {
            continue;
          }
        } else if (nextReminderAtMs > nowMs) {
          continue;
        }
      }
    }

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

    if (!force && !dryRun) {
      const lockToken = createReminderLockToken(settings.userId, now);
      const lockUntil = new Date(now.getTime() + REMINDER_LOCK_TTL_MS);
      const claimed = await input.prisma.notificationSettings.updateMany({
          where: {
            userId: settings.userId,
            pushEnabled: true,
            systemPermission: "granted",
            nextReminderAt: settings.nextReminderAt ?? null,
            OR: [
              { reminderLockUntil: null },
              { reminderLockUntil: { isSet: false } },
              { reminderLockUntil: { lt: now } },
            ],
          },
        data: {
          reminderLockToken: lockToken,
          reminderLockUntil: lockUntil,
        },
      });

      if (claimed.count === 0) {
        continue;
      }
      acquiredLockToken = lockToken;
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
    const firstOpenTodo = pickFirstOpenTodo(todos, nowInTimezone.dateKey);
    const firstOpenTodoStatus = firstOpenTodo ? getTodoReminderStatus(firstOpenTodo) : null;
    const tone = normalizeTone(settings.tone);
    const scheduleNextReminder = async () => {
      if (dryRun) {
        return;
      }

      const hasPendingInterval =
        Number.isFinite(reminderScheduleSettings.pendingIntervalMinutes) &&
        (reminderScheduleSettings.pendingIntervalMinutes as number) > 0;
      const nextIntervalMinutes = hasPendingInterval
        ? (reminderScheduleSettings.pendingIntervalMinutes as number)
        : reminderScheduleSettings.intervalMinutes;

      const nextReminderAt = computeNextReminderAtAfterRun({
        settings: reminderScheduleSettings,
        now,
        timezone,
      });
      const updateData = {
        nextReminderAt,
        intervalMinutes: nextIntervalMinutes,
        pendingIntervalMinutes: hasPendingInterval ? null : settings.pendingIntervalMinutes ?? null,
        ...(acquiredLockToken ? { reminderLockToken: null, reminderLockUntil: null } : {}),
      };

      if (acquiredLockToken) {
        await input.prisma.notificationSettings.updateMany({
          where: {
            userId: settings.userId,
            reminderLockToken: acquiredLockToken,
          },
          data: updateData,
        });
        acquiredLockToken = null;
        return;
      }

      await input.prisma.notificationSettings.update({
        where: { userId: settings.userId },
        data: updateData,
      });
    };
    if (todoCount === 0) {
      if (!settings.typeFocusStart) {
        await scheduleNextReminder();
        continue;
      }
      if (!force && settings.lastEmptyTodoReminderDate === nowInTimezone.dateKey) {
        await scheduleNextReminder();
        continue;
      }

      const emptyTodoMessage = pickEmptyTodoMessage(tone);
      deliveries.push({
        userId: settings.userId,
        kind: "empty_todo_start",
        title: emptyTodoMessage.title,
        body: emptyTodoMessage.body,
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
              title: emptyTodoMessage.title,
              body: emptyTodoMessage.body,
              data: {
                kind: "empty_todo_start",
                dateKey: nowInTimezone.dateKey,
                targetPath,
              },
            })),
            prisma: input.prisma,
          });
          await updateLastEmptyTodoReminderDate(input.prisma, settings.userId, nowInTimezone.dateKey);
        }
      }
      await scheduleNextReminder();
      continue;
    }

    if (
      settings.typeIncomplete &&
      firstOpenTodo &&
      (firstOpenTodoStatus === "not_started" || firstOpenTodoStatus === "paused")
    ) {
      const incompleteLabel = getTodoLabel(firstOpenTodo);
      const incompleteBody = `${incompleteLabel}, ${INCOMPLETE_COPY_BY_TONE[tone]}`;

      deliveries.push({
        userId: settings.userId,
        kind: "incomplete_todo",
        title: INCOMPLETE_TODO_TITLE,
        body: incompleteBody,
        tone,
      });

      if (!dryRun) {
        const todoIdForPrompt = firstOpenTodo.id ?? null;
        const targetPath = todoIdForPrompt
          ? `/date-tasks?date=${nowInTimezone.dateKey}&startTodoPrompt=1&startTodoPromptSource=incomplete&todoId=${encodeURIComponent(todoIdForPrompt)}`
          : `/date-tasks?date=${nowInTimezone.dateKey}`;
        const tokens = await input.prisma.pushDeviceToken.findMany({
          where: { userId: settings.userId, isActive: true },
          select: { pushToken: true },
        });
        attemptedTokenCount += tokens.length;
        if (tokens.length > 0) {
          await sendExpoPushMessages({
            entries: tokens.map((token) => ({
              pushToken: token.pushToken,
              title: INCOMPLETE_TODO_TITLE,
              body: incompleteBody,
              data: {
                kind: "incomplete_todo",
                taskLabel: incompleteLabel,
                todoId: todoIdForPrompt,
                dateKey: nowInTimezone.dateKey,
                targetPath,
              },
            })),
            prisma: input.prisma,
          });
        }
      }
      await scheduleNextReminder();
      continue;
    }

    if (!settings.typeFocusStart) {
      await scheduleNextReminder();
      continue;
    }

    if (firstOpenTodoStatus === "in_progress") {
      await scheduleNextReminder();
      continue;
    }

    await scheduleNextReminder();
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

async function updateLastEmptyTodoReminderDate(prisma: PrismaClient, userId: string, dateKey: string) {
  await prisma.notificationSettings.update({
    where: { userId },
    data: {
      lastEmptyTodoReminderDate: dateKey,
    },
  });
}

function createReminderLockToken(userId: string, now: Date) {
  return `${userId}:${now.getTime()}:${Math.random().toString(36).slice(2, 10)}`;
}
