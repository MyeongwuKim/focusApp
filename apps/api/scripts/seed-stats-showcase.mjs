import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = 30;

function readOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}

const USER_EMAIL = readOption("email").toLowerCase();
const END_DATE_KEY = readOption("end") || new Date().toISOString().slice(0, 10);
const APPLY = process.argv.includes("--apply");

function assertDateKey(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format`);
  }
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function atKoreanTime(dateKey, hour, minute = 0) {
  return new Date(`${dateKey}T${pad2(hour)}:${pad2(minute)}:00.000+09:00`);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function createSeededRandom(seedText) {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function pickOne(items, random) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function uniqueTasks(tasks) {
  const seen = new Set();
  return tasks.filter((task) => {
    if (!task || seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });
}

function compactEmailForFilename(email) {
  return email.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function buildBackupPath(email) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(tmpdir(), `focus-hybrid-stats-seed-${compactEmailForFilename(email)}-${timestamp}.json`);
}

function getPatternForTask(title, occurrence, random) {
  if (title === "기능 구현") {
    const focusMinutes = [30, 45, 60, 75, 90, 105][occurrence % 6];
    const resumeCount = [0, 1, 1, 2, 3, 4][occurrence % 6];
    return { focusMinutes, resumeCount };
  }

  if (title === "타입스크립트") {
    const focusMinutes = [35, 80, 50, 95, 60, 40][occurrence % 6];
    const resumeCount = [2, 0, 3, 1, 2, 1][occurrence % 6];
    return { focusMinutes, resumeCount };
  }

  if (title === "리팩터링") {
    const focusMinutes = [95, 75, 60, 45, 35][occurrence % 5];
    const resumeCount = [0, 1, 1, 2, 3][occurrence % 5];
    return { focusMinutes, resumeCount };
  }

  const focusMinutes = 20 + Math.floor(random() * 71);
  const resumeCount = Math.max(
    0,
    Math.min(4, Math.floor((focusMinutes - 20) / 28) + (random() < 0.25 ? 1 : 0))
  );
  return { focusMinutes, resumeCount };
}

function getNearestTargetMinutes(focusMinutes) {
  const targets = [25, 45, 60, 90];
  return targets.reduce((nearest, target) =>
    Math.abs(target - focusMinutes) < Math.abs(nearest - focusMinutes) ? target : nearest
  );
}

function buildTodo({
  dateKey,
  task,
  order,
  startMinutes,
  occurrence,
  random,
  isPrimary,
}) {
  const shouldRemainNotStarted = !isPrimary && random() < 0.12;
  const done = shouldRemainNotStarted ? false : isPrimary ? random() < 0.9 : random() < 0.76;
  const { focusMinutes, resumeCount: patternedResumeCount } = getPatternForTask(
    task.title,
    occurrence,
    random
  );
  const resumeCount = shouldRemainNotStarted ? 0 : patternedResumeCount;
  const pausedMinutes = resumeCount * (4 + Math.floor(random() * 5));
  const startedAt = shouldRemainNotStarted
    ? null
    : atKoreanTime(dateKey, Math.floor(startMinutes / 60), startMinutes % 60);
  const endedAt = startedAt ? addMinutes(startedAt, focusMinutes + pausedMinutes) : null;
  const createdAt = atKoreanTime(
    dateKey,
    Math.floor(Math.max(startMinutes - 15, 0) / 60),
    Math.max(startMinutes - 15, 0) % 60
  );
  const scheduledStartAt =
    random() < 0.45
      ? atKoreanTime(dateKey, Math.floor(startMinutes / 60), Math.floor(startMinutes / 15) * 15 % 60)
      : null;

  return {
    todo: {
      id: randomUUID(),
      taskId: task.id,
      titleSnapshot: task.title,
      content: task.title,
      done,
      order,
      createdAt,
      startedAt,
      scheduledStartAt,
      targetFocusMinutes: getNearestTargetMinutes(focusMinutes),
      muteReminderDateKey: null,
      pausedAt: !done && startedAt ? endedAt : null,
      completedAt: done ? endedAt : null,
      deviationSeconds: pausedMinutes * 60,
      resumeCount,
      actualFocusSeconds: done ? focusMinutes * 60 : null,
    },
    elapsedMinutes: shouldRemainNotStarted ? 10 : focusMinutes + pausedMinutes,
  };
}

function buildMemo(random) {
  if (random() < 0.55) {
    return null;
  }
  return pickOne(
    [
      "오전에는 계획대로 진행했고 오후에는 짧게 나눠서 마무리했다.",
      "예상보다 오래 걸린 작업은 다음 일정에서 여유 시간을 더 잡기로 했다.",
      "집중이 끊긴 작업부터 다시 정리하니 마무리가 한결 수월했다.",
      "핵심 작업을 먼저 끝내고 남은 시간에는 문서와 테스트를 정리했다.",
      "시작 전 목표 시간을 정해두니 작업 전환이 덜 급하게 느껴졌다.",
      "오늘은 진행 중인 작업을 늘리기보다 끝내는 데 집중했다.",
    ],
    random
  );
}

function buildSeedLogs({ userId, tasks, startDate, endDate }) {
  const taskByTitle = new Map(tasks.map((task) => [task.title, task]));
  const primaryTitles = ["기능 구현", "타입스크립트"];
  const secondaryTitles = ["리액트", "알고리즘", "리팩터링", "버그 수정", "테스트 작성", "CS 복습"];
  const recordTitles = ["일일 회고", "주간 계획", "아이디어 정리", "문서 업데이트"];
  const availablePrimary = primaryTitles.map((title) => taskByTitle.get(title)).filter(Boolean);
  const availableSecondary = secondaryTitles.map((title) => taskByTitle.get(title)).filter(Boolean);
  const availableRecords = recordTitles.map((title) => taskByTitle.get(title)).filter(Boolean);

  if (availablePrimary.length < 2 || availableSecondary.length < 3 || availableRecords.length < 2) {
    throw new Error("Expected study, project, and record tasks were not found for the target user");
  }

  const occurrenceByTaskId = new Map();
  const logs = [];
  let activeDayIndex = 0;

  for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    const dateKey = toDateKey(cursor);
    const weekday = cursor.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const random = createSeededRandom(`${userId}:stats-showcase:${dateKey}`);
    const isWeekendActivityDay = isWeekend && (cursor.getUTCDate() + weekday) % 3 === 0;
    if (isWeekend && !isWeekendActivityDay) {
      continue;
    }

    const selectedTasks = [
      availablePrimary[activeDayIndex % availablePrimary.length],
      availableSecondary[activeDayIndex % availableSecondary.length],
    ];
    if (!isWeekend || random() < 0.65) {
      selectedTasks.push(availableRecords[activeDayIndex % availableRecords.length]);
    }
    if (!isWeekend && random() < 0.38) {
      selectedTasks.push(availableSecondary[(activeDayIndex + 3) % availableSecondary.length]);
    }

    const isToday = dateKey === END_DATE_KEY;
    const allSelectedTasks = uniqueTasks(selectedTasks);
    const uniqueSelectedTasks = isToday ? allSelectedTasks.slice(0, 2) : allSelectedTasks;
    let startMinutes = isToday
      ? 8 * 60
      : isWeekend
        ? 10 * 60 + 30
        : 9 * 60 + Math.floor(random() * 31);
    const todos = uniqueSelectedTasks.map((task, order) => {
      const occurrence = occurrenceByTaskId.get(task.id) ?? 0;
      occurrenceByTaskId.set(task.id, occurrence + 1);
      const built = buildTodo({
        dateKey,
        task,
        order,
        startMinutes,
        occurrence,
        random,
        isPrimary: order === 0,
      });
      startMinutes += built.elapsedMinutes + 12 + Math.floor(random() * 19);
      return built.todo;
    });

    const doneCount = todos.filter((todo) => todo.done).length;
    const restMinutes = 12 + Math.floor(random() * (isWeekend ? 30 : 55));
    logs.push({
      userId,
      dateKey,
      monthKey: dateKey.slice(0, 7),
      memo: buildMemo(random),
      todos,
      restAccumulatedSeconds: restMinutes * 60,
      restStartedAt: null,
      todoCount: todos.length,
      doneCount,
      previewTodos: todos.slice(0, 3).map((todo) => todo.content),
    });
    activeDayIndex += 1;
  }

  return logs;
}

function summarizeLogs(logs) {
  const todos = logs.flatMap((log) => log.todos);
  const startedTodos = todos.filter((todo) => todo.startedAt);
  const completedTodos = todos.filter((todo) => todo.done);
  const taskSummaryMap = new Map();

  for (const todo of startedTodos) {
    const current = taskSummaryMap.get(todo.titleSnapshot) ?? {
      executions: 0,
      focusMinutes: 0,
      resumeCount: 0,
    };
    current.executions += 1;
    current.focusMinutes += Math.floor((todo.actualFocusSeconds ?? 0) / 60);
    current.resumeCount += todo.resumeCount;
    taskSummaryMap.set(todo.titleSnapshot, current);
  }

  return {
    activeDays: logs.length,
    todoCount: todos.length,
    startedCount: startedTodos.length,
    completedCount: completedTodos.length,
    incompleteCount: todos.length - completedTodos.length,
    focusMinutes: completedTodos.reduce(
      (sum, todo) => sum + Math.floor((todo.actualFocusSeconds ?? 0) / 60),
      0
    ),
    resumeCount: startedTodos.reduce((sum, todo) => sum + todo.resumeCount, 0),
    restMinutes: logs.reduce(
      (sum, log) => sum + Math.floor(log.restAccumulatedSeconds / 60),
      0
    ),
    memoDays: logs.filter((log) => log.memo).length,
    tasks: Object.fromEntries(
      [...taskSummaryMap.entries()].sort((left, right) => right[1].executions - left[1].executions)
    ),
  };
}

async function main() {
  if (!USER_EMAIL) {
    throw new Error("Pass the target account with --email=user@example.com");
  }
  assertDateKey(END_DATE_KEY, "--end");

  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(`User not found: ${USER_EMAIL}`);
  }

  const endDate = parseDateKey(END_DATE_KEY);
  const startDate = addDays(endDate, -(RANGE_DAYS - 1));
  const startDateKey = toDateKey(startDate);
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, isArchived: false },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, lastUsedAt: true },
  });
  const logs = buildSeedLogs({ userId: user.id, tasks, startDate, endDate });
  const summary = summarizeLogs(logs);
  const existingLogs = await prisma.dailyLog.findMany({
    where: {
      userId: user.id,
      dateKey: { gte: startDateKey, lte: END_DATE_KEY },
    },
    orderBy: { dateKey: "asc" },
  });

  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          email: user.email,
          range: { startDateKey, endDateKey: END_DATE_KEY },
          existingLogsInRange: existingLogs.length,
          generated: summary,
          next: `Run again with --apply to replace this date range`,
        },
        null,
        2
      )
    );
    return;
  }

  const backupPath = buildBackupPath(user.email);
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        user,
        range: { startDateKey, endDateKey: END_DATE_KEY },
        dailyLogs: existingLogs,
        taskLastUsedAt: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          lastUsedAt: task.lastUsedAt,
        })),
      },
      null,
      2
    ),
    "utf8"
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.dailyLog.deleteMany({
      where: {
        userId: user.id,
        dateKey: { gte: startDateKey, lte: END_DATE_KEY },
      },
    });

    for (const log of logs) {
      await transaction.dailyLog.create({ data: log });
    }

    const latestDateByTaskId = new Map();
    for (const log of logs) {
      for (const todo of log.todos) {
        if (!todo.startedAt || !todo.taskId) {
          continue;
        }
        const current = latestDateByTaskId.get(todo.taskId);
        if (!current || todo.startedAt > current) {
          latestDateByTaskId.set(todo.taskId, todo.startedAt);
        }
      }
    }

    for (const [taskId, lastUsedAt] of latestDateByTaskId) {
      await transaction.task.update({
        where: { id: taskId },
        data: { lastUsedAt },
      });
    }
  });

  const insertedLogs = await prisma.dailyLog.findMany({
    where: {
      userId: user.id,
      dateKey: { gte: startDateKey, lte: END_DATE_KEY },
    },
    orderBy: { dateKey: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        mode: "applied",
        email: user.email,
        range: { startDateKey, endDateKey: END_DATE_KEY },
        replacedLogs: existingLogs.length,
        insertedLogs: insertedLogs.length,
        backupPath,
        generated: summarizeLogs(insertedLogs),
      },
      null,
      2
    )
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
