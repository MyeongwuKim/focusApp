import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function makeTodos(items) {
  return items.map((item, idx) => ({
    id: `todo-${Math.random().toString(36).slice(2, 10)}`,
    content: item.content,
    done: item.done,
    order: idx,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    startedAt: item.done ? new Date("2026-03-01T01:00:00.000Z") : null,
    completedAt: item.done ? new Date("2026-03-01T01:30:00.000Z") : null,
    deviationSeconds: item.done ? 120 : 0,
    actualFocusSeconds: item.done ? 1500 : null,
  }));
}

const docs = [
  {
    dateKey: "2026-03-03",
    memo: "3월 첫째 주 점검",
    todos: makeTodos([
      { content: "캘린더 UI 점검", done: true },
      { content: "API 연결 확인", done: false },
    ]),
  },
  {
    dateKey: "2026-03-12",
    memo: "중간 점검 메모",
    todos: makeTodos([
      { content: "할일 정렬 로직 확인", done: true },
      { content: "focus 타이머 보정", done: true },
      { content: "월 조회 응답 확인", done: false },
    ]),
  },
  {
    dateKey: "2026-03-21",
    memo: "주말 정리",
    todos: makeTodos([{ content: "중복 일정 정리", done: false }]),
  },
  {
    dateKey: "2026-03-31",
    memo: "월말 회고",
    todos: makeTodos([
      { content: "3월 완료 항목 정리", done: true },
      { content: "4월 계획 작성", done: false },
    ]),
  },
];

try {
  await prisma.dailyLog.deleteMany({});

  for (const doc of docs) {
    const doneCount = doc.todos.filter((todo) => todo.done).length;
    await prisma.dailyLog.create({
      data: {
        userId: "local-dev-user",
        dateKey: doc.dateKey,
        monthKey: "2026-03",
        memo: doc.memo,
        todos: doc.todos,
        todoCount: doc.todos.length,
        doneCount,
        previewTodos: doc.todos.slice(0, 3).map((todo) => todo.content),
      },
    });
  }

  const rows = await prisma.dailyLog.findMany({
    where: { userId: "local-dev-user", monthKey: "2026-03" },
    orderBy: { dateKey: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        inserted: rows.length,
        dateKeys: rows.map((row) => row.dateKey),
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
