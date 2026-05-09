import type { FastifyInstance } from "fastify";
import { captureServerError, resolveErrorCode } from "../../common/observability/sentry.js";
import { env } from "../../config/env.js";

type ServiceErrorCode = "OPENAI_KEY_MISSING" | "OPENAI_REQUEST_FAILED" | "OPENAI_EMPTY_RESPONSE";

function buildPrompt() {
  return [
    "너는 생산성 앱의 로그인 환영 토스트 문구를 작성한다.",
    "반드시 한국어 한 문장만 출력한다.",
    "길이는 18~40자 사이로 유지한다.",
    "친절하고 담백한 동기부여 톤을 사용한다.",
    "따옴표, 번호, 줄바꿈, 이모지 사용 금지.",
    "특정 철학자/인물의 직접 인용처럼 보이는 표현 금지.",
    "허위 출처나 사실 주장 금지.",
    "오늘 할 일을 시작할 힘을 주는 문장으로 작성한다.",
  ].join("\n");
}

async function requestMotivationMessage() {
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
      input: buildPrompt(),
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
