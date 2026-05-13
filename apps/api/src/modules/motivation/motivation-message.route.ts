import type { FastifyInstance } from "fastify";
import { captureServerError, resolveErrorCode } from "../../common/observability/sentry.js";
import { env } from "../../config/env.js";

type ServiceErrorCode = "OPENAI_KEY_MISSING" | "OPENAI_REQUEST_FAILED" | "OPENAI_EMPTY_RESPONSE";
type MotivationStyle = "quote" | "metaphor" | "direct";

const QUOTE_SOURCE_CANDIDATES = [
  "세네카",
  "마르쿠스 아우렐리우스",
  "에픽테토스",
  "빅터 프랭클",
  "제임스 클리어",
  "칼 뉴포트",
  "유발 하라리",
  "메리 올리버",
  "무라카미 하루키",
  "브루스 리",
  "코비 브라이언트",
  "스티브 잡스",
] as const;

let recentQuoteSources: string[] = [];
let recentStyles: MotivationStyle[] = [];

function pickQuoteSource() {
  const available = QUOTE_SOURCE_CANDIDATES.filter((name) => !recentQuoteSources.includes(name));
  const pool = available.length > 0 ? available : [...QUOTE_SOURCE_CANDIDATES];
  const picked = pool[Math.floor(Math.random() * pool.length)] ?? QUOTE_SOURCE_CANDIDATES[0];
  recentQuoteSources = [...recentQuoteSources, picked].slice(-3);
  return picked;
}

function pickMotivationStyle() {
  const candidates: MotivationStyle[] = ["quote", "metaphor", "direct"];
  const available = candidates.filter((style) => !recentStyles.includes(style));
  const pool = available.length > 0 ? available : candidates;
  const picked = pool[Math.floor(Math.random() * pool.length)] ?? "direct";
  recentStyles = [...recentStyles, picked].slice(-2);
  return picked;
}

function styleInstruction(style: MotivationStyle, quoteSource: string) {
  if (style === "quote") {
    return [
      `이번 문장은 인용 기반 스타일로 작성한다. 참고 인물은 ${quoteSource} 한 명만 사용한다.`,
      "직접 인용부호 없이 의미를 풀어쓴 문장으로 작성한다.",
    ];
  }
  if (style === "metaphor") {
    return [
      "이번 문장은 비유 기반 스타일로 작성한다.",
      "가벼운 일상 비유 1개만 사용하고 과장된 수사는 피한다.",
    ];
  }
  return ["이번 문장은 직접 행동 제안 스타일로 작성한다.", "지금 바로 시작할 작은 행동을 부드럽게 제안한다."];
}

function buildPrompt(input: { quoteSource: string; style: MotivationStyle }) {
  const styleGuide = styleInstruction(input.style, input.quoteSource);
  return [
    "너는 생산성 앱의 로그인 환영 토스트 문구를 작성한다.",
    "반드시 한국어 한 문장만 출력한다.",
    "길이는 18~40자 사이로 유지한다.",
    "친절하고 담백한 동기부여 톤을 사용한다.",
    "문체는 부드러운 해요체를 사용한다.",
    "따옴표, 번호, 줄바꿈, 이모지 사용 금지.",
    "인물 인용은 선택 사항이며, 인용 없이도 자연스럽게 작성 가능하다.",
    "동일한 유명 철학자 문구를 반복 복제하지 않는다.",
    "허위 출처나 사실 주장 금지.",
    "오늘 할 일을 시작할 힘을 주는 문장으로 작성한다.",
    ...styleGuide,
  ].join("\n");
}

async function requestMotivationMessage() {
  if (!env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured");
    (error as Error & { code?: ServiceErrorCode }).code = "OPENAI_KEY_MISSING";
    throw error;
  }

  const quoteSource = pickQuoteSource();
  const style = pickMotivationStyle();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: buildPrompt({ quoteSource, style }),
      temperature: 0.8,
      max_output_tokens: 90,
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

  return text;
}

export async function registerMotivationMessageRoute(app: FastifyInstance) {
  app.get("/api/motivation/message", async (request, reply) => {
    try {
      const message = await requestMotivationMessage();
      return reply.send({
        message,
        ttlSeconds: 60 * 60 * 3,
      });
    } catch (error) {
      request.log.error(error);
      const code = (error as { code?: ServiceErrorCode })?.code;
      const route = request.url.split("?")[0] ?? request.url;

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
