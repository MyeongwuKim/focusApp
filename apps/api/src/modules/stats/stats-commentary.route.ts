import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";

const requestSchema = z.object({
  period: z.object({
    preset: z.string(),
    start: z.string(),
    end: z.string(),
    days: z.number().int().positive(),
  }),
  totals: z.object({
    doneCount: z.number().nonnegative(),
    incompleteCount: z.number().nonnegative(),
    focusMinutes: z.number().nonnegative(),
    deviationMinutes: z.number().nonnegative(),
    restMinutes: z.number().nonnegative(),
  }),
  rates: z.object({
    completionRate: z.number().min(0).max(100),
    incompleteRate: z.number().min(0).max(100),
  }),
  frequentIncompleteTasks: z.array(
    z.object({
      label: z.string().min(1),
      count: z.number().int().positive(),
    })
  ),
});

type StatsCommentaryRequest = z.infer<typeof requestSchema>;
type ServiceErrorCode = "OPENAI_KEY_MISSING" | "OPENAI_REQUEST_FAILED" | "OPENAI_EMPTY_RESPONSE";

function buildPrompt(payload: StatsCommentaryRequest) {
  const frequentIncompleteTaskLine =
    payload.frequentIncompleteTasks.length > 0
      ? payload.frequentIncompleteTasks.map((item) => `${item.label}(${item.count}회)`).join(", ")
      : "없음";
  const periodDays = payload.period.days;
  const periodMode =
    periodDays <= 1
      ? "daily"
      : periodDays <= 14
      ? "weekly"
      : periodDays <= 45
      ? "monthly"
      : periodDays <= 400
      ? "yearly"
      : "longterm";

  return [
    "너는 생산성 코치다. 사용자에게 한국어로 따뜻하고 공손한 서비스 톤으로 짧은 코멘트를 작성한다.",
    "출력 형식은 아래 5줄로 고정한다.",
    "1) 한줄요약: ...",
    "2) 잘한점: ...",
    "3) 미완료패턴: ...",
    "4) 개선포인트: ...",
    "5) 다음한걸음: ...",
    "각 줄은 50자 이내로 짧게 작성하고, 비난/의학 조언/단정 표현은 금지한다.",
    "문체 규칙:",
    "- 친절한 안내 문체를 사용한다.",
    "- 제안 문장은 '...해보는 건 어떨까요?' 형태를 우선 사용한다.",
    "- 압박하거나 평가하는 말투는 금지한다.",
    "- 반말 금지, 과장 금지.",
    "- 미완료패턴 줄에는 '작업명(횟수)'를 1~2개 반드시 포함한다. 데이터가 없으면 '반복 미완료 작업 없음'으로 작성한다.",
    "기간 해석 규칙:",
    "- daily: 당일 실행감 중심, 바로 실천 가능한 한걸음 제안",
    "- weekly: 반복 습관/패턴 중심, 다음 주에 유지할 1가지 제안",
    "- monthly: 추세 중심, 우선순위 정리/정비 제안",
    "- yearly/longterm: 큰 흐름 중심, 지속 가능한 페이스/회고 제안",
    `이번 요청의 기간모드: ${periodMode}`,
    "",
    `기간: ${payload.period.start} ~ ${payload.period.end} (${payload.period.days}일, preset=${payload.period.preset})`,
    `완료: ${payload.totals.doneCount}개`,
    `미완료: ${payload.totals.incompleteCount}개`,
    `완료율: ${payload.rates.completionRate.toFixed(1)}%`,
    `미완료율: ${payload.rates.incompleteRate.toFixed(1)}%`,
    `집중: ${payload.totals.focusMinutes}분`,
    `이탈: ${payload.totals.deviationMinutes}분`,
    `휴식: ${payload.totals.restMinutes}분`,
    `자주 미완료된 작업: ${frequentIncompleteTaskLine}`,
    "미완료패턴/개선포인트/다음한걸음에서는 가능하면 자주 미완료된 작업을 구체적으로 언급한다.",
  ].join("\n");
}

async function requestCommentary(payload: StatsCommentaryRequest) {
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
      input: buildPrompt(payload),
      temperature: 0.7,
      max_output_tokens: 220,
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
    .find((item) => item.type === "output_text" && typeof item.text === "string")
    ?.text;

  const text = (result.output_text ?? fallbackText ?? "").trim();
  if (!text) {
    const error = new Error("Empty commentary from OpenAI");
    (error as Error & { code?: ServiceErrorCode }).code = "OPENAI_EMPTY_RESPONSE";
    throw error;
  }
  return text;
}

export async function registerStatsCommentaryRoute(app: FastifyInstance) {
  app.post("/api/stats/commentary", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "요청 본문 형식이 올바르지 않아요.",
        issues: parsed.error.issues.map(() => "입력 값을 다시 확인해 주세요."),
      });
    }

    try {
      const commentary = await requestCommentary(parsed.data);
      return reply.send({ commentary });
    } catch (error) {
      request.log.error(error);
      const code = (error as { code?: ServiceErrorCode })?.code;
      if (code === "OPENAI_KEY_MISSING") {
        return reply.code(503).send({
          message: "서버 OpenAI API 키가 설정되지 않았어요.",
        });
      }
      if (code === "OPENAI_REQUEST_FAILED") {
        return reply.code(502).send({
          message: "통계 코멘트 생성 요청에 실패했어요.",
        });
      }
      if (code === "OPENAI_EMPTY_RESPONSE") {
        return reply.code(502).send({
          message: "통계 코멘트 응답이 비어 있어요.",
        });
      }
      return reply.code(500).send({
        message: "통계 코멘트 생성 중 오류가 발생했어요.",
      });
    }
  });
}
