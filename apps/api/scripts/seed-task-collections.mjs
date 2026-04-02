import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USER_ID = "local-dev-user";

const collections = [
  {
    name: "오늘 집중",
    order: 0,
    tasks: [
      { title: "스프린트 계획 정리", isArchived: false, order: 0 },
      { title: "DailyLog 회고 작성", isArchived: false, order: 1 },
      { title: "오래된 TODO 정리", isArchived: true, order: 2 }
    ]
  },
  {
    name: "이번 주 백로그",
    order: 1,
    tasks: [
      { title: "TaskCollection GraphQL 연결", isArchived: false, order: 0 },
      { title: "쿼리 테스트 페이지 보강", isArchived: false, order: 1 }
    ]
  },
  {
    name: "개인 메모",
    order: 2,
    tasks: [
      { title: "회의 아이디어 기록", isArchived: false, order: 0 },
      { title: "다음 주 실험안", isArchived: false, order: 1 }
    ]
  }
];

try {
  await prisma.task.deleteMany({ where: { userId: USER_ID } });
  await prisma.taskCollection.deleteMany({ where: { userId: USER_ID } });

  for (const collection of collections) {
    const createdCollection = await prisma.taskCollection.create({
      data: {
        userId: USER_ID,
        name: collection.name,
        order: collection.order
      }
    });

    for (const task of collection.tasks) {
      await prisma.task.create({
        data: {
          userId: USER_ID,
          collectionId: createdCollection.id,
          title: task.title,
          isArchived: task.isArchived,
          order: task.order
        }
      });
    }
  }

  const rows = await prisma.taskCollection.findMany({
    where: { userId: USER_ID },
    include: { tasks: true },
    orderBy: { order: "asc" }
  });

  console.log(
    JSON.stringify(
      {
        userId: USER_ID,
        collections: rows.length,
        tasks: rows.reduce((sum, row) => sum + row.tasks.length, 0),
        names: rows.map((row) => row.name)
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
