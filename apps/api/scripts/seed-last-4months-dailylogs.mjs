import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USER_ID = "local-dev-user";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function atTime(dateKey, hour, minute = 0) {
  return new Date(`${dateKey}T${pad2(hour)}:${pad2(minute)}:00.000Z`);
}

function createSeededRandom(seedText) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function pickOne(items, random) {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(random() * items.length)];
}

function buildTodosForDate({ dateKey, tasks, random }) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const weekday = date.getDay();
  const dayOfMonth = date.getDate();
  const isWeekend = [0, 6].includes(weekday);
  const isRestDay = isWeekend ? dayOfMonth % 4 === 0 : dayOfMonth % 7 === 0;
  if (isRestDay) {
    return [];
  }

  const todoCount = 2 + Math.floor(random() * 4); // 2~5
  let cursorMinutes = 9 * 60 + Math.floor(random() * 60); // 09:00~09:59
  const todos = [];

  for (let index = 0; index < todoCount; index += 1) {
    const linkedTask = pickOne(tasks, random);
    const content = linkedTask?.title ?? `테스트 할일 ${index + 1}`;
    const done = random() < 0.78;

    const focusMinutes = done
      ? 25 + Math.floor(random() * 66) // 25~90
      : 10 + Math.floor(random() * 36); // 10~45
    const deviationMinutes = Math.floor(random() * (done ? 16 : 10)); // 0~15 / 0~9

    const startedHour = Math.floor(cursorMinutes / 60);
    const startedMinute = cursorMinutes % 60;
    const startedAt = atTime(dateKey, startedHour, startedMinute);

    const elapsedMinutes = focusMinutes + deviationMinutes;
    const endCursor = cursorMinutes + elapsedMinutes;
    const endedAt = atTime(dateKey, Math.floor(endCursor / 60), endCursor % 60);
    cursorMinutes = endCursor + (5 + Math.floor(random() * 16)); // 다음 할일까지 5~20분

    todos.push({
      id: randomUUID(),
      taskId: linkedTask?.id ?? null,
      titleSnapshot: linkedTask?.title ?? null,
      content,
      done,
      order: index,
      createdAt: startedAt,
      startedAt,
      scheduledStartAt: null,
      pausedAt: done ? null : endedAt,
      completedAt: done ? endedAt : null,
      deviationSeconds: deviationMinutes * 60,
      actualFocusSeconds: done ? focusMinutes * 60 : null,
    });
  }

  return todos;
}

function buildMemo(dateKey, random) {
  if (random() < 0.6) {
    return null;
  }
  const notes = ["집중 흐름 양호", "이탈 관리 필요", "오후 집중 저하", "오전 몰입 좋음", "리듬 유지"];
  const picked = notes[Math.floor(random() * notes.length)];
  return `${dateKey} ${picked}`;
}

async function main() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 4);

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const tasks = await prisma.task.findMany({
    where: {
      userId: USER_ID,
      isArchived: false,
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  await prisma.dailyLog.deleteMany({
    where: {
      userId: USER_ID,
      dateKey: {
        gte: startKey,
        lte: endKey,
      },
    },
  });

  let cursor = new Date(start);
  let inserted = 0;
  let totalFocusSeconds = 0;
  let totalDeviationSeconds = 0;
  let totalRestSeconds = 0;

  while (cursor <= end) {
    const dateKey = toDateKey(cursor);
    const random = createSeededRandom(`${USER_ID}:${dateKey}`);
    const todos = buildTodosForDate({ dateKey, tasks, random });
    const doneCount = todos.filter((todo) => todo.done).length;
    const todoCount = todos.length;
    const previewTodos = todos.slice(0, 3).map((todo) => todo.content);
    const restAccumulatedSeconds = todoCount === 0 ? 0 : (8 + Math.floor(random() * 63)) * 60; // 8~70분
    const memo = buildMemo(dateKey, random);

    totalFocusSeconds += todos.reduce((sum, todo) => sum + Math.max(todo.actualFocusSeconds ?? 0, 0), 0);
    totalDeviationSeconds += todos.reduce((sum, todo) => sum + Math.max(todo.deviationSeconds ?? 0, 0), 0);
    totalRestSeconds += restAccumulatedSeconds;

    await prisma.dailyLog.create({
      data: {
        userId: USER_ID,
        dateKey,
        monthKey: toMonthKey(dateKey),
        memo,
        todos,
        todoCount,
        doneCount,
        previewTodos,
        restAccumulatedSeconds,
        restStartedAt: null,
      },
    });
    inserted += 1;
    cursor = addDays(cursor, 1);
  }

  const byMonthRows = await prisma.dailyLog.findMany({
    where: {
      userId: USER_ID,
      dateKey: {
        gte: startKey,
        lte: endKey,
      },
    },
    select: {
      monthKey: true,
      todoCount: true,
      doneCount: true,
      restAccumulatedSeconds: true,
    },
    orderBy: { dateKey: "asc" },
  });

  const byMonth = {};
  for (const row of byMonthRows) {
    const prev = byMonth[row.monthKey] ?? { days: 0, todoCount: 0, doneCount: 0, restMinutes: 0 };
    byMonth[row.monthKey] = {
      days: prev.days + 1,
      todoCount: prev.todoCount + row.todoCount,
      doneCount: prev.doneCount + row.doneCount,
      restMinutes: prev.restMinutes + Math.floor(row.restAccumulatedSeconds / 60),
    };
  }

  console.log(
    JSON.stringify(
      {
        userId: USER_ID,
        range: { startKey, endKey },
        insertedDays: inserted,
        taskSourceCount: tasks.length,
        totals: {
          focusMinutes: Math.floor(totalFocusSeconds / 60),
          deviationMinutes: Math.floor(totalDeviationSeconds / 60),
          restMinutes: Math.floor(totalRestSeconds / 60),
        },
        byMonth,
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
