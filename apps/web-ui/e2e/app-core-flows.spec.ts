import { expect, test, type Page } from "@playwright/test";

type MockTodo = {
  id: string;
  taskId: string;
  titleSnapshot: string;
  content: string;
  done: boolean;
  order: number;
  startedAt: string | null;
  scheduledStartAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  deviationSeconds: number;
  actualFocusSeconds: number | null;
};

type MockDailyLog = {
  dateKey: string;
  memo: string;
  restAccumulatedSeconds: number;
  restStartedAt: string | null;
  todos: MockTodo[];
};

type MockNotificationSettings = {
  id: string;
  userId: string;
  pushEnabled: boolean;
  intervalMinutes: number;
  activeStartTime: string;
  activeEndTime: string;
  dayMode: "weekday" | "everyday";
  typeRestEnd: boolean;
  typeIncomplete: boolean;
  typeFocusStart: boolean;
  tone: "soft" | "balanced" | "firm";
  systemPermission: string | null;
  lastEmptyTodoReminderDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type MockGraphqlState = {
  logsByDate: Map<string, MockDailyLog>;
  notificationSettings: MockNotificationSettings;
};

type MeResponseMode = "success" | "unauthorized" | "server-error" | "network-error";

type SetupOptions = {
  meSequence?: MeResponseMode[];
  notificationPermission?: "granted" | "default" | "denied";
  initialRestActive?: boolean;
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function toMonthKey(dateKey: string) {
  const [year, month] = dateKey.split("-");
  return `${year}-${month}`;
}

function buildDailyLog(dateKey: string, todos: MockTodo[] = []): MockDailyLog {
  return {
    dateKey,
    memo: "",
    restAccumulatedSeconds: 0,
    restStartedAt: null,
    todos,
  };
}

function createGraphqlState(todayKey: string, options?: { initialRestActive?: boolean }): MockGraphqlState {
  const nowIso = new Date().toISOString();
  return {
    logsByDate: new Map([
      [
        todayKey,
        {
          ...buildDailyLog(todayKey, [
            {
              id: "todo-e2e-1",
              taskId: "task-e2e-1",
              titleSnapshot: "E2E 할일",
              content: "E2E 할일",
              done: false,
              order: 0,
              startedAt: null,
              scheduledStartAt: null,
              pausedAt: null,
              completedAt: null,
              deviationSeconds: 0,
              actualFocusSeconds: null,
            },
          ]),
          restStartedAt: options?.initialRestActive ? nowIso : null,
        },
      ],
    ]),
    notificationSettings: {
      id: "notif-e2e-1",
      userId: "user-e2e-1",
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
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

function cloneLog(log: MockDailyLog): MockDailyLog {
  return {
    ...log,
    todos: log.todos.map((todo) => ({ ...todo })),
  };
}

function monthlySummaryFromLog(log: MockDailyLog) {
  const sortedTodos = [...log.todos].sort((a, b) => a.order - b.order);
  const doneCount = sortedTodos.filter((todo) => todo.done).length;

  return {
    id: `log-${log.dateKey}`,
    userId: "user-e2e-1",
    dateKey: log.dateKey,
    monthKey: toMonthKey(log.dateKey),
    memo: log.memo,
    todoCount: sortedTodos.length,
    doneCount,
    previewTodos: sortedTodos.map((todo) => todo.content),
    todos: sortedTodos.map((todo) => ({
      id: todo.id,
      taskId: todo.taskId,
      titleSnapshot: todo.titleSnapshot,
      content: todo.content,
      done: todo.done,
      order: todo.order,
    })),
  };
}

function getOrCreateLog(state: MockGraphqlState, dateKey: string) {
  const existing = state.logsByDate.get(dateKey);
  if (existing) {
    return existing;
  }

  const created = buildDailyLog(dateKey, []);
  state.logsByDate.set(dateKey, created);
  return created;
}

function applyStartTodo(state: MockGraphqlState, dateKey: string, todoId: string) {
  const log = getOrCreateLog(state, dateKey);
  const nowIso = new Date().toISOString();

  const nextTodos = log.todos.map((todo) => {
    if (todo.id === todoId) {
      return {
        ...todo,
        done: false,
        startedAt: nowIso,
        pausedAt: null,
        completedAt: null,
      };
    }
    return todo;
  });

  const updated = { ...log, todos: nextTodos };
  state.logsByDate.set(dateKey, updated);
  return cloneLog(updated);
}

function applyCompleteTodo(state: MockGraphqlState, dateKey: string, todoId: string) {
  const log = getOrCreateLog(state, dateKey);
  const nowIso = new Date().toISOString();

  const nextTodos = log.todos.map((todo) => {
    if (todo.id === todoId) {
      return {
        ...todo,
        done: true,
        completedAt: nowIso,
        startedAt: todo.startedAt ?? nowIso,
        pausedAt: null,
        actualFocusSeconds: todo.actualFocusSeconds ?? 0,
      };
    }
    return todo;
  });

  const updated = { ...log, todos: nextTodos };
  state.logsByDate.set(dateKey, updated);
  return cloneLog(updated);
}

function applyStartRestSession(state: MockGraphqlState, dateKey: string) {
  const log = getOrCreateLog(state, dateKey);
  const updated = {
    ...log,
    restStartedAt: new Date().toISOString(),
  };
  state.logsByDate.set(dateKey, updated);
  return cloneLog(updated);
}

function applyStopRestSession(state: MockGraphqlState, dateKey: string) {
  const log = getOrCreateLog(state, dateKey);
  const updated = {
    ...log,
    restStartedAt: null,
    restAccumulatedSeconds: Math.max(log.restAccumulatedSeconds, 60),
  };
  state.logsByDate.set(dateKey, updated);
  return cloneLog(updated);
}

async function installGraphqlMock(page: Page, state: MockGraphqlState, options?: { meSequence?: MeResponseMode[] }) {
  const meSequence = [...(options?.meSequence ?? ["success"])];

  await page.route("**/graphql", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    let body: { query?: string; variables?: Record<string, unknown> } | null = null;
    try {
      body = request.postDataJSON() as { query?: string; variables?: Record<string, unknown> };
    } catch {
      body = null;
    }

    const query = body?.query ?? "";
    const variables = body?.variables ?? {};

    if (query.includes("query Me")) {
      const mode = meSequence.length > 0 ? meSequence.shift() ?? "success" : "success";

      if (mode === "unauthorized") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            errors: [{ message: "Unauthorized" }],
          }),
        });
        return;
      }

      if (mode === "server-error") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            errors: [{ message: "Service Unavailable" }],
          }),
        });
        return;
      }

      if (mode === "network-error") {
        await route.abort("failed");
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            me: {
              id: "user-e2e-1",
              email: "e2e@focus-hybrid.dev",
            },
          },
        }),
      });
      return;
    }

    if (query.includes("mutation StartRestSession")) {
      const input = (variables.input ?? {}) as { dateKey?: string };
      const updatedLog = applyStartRestSession(state, input.dateKey ?? "");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            startRestSession: updatedLog,
          },
        }),
      });
      return;
    }

    if (query.includes("mutation StopRestSession")) {
      const input = (variables.input ?? {}) as { dateKey?: string };
      const updatedLog = applyStopRestSession(state, input.dateKey ?? "");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            stopRestSession: updatedLog,
          },
        }),
      });
      return;
    }

    if (query.includes("query DailyLogsByMonth")) {
      const monthKey = typeof variables.monthKey === "string" ? variables.monthKey : "";
      const logs = Array.from(state.logsByDate.values())
        .filter((log) => toMonthKey(log.dateKey) === monthKey)
        .map((log) => monthlySummaryFromLog(log));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            dailyLogsByMonth: logs,
          },
        }),
      });
      return;
    }

    if (query.includes("query DailyLogByDate")) {
      const dateKey = typeof variables.dateKey === "string" ? variables.dateKey : "";
      const log = cloneLog(getOrCreateLog(state, dateKey));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            dailyLog: log,
          },
        }),
      });
      return;
    }

    if (query.includes("query DailyLog(")) {
      const dateKey = typeof variables.dateKey === "string" ? variables.dateKey : "";
      const log = cloneLog(getOrCreateLog(state, dateKey));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            dailyLog: {
              dateKey: log.dateKey,
              memo: log.memo,
            },
          },
        }),
      });
      return;
    }

    if (query.includes("mutation StartTodo")) {
      const input = (variables.input ?? {}) as { dateKey?: string; todoId?: string };
      const updatedLog = applyStartTodo(state, input.dateKey ?? "", input.todoId ?? "");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            startTodo: updatedLog,
          },
        }),
      });
      return;
    }

    if (query.includes("mutation CompleteTodo")) {
      const input = (variables.input ?? {}) as { dateKey?: string; todoId?: string };
      const updatedLog = applyCompleteTodo(state, input.dateKey ?? "", input.todoId ?? "");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            completeTodo: updatedLog,
          },
        }),
      });
      return;
    }

    if (query.includes("query NotificationSettings")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            notificationSettings: state.notificationSettings,
          },
        }),
      });
      return;
    }

    if (query.includes("mutation UpdateNotificationSettings")) {
      const input = (variables.input ?? {}) as Record<string, unknown>;
      state.notificationSettings = {
        ...state.notificationSettings,
        ...input,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            updateNotificationSettings: state.notificationSettings,
          },
        }),
      });
      return;
    }

    if (query.includes("mutation RegisterPushDeviceToken")) {
      const input = (variables.input ?? {}) as { pushToken?: string; platform?: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            registerPushDeviceToken: {
              id: "push-token-e2e-1",
              pushToken: input.pushToken ?? "ExponentPushToken[e2e]",
              platform: input.platform ?? "unknown",
              isActive: true,
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
}

async function setupAuthenticatedMockedApp(page: Page, options?: SetupOptions) {
  const todayKey = formatDateKey(new Date());
  const state = createGraphqlState(todayKey, {
    initialRestActive: options?.initialRestActive,
  });
  await installGraphqlMock(page, state, {
    meSequence: options?.meSequence,
  });

  const persistedAuth = JSON.stringify({
    state: {
      token: "e2e-token",
      user: null,
    },
    version: 0,
  });

  await page.addInitScript(
    ([key, value, permission]) => {
      const auth = JSON.parse(value);
      auth.state.apiOrigin = window.location.origin;
      window.localStorage.setItem(key, JSON.stringify(auth));

      function MockNotification(this: { onclick: (() => void) | null }) {
        this.onclick = null;
      }

      MockNotification.permission = permission;
      MockNotification.requestPermission = async () => permission;
      MockNotification.prototype.close = () => {};

      Object.defineProperty(window, "Notification", {
        configurable: true,
        writable: true,
        value: MockNotification,
      });
    },
    ["focus-web-auth", persistedAuth, options?.notificationPermission ?? "granted"]
  );

  return { todayKey, state };
}

test.describe("core app flow", () => {
  for (const [effect, label] of [["fog", "안개"], ["rain", "비"], ["snow", "눈"]] as const) {
    test(`배경 ${label} 효과를 켜도 할일과 캘린더를 조작할 수 있고 끄면 제거됨`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const { todayKey } = await setupAuthenticatedMockedApp(page);
      // 로그인 안내 요청도 샘플 응답으로 처리해 실제 API의 인증 만료 응답이 테스트에 섞이지 않게 한다.
      await page.route("**/api/motivation/message**", (route) => route.fulfill({
        json: { message: "테스트 안내", ttlSeconds: 60 },
      }));
      await page.route("**/graphql", async (route) => {
        const query = String(route.request().postDataJSON()?.query ?? "");
        const emptyLists = ["RoutineTemplateWeekdayAssignments", "RoutineTemplates", "TaskCollections"];
        if (emptyLists.some((name) => query.includes(`query ${name}`))) {
          await route.fulfill({ json: { data: {
            routineTemplateWeekdayAssignments: [], routineTemplates: [], taskCollections: [],
          } } });
        } else {
          await route.fallback();
        }
      });
      const closeToasts = async () => {
        const closeButtons = page.getByRole("button", { name: "토스트 닫기", exact: true });
        // 자동으로 사라지는 알림도 있으므로 현재 표시된 닫기 버튼만 한 번에 눌러 촬영 화면을 정리한다.
        await closeButtons.evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLButtonElement).click()));
      };
      const setWeather = async (effect: "fog" | "rain" | "snow" | null) => {
        await page.evaluate((nextEffect) => {
          window.dispatchEvent(new CustomEvent("focus-hybrid-native-bridge", {
            detail: { type: "RN_PAPER_WEATHER_STATE", payload: { effect: nextEffect, mood: "dreamy", particleClarity: 70 } },
          }));
        }, effect);
      };

      await page.goto(`/#/date-tasks?date=${todayKey}`);
      const startButton = page.getByRole("button", { name: "집중 시작", exact: true });
      await expect(startButton).toBeVisible();
      await setWeather(effect);
      const weatherLayer = page.locator(".sketchbook-root-page-turn-sheet > .paper-weather-layer");
      const marks = weatherLayer.locator(effect === "fog" ? "img" : ".paper-falling-mark");
      if (effect === "fog") await expect(marks).toHaveCount(3);
      else await expect.poll(() => marks.count()).toBeGreaterThanOrEqual(10);
      await expect(weatherLayer).toHaveCSS("pointer-events", "none");
      await expect(weatherLayer).toHaveCSS("z-index", "0");
      const movingMark = marks.first();
      const initialBox = await movingMark.boundingBox();
      if (!initialBox) throw new Error("날씨 입자의 표시 영역이 없음");
      await expect.poll(async () => {
        const nextBox = await movingMark.boundingBox();
        return nextBox ? Math.abs(effect === "fog" ? nextBox.x - initialBox.x : nextBox.y - initialBox.y) : 0;
      }).toBeGreaterThan(5);
      // 글씨·조작부를 포함한 콘텐츠가 날씨 효과보다 앞에 있는지 실제 브라우저의 계산된 스타일로 확인한다.
      await expect(page.locator(".sketchbook-root-page-turn-sheet > .relative").last()).toHaveCSS("z-index", "1");
      await startButton.click();
      await expect(page.getByRole("button", { name: "집중 일시정지", exact: true })).toBeVisible();
      const gesture = page.locator(".todo-item-card__gesture-zone").first();
      const box = await gesture.boundingBox();
      if (!box) throw new Error("할 일 그리기 영역이 표시되지 않음");
      await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.9, { steps: 8 });
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.12, { steps: 12 });
      await page.mouse.up();
      await expect(page.getByRole("button", { name: "완료된 할 일", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "건너뛰기", exact: true }).click();
      await closeToasts();
      await expect.poll(() => weatherLayer.locator("img").evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)
      )).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`paper-${effect}-tasks.png`) });
      await setWeather(null);
      await expect(page.locator(".paper-weather-layer")).toHaveCount(0);

      await page.goto("/#/calendar");
      const todayCell = page.locator(`[data-calendar-date-key="${todayKey}"]`);
      await expect(todayCell).toBeVisible();
      await setWeather(effect);
      const calendarWeather = page.locator(".sketchbook-page--calendar > .paper-weather-layer");
      if (effect === "fog") await expect(calendarWeather.locator("img")).toHaveCount(3);
      else await expect.poll(() => calendarWeather.locator(".paper-falling-mark").count()).toBeGreaterThanOrEqual(10);
      await expect(calendarWeather).toHaveCSS("z-index", "0");
      await closeToasts();
      await page.screenshot({ path: testInfo.outputPath(`paper-${effect}-calendar.png`) });
      await todayCell.click();
      await expect(page).toHaveURL(/#\/date-tasks\/calendar\?date=/);
      await expect(page.getByRole("button", { name: "완료된 할 일", exact: true }).last()).toBeVisible();
    });
  }

  test("로그인 상태에서 캘린더 메인 화면이 렌더링됨", async ({ page }) => {
    await setupAuthenticatedMockedApp(page);

    await page.goto("/#/calendar");

    await expect(page).toHaveURL(/#\/calendar/);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "옵션으로 이동" })).toBeVisible();
    await expect(page.locator("[data-calendar-date-key]").first()).toBeVisible();
  });

  test("오늘 할일에서 시작 후 완료 상태가 유지됨", async ({ page }) => {
    const { todayKey } = await setupAuthenticatedMockedApp(page);

    await page.goto(`/#/date-tasks?date=${todayKey}`);

    await expect(page.getByRole("heading", { name: "오늘 할일" })).toBeVisible();
    await expect(page.getByRole("button", { name: /E2E 할일.*할일 시작/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "할일 시작", exact: true }).click();
    await expect(page.getByRole("button", { name: "완료", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "완료", exact: true }).click();
    await expect(page.getByText("완료됨")).toBeVisible();

    await page.reload();
    await expect(page.getByText("완료됨")).toBeVisible();
  });

  test("지난 날짜에서 오늘로 이동 버튼으로 날짜를 복귀함", async ({ page }) => {
    const { todayKey } = await setupAuthenticatedMockedApp(page);
    const previousDateKey = shiftDateKey(todayKey, -1);

    await page.goto(`/#/date-tasks?date=${previousDateKey}`);

    await expect(page.getByText("이 날짜에 기록된 할 일이 없어요")).toBeVisible();
    await page.getByRole("button", { name: "오늘로 이동" }).click();

    await expect(page).toHaveURL(new RegExp(`#\\/date-tasks\\?date=${todayKey}$`));
    await expect(page.getByRole("heading", { name: "오늘 할일" })).toBeVisible();
  });

  test("휴식 시작/중지 토글이 정상 동작함", async ({ page }) => {
    const { todayKey } = await setupAuthenticatedMockedApp(page);

    await page.goto(`/#/date-tasks?date=${todayKey}`);

    const restToggle = page.getByRole("button", { name: "휴식 시작", exact: true });
    await expect(restToggle).toBeVisible();
    await restToggle.click();

    await expect(page.getByRole("button", { name: "휴식 중지", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "휴식 중지", exact: true }).click();
    await expect(page.getByRole("button", { name: "휴식 시작", exact: true })).toBeVisible();
  });

  test("restFinished 진입 시 진행 중 휴식을 자동 종료함", async ({ page }) => {
    const { todayKey } = await setupAuthenticatedMockedApp(page, { initialRestActive: true });

    await page.goto(`/#/date-tasks?date=${todayKey}&restFinished=1`);

    await expect(page.getByRole("button", { name: "휴식 시작", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "휴식 중지", exact: true })).toHaveCount(0);
  });

  test("알림 설정 토글이 저장되고 새로고침 후에도 유지됨", async ({ page }) => {
    await setupAuthenticatedMockedApp(page, { notificationPermission: "granted" });

    await page.goto("/#/settings/notifications");
    await expect(page.getByRole("heading", { name: "알림" })).toBeVisible();

    const pushToggle = page.locator("p:text-is('푸쉬알림')").locator("xpath=..").getByRole("button");
    await expect(pushToggle).toHaveText("On");

    await pushToggle.click();
    await expect(pushToggle).toHaveText("Off");

    await page.waitForTimeout(450);
    await page.reload();

    const pushToggleAfterReload = page.locator("p:text-is('푸쉬알림')").locator("xpath=..").getByRole("button");
    await expect(pushToggleAfterReload).toHaveText("Off");
  });

  test("로그인 상태를 유지하다가 세션 만료 이벤트로 로그아웃됨", async ({ page }) => {
    await setupAuthenticatedMockedApp(page);

    await page.goto("/#/calendar");
    await expect(page).toHaveURL(/#\/calendar/);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();

    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("focus-hybrid-auth-expired"));
    });

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  });

});
