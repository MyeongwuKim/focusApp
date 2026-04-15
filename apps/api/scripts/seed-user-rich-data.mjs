import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USER_EMAIL = (process.argv[2] ?? "mw1992@naver.com").trim().toLowerCase();

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
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
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function sliceByChance(items, random, ratio) {
  return items.filter(() => random() < ratio);
}

async function ensureUserByEmail(email) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      name: "Myeongwu",
    },
  });
}

async function seedTaskCollections(userId, random) {
  const collectionBlueprint = [
    {
      name: "오늘 집중",
      tasks: [
        "오전 데일리 체크",
        "핵심 기능 구현",
        "PR 리뷰 반영",
        "집중 기록 정리",
        "알림 UX 다듬기",
      ],
    },
    {
      name: "이번 주 백로그",
      tasks: [
        "로그인 플로우 QA",
        "캘린더 리렌더 최적화",
        "통계 카드 카피 정리",
        "권한 설정 UX 검토",
        "에러 핸들링 케이스 점검",
      ],
    },
    {
      name: "운영/회고",
      tasks: [
        "주간 회고 작성",
        "실험 아이디어 메모",
        "다음 스프린트 준비",
        "불편 이슈 우선순위 조정",
      ],
    },
  ];

  await prisma.task.deleteMany({ where: { userId } });
  await prisma.taskCollection.deleteMany({ where: { userId } });

  const createdCollections = [];
  for (let collectionOrder = 0; collectionOrder < collectionBlueprint.length; collectionOrder += 1) {
    const blueprint = collectionBlueprint[collectionOrder];
    const collection = await prisma.taskCollection.create({
      data: {
        userId,
        name: blueprint.name,
        order: collectionOrder,
      },
    });
    createdCollections.push(collection);

    for (let taskOrder = 0; taskOrder < blueprint.tasks.length; taskOrder += 1) {
      const title = blueprint.tasks[taskOrder];
      await prisma.task.create({
        data: {
          userId,
          collectionId: collection.id,
          title,
          order: taskOrder,
          isArchived: random() < 0.08,
          isFavorite: random() < 0.22,
          lastUsedAt: random() < 0.72 ? addDays(new Date(), -Math.floor(random() * 28)) : null,
        },
      });
    }
  }

  return prisma.task.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true },
  });
}

async function seedRoutineTemplates(userId, taskPool) {
  await prisma.routineTemplate.deleteMany({ where: { userId } });

  const byTitle = new Map(taskPool.map((task) => [task.title, task]));
  const templates = [
    {
      name: "출근 루틴",
      items: [
        ["오전 데일리 체크", "09:30"],
        ["핵심 기능 구현", "10:00"],
        ["PR 리뷰 반영", "11:30"],
      ],
    },
    {
      name: "오후 복귀 루틴",
      items: [
        ["집중 기록 정리", "14:00"],
        ["로그인 플로우 QA", "15:00"],
        ["에러 핸들링 케이스 점검", "16:30"],
      ],
    },
    {
      name: "마감 루틴",
      items: [
        ["주간 회고 작성", "18:00"],
        ["다음 스프린트 준비", "18:20"],
      ],
    },
  ];

  for (const template of templates) {
    await prisma.routineTemplate.create({
      data: {
        userId,
        name: template.name,
        items: template.items.map(([title, hhmm], index) => {
          const task = byTitle.get(title);
          return {
            id: randomUUID(),
            content: title,
            order: index,
            taskId: task?.id ?? null,
            titleSnapshot: task?.title ?? title,
            scheduledTimeHHmm: hhmm,
          };
        }),
      },
    });
  }
}

function buildDailyTodos({ userId, dateKey, random, tasks }) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  const weekend = day === 0 || day === 6;
  const baseCount = weekend ? 2 : 4;
  const todoCount = Math.max(1, baseCount + Math.floor(random() * 3) - 1);

  const selectedTasks = sliceByChance(tasks, random, weekend ? 0.45 : 0.7).slice(0, todoCount);
  while (selectedTasks.length < todoCount) {
    selectedTasks.push(pickOne(tasks, random));
  }

  let cursorMinutes = weekend ? 10 * 60 : 9 * 60 + Math.floor(random() * 30);

  return selectedTasks.map((task, index) => {
    const plannedFocusMinutes = weekend ? 25 + Math.floor(random() * 26) : 35 + Math.floor(random() * 41);
    const done = random() < (weekend ? 0.68 : 0.8);
    const deviationMinutes = Math.floor(random() * (done ? 12 : 20));

    const startedAt = atTime(dateKey, Math.floor(cursorMinutes / 60), cursorMinutes % 60);
    const endedCursor = cursorMinutes + plannedFocusMinutes + deviationMinutes;
    const endedAt = atTime(dateKey, Math.floor(endedCursor / 60), endedCursor % 60);
    cursorMinutes = endedCursor + 8 + Math.floor(random() * 18);

    return {
      id: randomUUID(),
      taskId: task.id,
      titleSnapshot: task.title,
      content: task.title,
      done,
      order: index,
      createdAt: startedAt,
      startedAt,
      scheduledStartAt: null,
      pausedAt: done ? null : endedAt,
      completedAt: done ? endedAt : null,
      deviationSeconds: deviationMinutes * 60,
      actualFocusSeconds: done ? plannedFocusMinutes * 60 : null,
    };
  });
}

function buildMemo(dateKey, random) {
  if (random() < 0.4) {
    return null;
  }

  const snippets = [
    "오전엔 집중 유지, 오후엔 컨텍스트 스위칭 많았음",
    "예상보다 리뷰 시간이 길어져 핵심 작업 압축 진행",
    "중간 휴식 후 흐름 회복, 리마인드 알림 체감 좋았음",
    "우선순위 조정 덕분에 마감 전에 필수 작업 완료",
    "일정이 밀려도 핵심 2개는 완료한다는 원칙 유지",
  ];
  return `${dateKey} ${pickOne(snippets, random)}`;
}

async function seedDailyLogs(userId, tasks) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 4);

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  await prisma.dailyLog.deleteMany({
    where: {
      userId,
      dateKey: {
        gte: startKey,
        lte: endKey,
      },
    },
  });

  let cursor = new Date(start);
  let insertedDays = 0;
  while (cursor <= end) {
    const dateKey = toDateKey(cursor);
    const random = createSeededRandom(`${userId}:${dateKey}`);
    const todos = buildDailyTodos({ userId, dateKey, random, tasks });
    const doneCount = todos.filter((todo) => todo.done).length;
    const restAccumulatedSeconds = (6 + Math.floor(random() * 55)) * 60;

    await prisma.dailyLog.create({
      data: {
        userId,
        dateKey,
        monthKey: toMonthKey(dateKey),
        memo: buildMemo(dateKey, random),
        todos,
        todoCount: todos.length,
        doneCount,
        previewTodos: todos.slice(0, 3).map((todo) => todo.content),
        restAccumulatedSeconds,
        restStartedAt: null,
      },
    });

    insertedDays += 1;
    cursor = addDays(cursor, 1);
  }

  return { startKey, endKey, insertedDays };
}

async function main() {
  const user = await ensureUserByEmail(USER_EMAIL);
  const random = createSeededRandom(`collections:${user.id}`);

  const tasks = await seedTaskCollections(user.id, random);
  await seedRoutineTemplates(user.id, tasks);
  const dailyLogSummary = await seedDailyLogs(user.id, tasks);

  const [collectionCount, taskCount, routineCount, dailyLogCount] = await Promise.all([
    prisma.taskCollection.count({ where: { userId: user.id } }),
    prisma.task.count({ where: { userId: user.id } }),
    prisma.routineTemplate.count({ where: { userId: user.id } }),
    prisma.dailyLog.count({ where: { userId: user.id } }),
  ]);

  console.log(
    JSON.stringify(
      {
        email: USER_EMAIL,
        userId: user.id,
        collections: collectionCount,
        tasks: taskCount,
        routineTemplates: routineCount,
        dailyLogs: dailyLogCount,
        seededRange: {
          startKey: dailyLogSummary.startKey,
          endKey: dailyLogSummary.endKey,
          insertedDays: dailyLogSummary.insertedDays,
        },
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
