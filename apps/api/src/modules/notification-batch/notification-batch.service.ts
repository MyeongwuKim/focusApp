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
  pickDueScheduledTodos,
  pickDueTargetFocusTodos,
  pickFirstOpenTodo,
  type ReminderTone,
} from "./notification-batch.utils.js";

type ReminderKind =
  | "empty_todo_start"
  | "incomplete_todo"
  | "scheduled_todo_start"
  | "focus_target_elapsed";

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

const EMPTY_TODO_COPY: Record<ReminderTone, string> = {
  soft: "오늘 할일이 아직 없어요. 가볍게 하나부터 시작해볼까요?",
  balanced: "오늘 할일을 추가하고 하루를 시작해보세요.",
  firm: "오늘 할일이 비어 있습니다. 지금 바로 첫 할일을 추가해 주세요.",
};

const INCOMPLETE_COPY_BY_TONE: Record<ReminderTone, string> = {
  soft: "아직 시작하지 않았거나 잠시 멈춘 작업이에요. 가볍게 다시 시작해볼까요?",
  balanced: "아직 시작하지 않았거나 멈춘 작업이 남아 있어요. 지금 이어가면 흐름을 유지할 수 있어요.",
  firm: "아직 시작하지 않았거나 멈춘 작업이 남아 있습니다. 지금 바로 시작해 주세요.",
};

const SCHEDULED_START_COPY_BY_TONE: Record<ReminderTone, string> = {
  soft: "설정해둔 시작 시간이 됐어요. 가볍게 시작해볼까요?",
  balanced: "설정해둔 시작 시간이 됐어요. 지금 시작해볼까요?",
  firm: "설정해둔 시작 시간이 됐습니다. 지금 바로 시작해 주세요.",
};

const TARGET_FOCUS_ELAPSED_COPY_BY_TONE: Record<ReminderTone, string> = {
  soft: "설정한 집중 시간이 끝났어요. 더 이어갈지, 완료할지 정리해볼까요?",
  balanced: "설정한 집중 시간이 끝났어요. 이어가기 또는 완료를 선택해 주세요.",
  firm: "설정한 집중 시간이 지났습니다. 이어가거나 완료 처리해 주세요.",
};

const sentScheduledReminderMap = new Map<string, number>();
const SCHEDULED_REMINDER_DEDUPE_TTL_MS = 10 * 60 * 1000;
const sentTargetFocusElapsedReminderMap = new Map<string, number>();
const TARGET_FOCUS_ELAPSED_DEDUPE_TTL_MS = 45 * 60 * 1000;

export async function runNotificationBatch(input: RunNotificationBatchInput): Promise<NotificationBatchResult> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const dryRun = input.dryRun ?? false;
  const force = input.force ?? false;
  const activeSessionUserIds = Array.from(
    new Set(
      (
        await input.prisma.session.findMany({
          where: {
            expiresAt: { gt: now },
          },
          select: {
            userId: true,
          },
        })
      ).map((session) => session.userId)
    )
  );

  if (activeSessionUserIds.length === 0) {
    return {
      checkedUsers: 0,
      eligibleUsers: 0,
      sentCount: 0,
      attemptedTokenCount: 0,
      dryRun,
      force,
      deliveries: [],
    };
  }

  const settingsList = await input.prisma.notificationSettings.findMany({
    where: {
      userId: {
        in: activeSessionUserIds,
      },
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
    const reminderScheduleSettings = {
      userId: settings.userId,
      pushEnabled: settings.pushEnabled,
      intervalMinutes: settings.intervalMinutes,
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
    const firstOpenTodo = pickFirstOpenTodo(todos);
    const firstOpenTodoStatus = firstOpenTodo ? getTodoReminderStatus(firstOpenTodo) : null;
    const tone = normalizeTone(settings.tone);
    const scheduleNextReminder = async () => {
      if (dryRun) {
        return;
      }
      await input.prisma.notificationSettings.update({
        where: { userId: settings.userId },
        data: {
          nextReminderAt: computeNextReminderAtAfterRun({
            settings: reminderScheduleSettings,
            now,
            timezone,
          }),
        },
      });
    };
    const scheduleWindowMs = Math.max(env.NOTIFICATION_BATCH_INTERVAL_SECONDS * 2 * 1000 + 10000, 130 * 1000);
    const dueTargetFocusTodos = pickDueTargetFocusTodos({
      todos,
      now,
      scheduleWindowMs,
    });

    if (dueTargetFocusTodos.length > 0 && settings.typeFocusStart) {
      const dedupeTargets = dueTargetFocusTodos.filter((target) => {
        const reachedBucket = Math.floor(target.reachedAtMs / 60000);
        const dedupeKey = `${settings.userId}:${target.todoId}:${target.targetFocusMinutes}:${reachedBucket}`;
        const sentAt = sentTargetFocusElapsedReminderMap.get(dedupeKey);
        return !(sentAt && now.getTime() - sentAt <= TARGET_FOCUS_ELAPSED_DEDUPE_TTL_MS);
      });

      if (dedupeTargets.length === 0) {
        await scheduleNextReminder();
        continue;
      }

      const topTarget = dedupeTargets[0];
      const targetLabel = topTarget.label;
      const targetFocusMinutes = topTarget.targetFocusMinutes;
      const targetCountSuffix =
        dedupeTargets.length > 1 ? ` 외 ${dedupeTargets.length - 1}개 할일` : "";
      const targetBodyBase = `${targetLabel}${targetCountSuffix}, ${targetFocusMinutes}분 목표`;
      const targetBody = `${targetBodyBase}. ${TARGET_FOCUS_ELAPSED_COPY_BY_TONE[tone]}`;
      const targetPath = `/calendar?sheet=1&date=${nowInTimezone.dateKey}&focusTargetElapsed=1&todoId=${encodeURIComponent(topTarget.todoId)}`;

      deliveries.push({
        userId: settings.userId,
        kind: "focus_target_elapsed",
        title: "목표 집중시간 도달",
        body: targetBody,
        tone,
      });

      if (!dryRun) {
        const tokens = await input.prisma.pushDeviceToken.findMany({
          where: { userId: settings.userId, isActive: true },
          select: { pushToken: true },
        });
        attemptedTokenCount += tokens.length;
        if (tokens.length > 0) {
          await sendExpoPushMessages({
            entries: tokens.map((token) => ({
              pushToken: token.pushToken,
              title: "목표 집중시간 도달",
              body: targetBody,
              data: {
                kind: "focus_target_elapsed",
                taskLabel: targetLabel,
                targetFocusMinutes,
                todoId: topTarget.todoId,
                dateKey: nowInTimezone.dateKey,
                targetPath,
              },
            })),
            prisma: input.prisma,
          });
          dedupeTargets.forEach((target) => {
            const reachedBucket = Math.floor(target.reachedAtMs / 60000);
            const dedupeKey = `${settings.userId}:${target.todoId}:${target.targetFocusMinutes}:${reachedBucket}`;
            sentTargetFocusElapsedReminderMap.set(dedupeKey, now.getTime());
          });
        }
      }

      await scheduleNextReminder();
      continue;
    }

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
        await scheduleNextReminder();
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

      await scheduleNextReminder();
      continue;
    }

    const isWithinReminderCooldown =
      !force &&
      settings.lastFocusReminderSentAt !== null &&
      now.getTime() - settings.lastFocusReminderSentAt.getTime() < reminderIntervalMs;

    if (isWithinReminderCooldown) {
      await scheduleNextReminder();
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
