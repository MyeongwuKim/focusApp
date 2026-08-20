import type { FastifyInstance } from "fastify";
import { getBearerToken, resolveUserIdFromSessionToken } from "../../common/auth/session.js";
import { captureServerError, resolveErrorCode } from "../../common/observability/sentry.js";
import { prisma } from "../../common/prisma.js";
import { env } from "../../config/env.js";
import {
  hasConsistentHaeyoSpeechLevel,
  hasRestSuggestion,
  pickEmptyPlanFallback,
} from "./motivation-message.utils.js";

type ServiceErrorCode = "OPENAI_KEY_MISSING" | "OPENAI_REQUEST_FAILED" | "OPENAI_EMPTY_RESPONSE";

type MotivationTodo = {
  content?: string | null;
  titleSnapshot?: string | null;
  done?: boolean | null;
  order?: number | null;
  startedAt?: Date | null;
  pausedAt?: Date | null;
  completedAt?: Date | null;
  scheduledStartAt?: Date | null;
  actualFocusSeconds?: number | null;
};

type MotivationLog = {
  dateKey: string;
  todoCount: number;
  doneCount: number;
  memo?: string | null;
  restAccumulatedSeconds?: number | null;
  todos: MotivationTodo[];
};

type MotivationContext = {
  dateKey: string;
  partOfDay: string;
  today: {
    todoCount: number;
    doneCount: number;
    openCount: number;
    focusMinutes: number;
    openTodoLabels: string[];
    inProgressTodoLabel: string | null;
    scheduledCount: number;
    hasMemo: boolean;
  };
  yesterday: {
    todoCount: number;
    openCount: number;
  } | null;
  recent: {
    activeDays: number;
    doneCount: number;
    openCount: number;
    focusMinutes: number;
  };
};

const DEFAULT_TIMEZONE = env.NOTIFICATION_BATCH_TIMEZONE;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TODO_LABEL_LENGTH = 14;

const UNNATURAL_MOTIVATION_PATTERNS = [
  /동기부여/,
  /생산성/,
  /데이터/,
  /분석/,
  /확인했어요/,
  /기록을\s*봤/,
  /패턴/,
  /목표를\s*향해/,
  /성공/,
  /당신/,
  /파이팅|화이팅/,
  /할\s*수\s*있어요/,
  /오늘도/,
  /(?:해보세요|해봅시다|하십시오|하세요|시작하세요|진행하세요)/,
  /작게라도/,
  /멋진\s*하루/,
  /(?:무거|흐름|첫\s*단추)/,
  /\d+\s*분(?:만|이면|부터)/,
];

function getZonedNow(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(partValue("hour"));

  return {
    dateKey: `${partValue("year")}-${partValue("month")}-${partValue("day")}`,
    hour: Number.isFinite(hour) ? hour : 9,
  };
}

function resolvePartOfDay(hour: number) {
  if (hour < 6) {
    return "새벽";
  }
  if (hour < 12) {
    return "오전";
  }
  if (hour < 18) {
    return "오후";
  }
  if (hour < 22) {
    return "저녁";
  }
  return "밤";
}

function normalizeDateKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return DATE_KEY_PATTERN.test(trimmed) ? trimmed : null;
}

function shiftDateKey(dateKey: string, days: number) {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + days));
  return date.toISOString().slice(0, 10);
}

function isDoneTodo(todo: MotivationTodo) {
  return Boolean(todo.done || todo.completedAt);
}

function isInProgressTodo(todo: MotivationTodo) {
  return !isDoneTodo(todo) && Boolean(todo.startedAt) && !todo.pausedAt;
}

function compactTodoLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_TODO_LABEL_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_TODO_LABEL_LENGTH)}...`;
}

function getTodoLabel(todo: MotivationTodo) {
  const title = todo.titleSnapshot?.trim();
  if (title) {
    return compactTodoLabel(title);
  }

  const content = todo.content?.trim();
  return content ? compactTodoLabel(content) : null;
}

function getFocusMinutes(todos: MotivationTodo[]) {
  const totalSeconds = todos.reduce((sum, todo) => sum + Math.max(todo.actualFocusSeconds ?? 0, 0), 0);
  return Math.round(totalSeconds / 60);
}

function summarizeLog(log: MotivationLog | null | undefined) {
  const todos = log?.todos ?? [];
  const openTodos = todos
    .filter((todo) => !isDoneTodo(todo))
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    todoCount: log?.todoCount ?? todos.length,
    doneCount: log?.doneCount ?? todos.filter(isDoneTodo).length,
    openCount: openTodos.length,
    focusMinutes: getFocusMinutes(todos),
    openTodoLabels: openTodos.map(getTodoLabel).filter((label): label is string => Boolean(label)).slice(0, 3),
    inProgressTodoLabel: getTodoLabel(openTodos.find(isInProgressTodo) ?? {}) ?? null,
    scheduledCount: openTodos.filter((todo) => Boolean(todo.scheduledStartAt)).length,
    hasMemo: Boolean(log?.memo?.trim()),
  };
}

async function buildMotivationContext(input: {
  userId: string;
  dateKey: string;
  now: Date;
}): Promise<MotivationContext> {
  const fromDateKey = shiftDateKey(input.dateKey, -6);
  const yesterdayDateKey = shiftDateKey(input.dateKey, -1);
  const [todayLog, recentLogs] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: {
        userId_dateKey: {
          userId: input.userId,
          dateKey: input.dateKey,
        },
      },
      select: {
        dateKey: true,
        todoCount: true,
        doneCount: true,
        memo: true,
        todos: true,
      },
    }),
    prisma.dailyLog.findMany({
      where: {
        userId: input.userId,
        dateKey: {
          gte: fromDateKey,
          lte: input.dateKey,
        },
      },
      orderBy: {
        dateKey: "desc",
      },
      take: 7,
      select: {
        dateKey: true,
        todoCount: true,
        doneCount: true,
        memo: true,
        todos: true,
      },
    }),
  ]);

  const today = summarizeLog(todayLog);
  const yesterdayLog = recentLogs.find((log) => log.dateKey === yesterdayDateKey);
  const yesterdaySummary = yesterdayLog ? summarizeLog(yesterdayLog) : null;
  const recentSummaries = recentLogs.map(summarizeLog);
  const zonedNow = getZonedNow(input.now, DEFAULT_TIMEZONE);

  return {
    dateKey: input.dateKey,
    partOfDay: resolvePartOfDay(zonedNow.hour),
    today,
    yesterday: yesterdaySummary
      ? {
          todoCount: yesterdaySummary.todoCount,
          openCount: yesterdaySummary.openCount,
        }
      : null,
    recent: {
      activeDays: recentSummaries.filter((summary) => summary.todoCount > 0 || summary.focusMinutes > 0).length,
      doneCount: recentSummaries.reduce((sum, summary) => sum + summary.doneCount, 0),
      openCount: recentSummaries.reduce((sum, summary) => sum + summary.openCount, 0),
      focusMinutes: recentSummaries.reduce((sum, summary) => sum + summary.focusMinutes, 0),
    },
  };
}

function buildContextLines(context: MotivationContext) {
  const lines = [
    `날짜: ${context.dateKey}`,
    `시간대: ${context.partOfDay}`,
    `오늘 할 일: ${context.today.todoCount}개`,
    `오늘 완료: ${context.today.doneCount}개`,
    `오늘 남은 할 일: ${context.today.openCount}개`,
    `오늘 집중: ${context.today.focusMinutes}분`,
    `진행 중인 할 일: ${context.today.inProgressTodoLabel ?? "없음"}`,
    `남은 할 일 예시: ${context.today.openTodoLabels.length > 0 ? context.today.openTodoLabels.join(", ") : "없음"}`,
    `예약된 할 일: ${context.today.scheduledCount}개`,
    `오늘 메모: ${context.today.hasMemo ? "있음" : "없음"}`,
    `최근 7일 기록일: ${context.recent.activeDays}일`,
    `최근 7일 완료: ${context.recent.doneCount}개`,
    `최근 7일 미완료: ${context.recent.openCount}개`,
    `최근 7일 집중: ${context.recent.focusMinutes}분`,
  ];

  if (context.yesterday) {
    lines.push(`어제 할 일: ${context.yesterday.todoCount}개`, `어제 남은 할 일: ${context.yesterday.openCount}개`);
  }

  return lines;
}

function buildPrompt(context: MotivationContext) {
  const emptyPlanGuide =
    context.today.todoCount === 0
      ? [
          "오늘 할 일이 0개여도 쉬는 날이나 휴식이 필요하다고 추측하지 않는다.",
          "일정을 가볍게 확인하거나 필요한 할 일 하나를 고르는 방향으로 말한다.",
        ]
      : [];
  return [
    "너는 할 일 앱에서 사용자의 다음 한 걸음을 돕는 따뜻한 페이스메이커다.",
    "반드시 한국어 한 문장만 출력한다.",
    "길이는 22~55자 사이로 유지한다.",
    "캐릭터는 매번 동일하다: 다정하지만 늘어지지 않고, 부담을 키우지 않으면서 행동을 당긴다.",
    "반드시 부드러운 해요체 존댓말만 쓰고, 반말과 합니다체는 쓰지 않는다.",
    "상태를 짧게 짚은 뒤 오늘 할 일에 바로 손댈 수 있는 말을 건넨다.",
    "과거의 미완료를 지적하거나 사용자가 죄책감을 느낄 표현은 쓰지 않는다.",
    "할 일이 모두 끝난 경우에도 휴식을 권하지 말고, 완료한 일을 짧게 인정하며 마무리한다.",
    "쉬다, 쉬어도 된다, 휴식, 아무것도 하지 않아도 된다는 표현은 어떤 경우에도 사용하지 않는다.",
    "사용자 기록을 보고 말하되, 분석 리포트처럼 보이지 않게 쓴다.",
    "숫자는 문장에 꼭 자연스러울 때만 최대 1개 사용한다.",
    "참고 상태에 없는 시간이나 분량을 임의로 정해서 제안하지 않는다.",
    "할 일 제목은 필요할 때만 자연스럽게 1개까지 언급한다.",
    "명언, 유명인, 과장된 응원, 뻔한 자기계발 문구 금지.",
    "따옴표, 번호, 줄바꿈, 이모지, 느낌표 사용 금지.",
    "허위 출처나 사실 주장 금지.",
    "금지 표현: 동기부여, 생산성, 데이터, 분석, 확인했어요, 패턴, 목표를 향해, 성공, 파이팅, 화이팅, 할 수 있어요, 오늘도, 해보세요, 하세요, 괜찮아, 힘내, 하자, 시작이 무겁다, 흐름, 첫 단추.",
    "좋은 예시 톤: 가장 가까운 일부터 시작해봐요, 하나 끝내고 다음을 보면 돼요.",
    "좋은 예시 톤: 벌써 하나 끝냈네요, 다음은 가장 가까운 일부터 이어가봐요.",
    "좋은 예시 톤: 오늘 할 일은 다 끝냈네요, 계획한 만큼 제대로 해냈어요.",
    ...emptyPlanGuide,
    "",
    "참고 상태:",
    ...buildContextLines(context),
  ].join("\n");
}

function normalizeMotivationText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replaceAll("할일", "할 일")
    .replace(/[“”"']/g, "")
    .trim();
}

function isNaturalMotivationMessage(text: string, context: MotivationContext) {
  if (text.length < 10 || text.length > 80) {
    return false;
  }
  if (hasRestSuggestion(text) || !hasConsistentHaeyoSpeechLevel(text)) {
    return false;
  }
  return !UNNATURAL_MOTIVATION_PATTERNS.some((pattern) => pattern.test(text));
}

function buildFallbackMotivationMessage(context: MotivationContext) {
  const firstOpenTodo = context.today.openTodoLabels[0];

  if (context.today.todoCount === 0) {
    return pickEmptyPlanFallback(context.dateKey);
  }

  if (context.today.openCount === 0) {
    return "오늘 할 일은 다 끝냈네요, 계획한 만큼 제대로 해냈어요.";
  }

  if (context.today.doneCount > 0) {
    return firstOpenTodo
      ? `벌써 ${context.today.doneCount}개 끝냈네요, 다음은 ${firstOpenTodo}부터 이어가봐요.`
      : `벌써 ${context.today.doneCount}개 끝냈네요, 다음은 가장 가까운 일부터 이어가봐요.`;
  }

  if (firstOpenTodo) {
    return `${firstOpenTodo}부터 시작해봐요, 하나 끝내고 다음을 보면 돼요.`;
  }

  return "가장 가까운 일부터 시작해봐요, 하나 끝내고 다음을 보면 돼요.";
}

async function requestMotivationMessage(context: MotivationContext) {
  if (!env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured");
    (error as Error & { code?: ServiceErrorCode }).code = "OPENAI_KEY_MISSING";
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: buildPrompt(context),
      temperature: 0.4,
      max_output_tokens: 120,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`OpenAI request failed: ${response.status} ${detail}`);
    (error as Error & { code?: ServiceErrorCode }).code = "OPENAI_REQUEST_FAILED";
    throw error;
  }

  const result = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const fallbackText = result.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string")?.text;

  const text = (result.output_text ?? fallbackText ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    const error = new Error("Empty motivation message from OpenAI");
    (error as Error & { code?: ServiceErrorCode }).code = "OPENAI_EMPTY_RESPONSE";
    throw error;
  }

  const normalizedText = normalizeMotivationText(text);
  return isNaturalMotivationMessage(normalizedText, context)
    ? normalizedText
    : buildFallbackMotivationMessage(context);
}

export async function registerMotivationMessageRoute(app: FastifyInstance) {
  app.get("/api/motivation/message", async (request, reply) => {
    const route = request.url.split("?")[0] ?? request.url;

    try {
      const token = getBearerToken(request);
      const userId = token
        ? await resolveUserIdFromSessionToken(token, {
            refreshExpiresAt: false,
          })
        : null;

      if (!userId) {
        return reply.code(401).send({
          message: "로그인이 필요해요.",
        });
      }

      const now = new Date();
      const requestedDateKey = normalizeDateKey((request.query as { dateKey?: string } | undefined)?.dateKey);
      const context = await buildMotivationContext({
        userId,
        dateKey: requestedDateKey ?? getZonedNow(now, DEFAULT_TIMEZONE).dateKey,
        now,
      });
      const message = await requestMotivationMessage(context);
      return reply.send({
        message,
        ttlSeconds: 60 * 60 * 3,
      });
    } catch (error) {
      request.log.error(error);
      const code = (error as { code?: ServiceErrorCode })?.code;

      if (code === "OPENAI_KEY_MISSING") {
        captureServerError(error, {
          requestId: request.id,
          method: request.method,
          route,
          userId: null,
          statusCode: 503,
          errorCode: resolveErrorCode(error),
          requestInput: null,
        });
        return reply.code(503).send({
          message: "서버 OpenAI API 키가 설정되지 않았어요.",
        });
      }

      if (code === "OPENAI_REQUEST_FAILED") {
        captureServerError(error, {
          requestId: request.id,
          method: request.method,
          route,
          userId: null,
          statusCode: 502,
          errorCode: resolveErrorCode(error),
          requestInput: null,
        });
        return reply.code(502).send({
          message: "동기부여 멘트 생성 요청에 실패했어요.",
        });
      }

      if (code === "OPENAI_EMPTY_RESPONSE") {
        captureServerError(error, {
          requestId: request.id,
          method: request.method,
          route,
          userId: null,
          statusCode: 502,
          errorCode: resolveErrorCode(error),
          requestInput: null,
        });
        return reply.code(502).send({
          message: "동기부여 멘트 응답이 비어 있어요.",
        });
      }

      captureServerError(error, {
        requestId: request.id,
        method: request.method,
        route,
        userId: null,
        statusCode: 500,
        errorCode: resolveErrorCode(error),
        requestInput: null,
      });
      return reply.code(500).send({
        message: "동기부여 멘트 생성 중 오류가 발생했어요.",
      });
    }
  });
}
