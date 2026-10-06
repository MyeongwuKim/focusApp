import type { FastifyInstance } from "fastify";
import { getBearerToken, resolveUserIdFromSessionToken } from "../../common/auth/session.js";
import { captureServerError, resolveErrorCode } from "../../common/observability/sentry.js";
import { prisma } from "../../common/prisma.js";
import { env } from "../../config/env.js";
import {
  hasConsistentHaeyoSpeechLevel,
  hasRestSuggestion,
  pickMotivationFallback,
  resolveMotivationMessageState,
  type MotivationMessageState,
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
};

type MotivationLog = {
  dateKey: string;
  todoCount: number;
  doneCount: number;
  todos: MotivationTodo[];
};

type MotivationContext = {
  dateKey: string;
  partOfDay: string;
  state: MotivationMessageState;
  today: {
    todoCount: number;
    doneCount: number;
    openCount: number;
    openTodoLabels: string[];
    inProgressTodoLabel: string | null;
    hasInProgressTodo: boolean;
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
  /(?:여백|첫\s*장|첫걸음|방향을\s*잡|채워\s*가)/,
  /(?:메모|최근\s*기록|어제)/,
  /\d+\s*분(?:만|이면|부터)/,
];

const INVALID_PATTERNS_BY_STATE: Record<MotivationMessageState, readonly RegExp[]> = {
  EMPTY: [/할\s*일(?:이|은)?.*(?:없|비어)/, /(?:적어|추가|등록)(?:두|해|하)/],
  NOT_STARTED: [/(?:다|모두|전부).*(?:끝|마쳤|완료)/, /(?:끝냈|마쳤)네요/],
  IN_PROGRESS: [/(?:다|모두|전부).*(?:끝|마쳤|완료)/, /새(?:로운)?\s*할\s*일/],
  PARTIAL_DONE: [/(?:다|모두|전부).*(?:끝|마쳤|완료)/],
  ALL_DONE: [/(?:시작|이어가|다음|남은\s*일|골라|적어|추가)/],
};

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
    openTodoLabels: openTodos.map(getTodoLabel).filter((label): label is string => Boolean(label)).slice(0, 3),
    inProgressTodoLabel: getTodoLabel(openTodos.find(isInProgressTodo) ?? {}) ?? null,
    hasInProgressTodo: openTodos.some(isInProgressTodo),
  };
}

/** 오늘 로그만 조회해 할 일 없음·시작 전·진행 중·일부 완료·전체 완료 상태를 판정한다. */
async function buildMotivationContext(input: {
  userId: string;
  dateKey: string;
  now: Date;
}): Promise<MotivationContext> {
  const todayLog = await prisma.dailyLog.findUnique({
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
      todos: true,
    },
  });

  const today = summarizeLog(todayLog);
  const state = resolveMotivationMessageState({
    todoCount: today.todoCount,
    doneCount: today.doneCount,
    openCount: today.openCount,
    hasInProgressTodo: today.hasInProgressTodo,
  });
  const zonedNow = getZonedNow(input.now, DEFAULT_TIMEZONE);

  return {
    dateKey: input.dateKey,
    partOfDay: resolvePartOfDay(zonedNow.hour),
    state,
    today,
  };
}

function buildContextLines(context: MotivationContext) {
  return [
    `현재 상태: ${context.state}`,
    `시간대: ${context.partOfDay}`,
    `오늘 할 일: ${context.today.todoCount}개`,
    `오늘 완료: ${context.today.doneCount}개`,
    `오늘 남은 할 일: ${context.today.openCount}개`,
    `진행 중인 할 일: ${context.today.inProgressTodoLabel ?? "없음"}`,
    `남은 할 일 예시: ${context.today.openTodoLabels.length > 0 ? context.today.openTodoLabels.join(", ") : "없음"}`,
  ];
}

/** 상태마다 허용할 격려 방향과 금지할 제안을 분리해 서로 모순되는 문장이 생성되지 않도록 한다. */
function getStatePromptGuide(state: MotivationMessageState) {
  switch (state) {
    case "EMPTY":
      return [
        "현재 상태는 오늘 등록된 할 일이 없는 상태다.",
        "할 일이 없다는 사실을 직접 말하거나 할 일을 적기, 추가하기, 등록하기를 권하지 않는다.",
        "오늘은 지금부터 시작할 수 있다는 식으로 부담 없이 행동할 마음만 당겨준다.",
      ];
    case "NOT_STARTED":
      return [
        "현재 상태는 할 일은 있지만 아직 시작하지 않은 상태다.",
        "남은 할 일 중 하나를 자연스럽게 언급해 가볍게 시작하도록 돕는다.",
      ];
    case "IN_PROGRESS":
      return [
        "현재 상태는 한 가지 할 일을 진행 중인 상태다.",
        "새로운 일을 제안하지 말고 지금 하던 일에 집중하거나 마무리하도록 응원한다.",
      ];
    case "PARTIAL_DONE":
      return [
        "현재 상태는 일부 할 일을 끝냈고 남은 일이 있는 상태다.",
        "끝낸 일을 짧게 인정하고 남은 일 하나를 차분히 이어가도록 말한다.",
      ];
    case "ALL_DONE":
      return [
        "현재 상태는 오늘 할 일을 모두 끝낸 상태다.",
        "새 일을 시작하거나 다음 일을 찾으라고 하지 말고, 완료한 사실만 자연스럽게 인정하며 끝낸다.",
      ];
  }
}

function buildPrompt(context: MotivationContext) {
  return [
    "너는 할 일 앱에서 지금 상태에 맞는 짧은 한마디를 건네는 안내자다.",
    "반드시 자연스러운 한국어 한 문장만 출력한다.",
    "길이는 18~50자 사이로 유지한다.",
    "부드러운 해요체 존댓말만 쓰고, 반말과 합니다체는 쓰지 않는다.",
    "직접적이고 이해하기 쉬운 말로 쓰며 추상적인 비유나 감성 문구는 쓰지 않는다.",
    "메모, 과거 기록, 최근 통계, 어제 상태를 언급하거나 추측하지 않는다.",
    "쉬다, 휴식, 아무것도 하지 않아도 된다는 표현은 사용하지 않는다.",
    "상태에 없는 시간이나 분량을 임의로 정하지 않는다.",
    "숫자는 꼭 자연스러울 때만 최대 1개 사용하고, 할 일 제목도 최대 1개만 언급한다.",
    "명언, 과장된 응원, 자기계발 문구, 이모지, 느낌표, 따옴표, 줄바꿈은 쓰지 않는다.",
    "금지 표현: 동기부여, 생산성, 데이터, 분석, 확인했어요, 패턴, 목표를 향해, 성공, 파이팅, 화이팅, 할 수 있어요, 오늘도, 여백, 첫 장, 첫걸음, 흐름, 방향, 채워가다.",
    ...getStatePromptGuide(context.state),
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
  return ![...UNNATURAL_MOTIVATION_PATTERNS, ...INVALID_PATTERNS_BY_STATE[context.state]].some(
    (pattern) => pattern.test(text)
  );
}

function buildFallbackMotivationMessage(context: MotivationContext) {
  return pickMotivationFallback(context.state, context.dateKey);
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
        ttlSeconds: 60,
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
