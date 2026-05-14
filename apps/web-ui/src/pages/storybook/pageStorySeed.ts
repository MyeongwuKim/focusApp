import { queryClient } from "../../queryClient";
import {
  dailyLogByDateQueryKey,
  dailyLogsByMonthQueryKey,
  statsDailyDetailQueryKey,
} from "../../queries/daily-log/queries";
import { notificationSettingsQueryKey } from "../../queries/notification-settings/queries";
import { routineTemplatesQueryKey } from "../../queries/routine-template/queries";
import { taskCollectionsQueryKey } from "../../queries/task-collection/queries";
import { useAppStore, useTaskManagementViewStore, useWeatherStore } from "../../stores";

const TODAY_KEY = "2026-05-13";
const PREV_KEY = "2026-05-12";
const NEXT_KEY = "2026-05-14";
const MAY_MONTH_KEY = "2026-05";
const APR_MONTH_KEY = "2026-04";
const NOV_2025_MONTH_KEY = "2025-11";

function createDailyLog(dateKey: string, items: Array<{ id: string; content: string; done: boolean; order: number }>) {
  return {
    dateKey,
    memo: null,
    restAccumulatedSeconds: 900,
    restStartedAt: null,
    todos: items.map((item) => ({
      id: item.id,
      taskId: `task-${item.id}`,
      titleSnapshot: item.content,
      content: item.content,
      done: item.done,
      order: item.order,
      startedAt: item.done ? null : `${dateKey}T09:00:00.000Z`,
      scheduledStartAt: `${dateKey}T08:30:00.000Z`,
      targetFocusMinutes: 25,
      pausedAt: null,
      completedAt: item.done ? `${dateKey}T10:00:00.000Z` : null,
      deviationSeconds: 0,
      resumeCount: item.done ? 1 : 0,
      actualFocusSeconds: item.done ? 1500 : 0,
    })),
  };
}

const todayLog = createDailyLog(TODAY_KEY, [
  { id: "todo-1", content: "기획 정리", done: true, order: 0 },
  { id: "todo-2", content: "UI 마감", done: false, order: 1 },
  { id: "todo-3", content: "테스트 점검", done: false, order: 2 },
]);

const prevLog = createDailyLog(PREV_KEY, [
  { id: "todo-prev-1", content: "리팩터링", done: true, order: 0 },
  { id: "todo-prev-2", content: "문서 정리", done: true, order: 1 },
]);

const nextLog = createDailyLog(NEXT_KEY, [
  { id: "todo-next-1", content: "내일 할일 1", done: false, order: 0 },
  { id: "todo-next-2", content: "내일 할일 2", done: false, order: 1 },
]);

const mayMonthlyLogs = [
  {
    id: "log-2026-05-11",
    userId: "storybook-user",
    dateKey: "2026-05-11",
    monthKey: MAY_MONTH_KEY,
    memo: null,
    todoCount: 2,
    doneCount: 1,
    previewTodos: ["기능 설계", "코드 정리"],
    todos: [
      { id: "m1-1", taskId: "task-m1-1", titleSnapshot: "기능 설계", content: "기능 설계", done: true, order: 0 },
      { id: "m1-2", taskId: "task-m1-2", titleSnapshot: "코드 정리", content: "코드 정리", done: false, order: 1 },
    ],
  },
  {
    id: "log-2026-05-12",
    userId: "storybook-user",
    dateKey: PREV_KEY,
    monthKey: MAY_MONTH_KEY,
    memo: null,
    todoCount: 2,
    doneCount: 2,
    previewTodos: ["리팩터링", "문서 정리"],
    todos: [
      { id: "m2-1", taskId: "task-m2-1", titleSnapshot: "리팩터링", content: "리팩터링", done: true, order: 0 },
      { id: "m2-2", taskId: "task-m2-2", titleSnapshot: "문서 정리", content: "문서 정리", done: true, order: 1 },
    ],
  },
  {
    id: "log-2026-05-13",
    userId: "storybook-user",
    dateKey: TODAY_KEY,
    monthKey: MAY_MONTH_KEY,
    memo: null,
    todoCount: 3,
    doneCount: 1,
    previewTodos: ["기획 정리", "UI 마감", "테스트 점검"],
    todos: [
      { id: "m3-1", taskId: "task-m3-1", titleSnapshot: "기획 정리", content: "기획 정리", done: true, order: 0 },
      { id: "m3-2", taskId: "task-m3-2", titleSnapshot: "UI 마감", content: "UI 마감", done: false, order: 1 },
      { id: "m3-3", taskId: "task-m3-3", titleSnapshot: "테스트 점검", content: "테스트 점검", done: false, order: 2 },
    ],
  },
];

const aprilMonthlyLogs = [
  {
    id: "log-2026-04-21",
    userId: "storybook-user",
    dateKey: "2026-04-21",
    monthKey: APR_MONTH_KEY,
    memo: null,
    todoCount: 3,
    doneCount: 2,
    previewTodos: ["백로그 정리", "API 정리", "리뷰 대응"],
    todos: [
      { id: "a1-1", taskId: "task-a1-1", titleSnapshot: "백로그 정리", content: "백로그 정리", done: true, order: 0 },
      { id: "a1-2", taskId: "task-a1-2", titleSnapshot: "API 정리", content: "API 정리", done: true, order: 1 },
      { id: "a1-3", taskId: "task-a1-3", titleSnapshot: "리뷰 대응", content: "리뷰 대응", done: false, order: 2 },
    ],
  },
  {
    id: "log-2026-04-28",
    userId: "storybook-user",
    dateKey: "2026-04-28",
    monthKey: APR_MONTH_KEY,
    memo: null,
    todoCount: 2,
    doneCount: 1,
    previewTodos: ["테스트 작성", "디버깅"],
    todos: [
      { id: "a2-1", taskId: "task-a2-1", titleSnapshot: "테스트 작성", content: "테스트 작성", done: true, order: 0 },
      { id: "a2-2", taskId: "task-a2-2", titleSnapshot: "디버깅", content: "디버깅", done: false, order: 1 },
    ],
  },
];

const november2025MonthlyLogs = [
  {
    id: "log-2025-11-18",
    userId: "storybook-user",
    dateKey: "2025-11-18",
    monthKey: NOV_2025_MONTH_KEY,
    memo: null,
    todoCount: 4,
    doneCount: 3,
    previewTodos: ["분기 정리", "문서 업데이트", "성능 점검", "버그 픽스"],
    todos: [
      { id: "n1-1", taskId: "task-n1-1", titleSnapshot: "분기 정리", content: "분기 정리", done: true, order: 0 },
      { id: "n1-2", taskId: "task-n1-2", titleSnapshot: "문서 업데이트", content: "문서 업데이트", done: true, order: 1 },
      { id: "n1-3", taskId: "task-n1-3", titleSnapshot: "성능 점검", content: "성능 점검", done: true, order: 2 },
      { id: "n1-4", taskId: "task-n1-4", titleSnapshot: "버그 픽스", content: "버그 픽스", done: false, order: 3 },
    ],
  },
];

const taskCollections = [
  {
    id: "collection-work",
    name: "업무",
    order: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    tasks: [
      {
        id: "task-ui",
        userId: "storybook-user",
        collectionId: "collection-work",
        title: "UI 마감",
        isFavorite: false,
        isArchived: false,
        order: 0,
        lastUsedAt: "2026-05-13T09:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
      {
        id: "task-test",
        userId: "storybook-user",
        collectionId: "collection-work",
        title: "테스트 점검",
        isFavorite: false,
        isArchived: false,
        order: 1,
        lastUsedAt: "2026-05-13T10:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    ],
  },
  {
    id: "collection-life",
    name: "개인",
    order: 1,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    tasks: [
      {
        id: "task-run",
        userId: "storybook-user",
        collectionId: "collection-life",
        title: "운동",
        isFavorite: false,
        isArchived: false,
        order: 0,
        lastUsedAt: "2026-05-12T18:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    ],
  },
];

const notificationSettings = {
  id: "notification-settings",
  userId: "storybook-user",
  pushEnabled: true,
  intervalMinutes: 60,
  activeStartTime: "09:00",
  activeEndTime: "23:00",
  dayMode: "weekday",
  typeRestEnd: true,
  typeIncomplete: true,
  typeFocusStart: true,
  tone: "soft",
  systemPermission: "granted",
  lastEmptyTodoReminderDate: null,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-13T00:00:00.000Z",
};

const routineTemplates = [
  {
    id: "routine-1",
    userId: "storybook-user",
    name: "아침 루틴",
    items: [
      {
        id: "routine-item-1",
        taskId: "task-ui",
        titleSnapshot: "UI 마감",
        content: "UI 마감",
        order: 0,
        scheduledTimeHHmm: "09:30",
      },
    ],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  },
];

export function seedPageStoryData() {
  queryClient.clear();

  useTaskManagementViewStore.getState().resetTaskManagementViewState();
  useAppStore.getState().resetAppStore();
  useAppStore.getState().setSelectedDateKey(TODAY_KEY);
  useAppStore.getState().setViewMonth(new Date(2026, 4, 1));
  useWeatherStore.getState().setWeather({
    temperature: 22,
    weatherCode: 1,
    isDay: 1,
  });

  queryClient.setQueryData(dailyLogByDateQueryKey(TODAY_KEY), todayLog);
  queryClient.setQueryData(dailyLogByDateQueryKey(PREV_KEY), prevLog);
  queryClient.setQueryData(dailyLogByDateQueryKey(NEXT_KEY), nextLog);
  queryClient.setQueryData(dailyLogsByMonthQueryKey(MAY_MONTH_KEY), mayMonthlyLogs);
  queryClient.setQueryData(dailyLogsByMonthQueryKey(APR_MONTH_KEY), aprilMonthlyLogs);
  queryClient.setQueryData(dailyLogsByMonthQueryKey(NOV_2025_MONTH_KEY), november2025MonthlyLogs);

  queryClient.setQueryData(statsDailyDetailQueryKey(TODAY_KEY), todayLog);
  queryClient.setQueryData(statsDailyDetailQueryKey(PREV_KEY), prevLog);
  queryClient.setQueryData(statsDailyDetailQueryKey("2026-05-11"), createDailyLog("2026-05-11", [
    { id: "todo-11-1", content: "기능 설계", done: true, order: 0 },
    { id: "todo-11-2", content: "코드 정리", done: false, order: 1 },
  ]));
  queryClient.setQueryData(statsDailyDetailQueryKey("2026-04-21"), createDailyLog("2026-04-21", [
    { id: "todo-21-1", content: "백로그 정리", done: true, order: 0 },
    { id: "todo-21-2", content: "API 정리", done: true, order: 1 },
    { id: "todo-21-3", content: "리뷰 대응", done: false, order: 2 },
  ]));
  queryClient.setQueryData(statsDailyDetailQueryKey("2026-04-28"), createDailyLog("2026-04-28", [
    { id: "todo-28-1", content: "테스트 작성", done: true, order: 0 },
    { id: "todo-28-2", content: "디버깅", done: false, order: 1 },
  ]));
  queryClient.setQueryData(statsDailyDetailQueryKey("2025-11-18"), createDailyLog("2025-11-18", [
    { id: "todo-n1-1", content: "분기 정리", done: true, order: 0 },
    { id: "todo-n1-2", content: "문서 업데이트", done: true, order: 1 },
    { id: "todo-n1-3", content: "성능 점검", done: true, order: 2 },
    { id: "todo-n1-4", content: "버그 픽스", done: false, order: 3 },
  ]));

  queryClient.setQueryData(taskCollectionsQueryKey, taskCollections);
  queryClient.setQueryData(notificationSettingsQueryKey, notificationSettings);
  queryClient.setQueryData(routineTemplatesQueryKey, routineTemplates);
}

export const pageStoryDateKeys = {
  today: TODAY_KEY,
  previous: PREV_KEY,
  next: NEXT_KEY,
};
