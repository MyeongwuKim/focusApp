import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USER_ID = "local-dev-user";

function makeTodo(content, done, baseDate) {
  const startedAt = done ? new Date(`${baseDate}T09:00:00.000Z`) : null;
  const completedAt = done ? new Date(`${baseDate}T09:35:00.000Z`) : null;

  return {
    id: randomUUID(),
    content,
    done,
    order: 0,
    createdAt: new Date(`${baseDate}T08:50:00.000Z`),
    startedAt,
    completedAt,
    deviationSeconds: done ? 180 : 0,
    actualFocusSeconds: done ? 1920 : null,
  };
}

function makeLog(dateKey, memo, tasks) {
  const todos = tasks.map((task, index) => ({
    ...makeTodo(task.content, task.done, dateKey),
    order: index,
  }));
  const doneCount = todos.filter((todo) => todo.done).length;

  return {
    userId: USER_ID,
    dateKey,
    monthKey: dateKey.slice(0, 7),
    memo,
    todos,
    todoCount: todos.length,
    doneCount,
    previewTodos: todos.slice(0, 3).map((todo) => todo.content),
  };
}

const januaryLogs = [
  makeLog("2026-01-04", "1월 첫 주 시작", [
    { content: "주간 목표 정리", done: true },
    { content: "캘린더 기능 점검", done: false },
  ]),
  makeLog("2026-01-10", "작업 흐름 확인", [
    { content: "Task 목록 정렬 테스트", done: true },
    { content: "Focus 타이머 클릭 동작 확인", done: true },
    { content: "메모 화면 연결 확인", done: false },
  ]),
  makeLog("2026-01-21", "중순 회고", [
    { content: "완료율 체크", done: true },
    { content: "남은 백로그 분류", done: false },
  ]),
  makeLog("2026-01-30", "월말 마감", [
    { content: "1월 마감 정리", done: true },
  ]),
];

const februaryLogs = [
  makeLog("2026-02-02", "2월 초반 점검", [
    { content: "할일 중복 처리 확인", done: true },
    { content: "월별 조회 응답 점검", done: false },
  ]),
  makeLog("2026-02-08", "주간 루틴 정리", [
    { content: "오늘 할일 우선순위 정리", done: true },
    { content: "미완료 항목 재배치", done: true },
  ]),
  makeLog("2026-02-16", "중순 진행", [
    { content: "날짜별 Todo 표시 확인", done: false },
    { content: "휴식 세션 시간 확인", done: true },
  ]),
  makeLog("2026-02-27", "2월 마무리", [
    { content: "완료 항목 리뷰", done: true },
    { content: "3월 준비 메모", done: false },
  ]),
];

const marchLogs = [
  makeLog("2026-03-01", "3월 시작 계획", [
    { content: "이번 달 핵심 목표 설정", done: true },
    { content: "주간 루틴 재정비", done: true },
    { content: "기능별 테스트 케이스 작성", done: false },
  ]),
  makeLog("2026-03-03", "초반 진행 점검", [
    { content: "캘린더 셀 렌더 확인", done: true },
    { content: "월 전환 스와이프 확인", done: true },
    { content: "에지 케이스 수집", done: false },
  ]),
  makeLog("2026-03-05", "할일 관리 안정화", [
    { content: "컬렉션 이름 변경 테스트", done: true },
    { content: "태스크 이름 변경 테스트", done: true },
    { content: "중복 이름 검증 테스트", done: true },
    { content: "오류 메시지 문구 검토", done: false },
  ]),
  makeLog("2026-03-08", "주말 리팩터링", [
    { content: "컨텍스트 분리 구조 점검", done: true },
    { content: "불필요 props 흐름 제거", done: true },
    { content: "타입 정합성 체크", done: false },
  ]),
  makeLog("2026-03-10", "중간 리뷰", [
    { content: "dailyLog 월 조회 응답 확인", done: true },
    { content: "미리보기 바 매핑 확인", done: true },
    { content: "선택 시트 데이터 확인", done: true },
  ]),
  makeLog("2026-03-12", "기능 테스트 확장", [
    { content: "drag reorder 상호작용 테스트", done: true },
    { content: "삭제/이동 rollback 확인", done: false },
    { content: "toast 노출 흐름 확인", done: true },
  ]),
  makeLog("2026-03-15", "중순 백로그 처리", [
    { content: "남은 이슈 라벨링", done: true },
    { content: "작업 우선순위 재정렬", done: false },
    { content: "문구 통일 점검", done: false },
  ]),
  makeLog("2026-03-18", "탐색적 테스트", [
    { content: "월 변경 연속 스와이프 테스트", done: true },
    { content: "선택 날짜 유지 확인", done: true },
    { content: "오버레이 전환 확인", done: true },
    { content: "메모 진입/복귀 확인", done: false },
  ]),
  makeLog("2026-03-21", "주말 유지보수", [
    { content: "사용성 이슈 메모", done: false },
    { content: "작업 목록 정리", done: true },
  ]),
  makeLog("2026-03-24", "성능 점검", [
    { content: "불필요 렌더 확인", done: true },
    { content: "쿼리 캐시 상태 점검", done: true },
    { content: "네트워크 요청 패턴 확인", done: false },
  ]),
  makeLog("2026-03-27", "릴리즈 준비", [
    { content: "마지막 회귀 테스트", done: true },
    { content: "문구 오탈자 확인", done: true },
    { content: "데모 시나리오 정리", done: false },
  ]),
  makeLog("2026-03-31", "월말 회고", [
    { content: "3월 완료 항목 정리", done: true },
    { content: "4월 목표 초안 작성", done: true },
    { content: "개선 포인트 기록", done: false },
  ]),
];

const aprilLogs = [
  makeLog("2026-04-01", "4월 시작", [
    { content: "새 월 체크리스트 생성", done: true },
    { content: "초기 백로그 정리", done: false },
  ]),
  makeLog("2026-04-02", "초반 안정화", [
    { content: "달력 데이터 표시 확인", done: true },
    { content: "today 이동 동작 확인", done: true },
  ]),
  makeLog("2026-04-03", "오늘 테스트", [
    { content: "시나리오 점검", done: false },
    { content: "로그 확인", done: false },
    { content: "UI 플로우 확인", done: true },
  ]),
];

const seedLogs = [...januaryLogs, ...februaryLogs, ...marchLogs, ...aprilLogs];

try {
  await prisma.dailyLog.deleteMany({
    where: {
      userId: USER_ID,
      dateKey: {
        gte: "2026-01-01",
        lte: "2026-04-30",
      },
    },
  });

  for (const log of seedLogs) {
    await prisma.dailyLog.create({ data: log });
  }

  const rows = await prisma.dailyLog.findMany({
    where: {
      userId: USER_ID,
      dateKey: {
        gte: "2026-01-01",
        lte: "2026-04-30",
      },
    },
    orderBy: { dateKey: "asc" },
  });

  const byMonth = rows.reduce((acc, row) => {
    acc[row.monthKey] = (acc[row.monthKey] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        userId: USER_ID,
        inserted: rows.length,
        byMonth,
        firstDateKey: rows[0]?.dateKey ?? null,
        lastDateKey: rows[rows.length - 1]?.dateKey ?? null,
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
