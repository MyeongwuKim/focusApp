import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { captureServerError, resolveErrorCode } from "../../common/observability/sentry.js";
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
    resumeCount: z.number().nonnegative(),
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
  meta: z.object({
    activeDays: z.number().int().nonnegative(),
    daysWithTodos: z.number().int().nonnegative(),
    daysWithFocus: z.number().int().nonnegative(),
    daysWithIncomplete: z.number().int().nonnegative(),
    firstActiveDate: z.string().nullable(),
    lastActiveDate: z.string().nullable(),
    dataCoverageRate: z.number().min(0).max(100),
    avgDonePerActiveDay: z.number().nonnegative(),
    avgIncompletePerActiveDay: z.number().nonnegative(),
  }),
});

type StatsCommentaryRequest = z.infer<typeof requestSchema>;
type ServiceErrorCode = "OPENAI_KEY_MISSING" | "OPENAI_REQUEST_FAILED" | "OPENAI_EMPTY_RESPONSE";

const structuredCommentarySchema = z.object({
  summary: z.string().min(1),
  goodPoint: z.string().min(1).nullable(),
  weakPoint: z.string().min(1).nullable(),
  advice: z.string().min(1),
});

type StructuredCommentaryResponse = z.infer<typeof structuredCommentarySchema>;

function pickCoachVoice(payload: StatsCommentaryRequest) {
  const daySeed = Number(payload.period.end.replaceAll("-", "")) || payload.period.days;
  const variants = ["담백한 코치", "전략형 플래너", "차분한 파트너"] as const;
  return variants[daySeed % variants.length];
}

function normalizeCommentaryText(text: string) {
  return text.replaceAll("할일", "할 일").replaceAll("리액트", "React").trim();
}

function normalizeCommentaryBody(text: string) {
  return normalizeCommentaryText(text).replace(/\s+/g, " ").trim();
}

const COMMENTARY_LABELS = ["요약", "잘한점", "아쉬운점", "플래너조언"] as const;
type CommentaryLabel = (typeof COMMENTARY_LABELS)[number];

const COMMENTARY_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "stats_commentary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
        description: "요약 섹션의 자연스러운 한국어 한 문장",
      },
      goodPoint: {
        type: ["string", "null"],
        description: "잘한점 섹션의 자연스러운 한국어 한 문장. 작성하지 않는 경우 null",
      },
      weakPoint: {
        type: ["string", "null"],
        description: "아쉬운점 섹션의 자연스러운 한국어 한 문장. 작성하지 않는 경우 null",
      },
      advice: {
        type: "string",
        description: "플래너조언 섹션의 자연스러운 한국어 한 문장",
      },
    },
    required: ["summary", "goodPoint", "weakPoint", "advice"],
  },
} as const;

const UNNATURAL_COMMENTARY_PATTERNS = [
  /작업\s*완결/,
  /시간을\s*투자/,
  /주요\s*작업/,
  /반복되어/,
  /확인했어요/,
  /완료\s*\d+개를\s*남겨/,
  /완료한\s*기록을\s*\d+개\s*남겨/,
  /작게라도/,
  /누적됐어요/,
  /\d+일\s*중\s*\d+일\s*동안/,
  /미완료(?:가|는)?\s*\d+일(?:이나)?\s*(?:발생|기록)/,
  /\d+일에\s*(?:발생|기록)/,
  /관련\s*작업에서\s*어려움/,
  /끝나지\s*않아/,
  /아쉬움(?:이|은)?\s*(?:있었|남았)/,
  /(?:합시다|해봅시다|해보시죠|하십시오|하세요[.!]?|할게요)/,
  /(?:흐름|패턴)이에요/,
  /(?:살펴봐요|정리해요)/,
];

function hasMeaningfulGoodPoint(payload: StatsCommentaryRequest) {
  return payload.totals.doneCount > 0 || payload.totals.focusMinutes > 0;
}

function hasMeaningfulWeakPoint(payload: StatsCommentaryRequest) {
  const totalTodos = payload.totals.doneCount + payload.totals.incompleteCount;
  const resumePerTodo = totalTodos > 0 ? payload.totals.resumeCount / totalTodos : 0;
  return payload.totals.incompleteCount > 0 || (totalTodos > 0 && resumePerTodo >= 1);
}

function getEnabledCommentaryLabels(payload: StatsCommentaryRequest): CommentaryLabel[] {
  return [
    "요약",
    ...(hasMeaningfulGoodPoint(payload) ? (["잘한점"] as const) : []),
    ...(hasMeaningfulWeakPoint(payload) ? (["아쉬운점"] as const) : []),
    "플래너조언",
  ];
}

function resolvePeriodLabel(period: StatsCommentaryRequest["period"]) {
  const preset = period.preset.toLowerCase();
  if (preset.includes("week")) {
    return "일주일";
  }
  if (preset.includes("month")) {
    return "한 달";
  }
  if (preset.includes("year")) {
    return "1년";
  }
  return `${period.days}일`;
}

function buildDeterministicCommentary(payload: StatsCommentaryRequest): Record<CommentaryLabel, string> {
  const periodLabel = resolvePeriodLabel(payload.period);
  const doneCount = payload.totals.doneCount;
  const incompleteCount = payload.totals.incompleteCount;
  const focusMinutes = payload.totals.focusMinutes;
  const activeDays = payload.meta.activeDays;
  const completionRate = payload.rates.completionRate.toFixed(1);
  const totalTodos = doneCount + incompleteCount;
  const resumePerTodo = totalTodos > 0 ? payload.totals.resumeCount / totalTodos : 0;
  const activePhrase = activeDays === 1 ? `${periodLabel} 중 하루만 진행했고` : `${periodLabel} 동안 ${activeDays}일 진행했고`;
  const topIncompleteTask = payload.frequentIncompleteTasks[0];

  const summary =
    totalTodos === 0 && focusMinutes === 0
      ? `${activePhrase} 할 일과 집중 기록은 거의 없었어요.`
      : totalTodos === 0
      ? `${activePhrase} 할 일 완료는 0개였고 집중은 ${focusMinutes}분이었어요.`
      : `${activePhrase} 완료 ${doneCount}개, 미완료 ${incompleteCount}개로 완료율 ${completionRate}%였고 집중은 ${focusMinutes}분이었어요.`;

  const goodPoint =
    Number(payload.rates.completionRate) >= 70
      ? `완료율이 ${completionRate}%로 유지돼서 할 일 마무리 흐름이 안정적이었어요.`
      : doneCount > 0
      ? `${doneCount}개를 완료해 마무리한 기록이 있었어요.`
      : payload.meta.daysWithFocus > 0
      ? `집중 기록일이 ${payload.meta.daysWithFocus}일이라 최소한의 실행 리듬은 이어졌어요.`
      : topIncompleteTask
      ? `${topIncompleteTask.label} 기록이 ${topIncompleteTask.count}번 남아 우선 정리할 작업이 분명해졌어요.`
      : activeDays > 0
      ? `${activeDays}일 동안 기록을 남겨서 다음 계획을 세울 단서가 생겼어요.`
      : "이번 기간은 기록이 적어서 다음 계획을 세울 출발점만 확인했어요.";

  const weakPoint =
    incompleteCount > 0
      ? `끝내지 못한 일이 ${incompleteCount}개 남았어요.`
      : resumePerTodo >= 1
      ? `할 일당 재개가 ${resumePerTodo.toFixed(2)}회라 한 번에 끝내기 어려운 구간이 있었어요.`
      : `기록일 대비 완료량 편차가 있어 일정한 마무리 흐름은 조금 아쉬웠어요.`;

  const advice =
    incompleteCount > 0
      ? "미완료가 많은 항목부터 오늘 완료 기준을 한 줄로 정하고 같은 유형을 묶어서 처리해보면 좋아요."
      : "하루 시작할 때 가장 오래 걸리는 할 일 1개를 먼저 고정해서 완료 흐름을 만들어보면 좋아요.";

  return {
    요약: summary,
    잘한점: goodPoint,
    아쉬운점: weakPoint,
    플래너조언: advice,
  };
}

function extractCommentarySections(
  text: string,
  fallbackLabelOrder: readonly CommentaryLabel[] = COMMENTARY_LABELS
): Partial<Record<CommentaryLabel, string>> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Partial<Record<CommentaryLabel, string>> = {};
  const unlabeledBodies: string[] = [];
  const normalizedLabelMap = new Map<string, CommentaryLabel>(
    COMMENTARY_LABELS.map((label) => [label.replace(/\s+/g, ""), label])
  );

  for (const line of lines) {
    const inlineMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (!inlineMatch) {
      unlabeledBodies.push(line.replace(/\s+/g, " ").trim());
      continue;
    }
    const rawLabel = inlineMatch[1].replace(/\s+/g, "");
    const body = inlineMatch[2].replace(/\s+/g, " ").trim();
    const matchedLabel = normalizedLabelMap.get(rawLabel);
    if (matchedLabel && body) {
      sections[matchedLabel] = body;
    } else if (body) {
      unlabeledBodies.push(body);
    }
  }

  for (const label of fallbackLabelOrder) {
    if (!sections[label] && unlabeledBodies.length > 0) {
      sections[label] = unlabeledBodies.shift();
    }
  }

  return sections;
}

function hasUnnaturalCommentaryPhrase(body: string) {
  return UNNATURAL_COMMENTARY_PATTERNS.some((pattern) => pattern.test(body));
}

function shouldRejectCommentaryBody(body: string, requireMetric: boolean) {
  const hasPlaceholderLikeText =
    body.includes("기록이 적어서") ||
    body.includes("기록이 많지 않아") ||
    body.includes("관찰된 내용만") ||
    body.includes("최근 활동 기준으로만");
  if (hasPlaceholderLikeText) {
    return true;
  }
  if (requireMetric && !/\d/.test(body)) {
    return true;
  }
  if (hasUnnaturalCommentaryPhrase(body)) {
    return true;
  }
  return body.length < 6;
}

function finalizeCommentarySections(
  sections: Partial<Record<CommentaryLabel, string>>,
  payload: StatsCommentaryRequest
) {
  const enabledLabels = getEnabledCommentaryLabels(payload);
  const fallback = buildDeterministicCommentary(payload);

  const lines = enabledLabels.map((label) => {
    const candidate = sections[label]?.trim();
    const requireMetric = label === "요약" || label === "잘한점";
    const normalizedCandidate = candidate ? normalizeCommentaryBody(candidate) : undefined;
    const body =
      normalizedCandidate && !shouldRejectCommentaryBody(normalizedCandidate, requireMetric)
        ? normalizedCandidate
        : fallback[label];
    return `${label}: ${body}`;
  });

  if (lines.length !== enabledLabels.length) {
    return enabledLabels.map((label) => `${label}: ${fallback[label]}`).join("\n");
  }

  return lines.join("\n");
}

function finalizeCommentary(text: string, payload: StatsCommentaryRequest) {
  const normalized = normalizeCommentaryText(text);
  const enabledLabels = getEnabledCommentaryLabels(payload);
  const parsed = extractCommentarySections(normalized, enabledLabels);
  return finalizeCommentarySections(parsed, payload);
}

function parseStructuredCommentary(text: string) {
  try {
    const parsedJson = JSON.parse(text) as unknown;
    const parsed = structuredCommentarySchema.safeParse(parsedJson);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function finalizeStructuredCommentary(
  response: StructuredCommentaryResponse,
  payload: StatsCommentaryRequest
) {
  return finalizeCommentarySections(
    {
      요약: response.summary,
      잘한점: response.goodPoint ?? undefined,
      아쉬운점: response.weakPoint ?? undefined,
      플래너조언: response.advice,
    },
    payload
  );
}

function buildPrompt(payload: StatsCommentaryRequest) {
  const frequentIncompleteTaskLine =
    payload.frequentIncompleteTasks.length > 0
      ? payload.frequentIncompleteTasks.map((item) => `${item.label}(${item.count}회)`).join(", ")
      : "없음";
  const totalTodos = payload.totals.doneCount + payload.totals.incompleteCount;
  const resumePerTodo = totalTodos > 0 ? payload.totals.resumeCount / totalTodos : 0;
  const coachVoice = pickCoachVoice(payload);
  const enabledLabels = getEnabledCommentaryLabels(payload);
  const draft = buildDeterministicCommentary(payload);
  const draftFormat = enabledLabels.map((label) => `${label}: ${draft[label]}`);
  const disabledLabels = COMMENTARY_LABELS.filter((label) => !enabledLabels.includes(label));
  const enabledFieldNames = enabledLabels
    .map((label) =>
      label === "요약"
        ? "summary"
        : label === "잘한점"
        ? "goodPoint"
        : label === "아쉬운점"
        ? "weakPoint"
        : "advice"
    )
    .join(", ");
  const disabledFieldNames = disabledLabels
    .map((label) => (label === "잘한점" ? "goodPoint" : label === "아쉬운점" ? "weakPoint" : null))
    .filter((label): label is "goodPoint" | "weakPoint" => label !== null)
    .join(", ");

  return [
    "너는 모바일 생산성 앱에 들어갈 짧은 한국어 문장을 교정하는 카피 에디터다.",
    `이번 편집 톤: ${coachVoice}`,
    "새 분석을 하지 않는다. 기준 초안의 숫자, 판단, 의도만 유지한다.",
    "",
    "작업 방식:",
    "- 초안이 충분히 자연스러우면 그대로 사용한다.",
    "- 어색한 표현만 최소한으로 바꾼다.",
    "- 숫자, 기간, 완료/미완료 의미를 바꾸지 않는다.",
    "- 초안에 없는 원인, 감정, 기술명, 장기 해석을 추가하지 않는다.",
    "- 더 자연스럽게 고칠 자신이 없으면 초안을 그대로 쓴다.",
    "",
    "출력:",
    "- JSON 객체만 반환한다.",
    `- 작성할 필드: ${enabledFieldNames}`,
    disabledFieldNames
      ? `- 작성하지 않는 필드는 null로 둔다: ${disabledFieldNames}`
      : "- 모든 필드에 문장을 작성한다.",
    "- 각 값은 한 문장만 작성한다.",
    "- 각 문장은 45자 이내를 목표로 한다.",
    "",
    "말투:",
    "- 부드러운 해요체를 사용한다.",
    "- 관찰 문장은 '~했어요', '~였어요', '~있었어요' 중심으로 끝낸다.",
    "- 조언 문장은 '~해보면 좋아요' 형태로 끝낸다.",
    "- 명령형, 훈계형, 보고서체, 번역투, 메타 표현을 쓰지 않는다.",
    "- '합시다', '해봅시다', '하세요', '하십시오', '할게요'를 쓰지 않는다.",
    "- '~흐름이에요', '~패턴이에요' 같은 명사형 종결을 쓰지 않는다.",
    "",
    "필드 기준:",
    hasMeaningfulGoodPoint(payload)
      ? "- summary와 goodPoint는 초안의 숫자 근거를 유지한다."
      : "- goodPoint는 null로 둔다.",
    hasMeaningfulGoodPoint(payload)
      ? "- goodPoint는 사용자가 한 행동이나 얻은 단서만 다룬다."
      : "- 완료와 집중이 모두 0이면 억지 칭찬을 만들지 않는다.",
    hasMeaningfulWeakPoint(payload)
      ? "- weakPoint는 초안에 있는 미완료나 재개 마찰만 구체적으로 다룬다."
      : "- weakPoint는 null로 둔다.",
    "- advice는 바로 적용 가능한 조정 하나만 말한다.",
    "",
    "표현 기준:",
    "- '할일' 대신 '할 일'로 띄어 쓴다.",
    "- '완료 32개를 남겨'는 쓰지 않고 '32개를 완료해'처럼 쓴다.",
    "- '미완료가 12일에 발생'처럼 날짜로 읽히는 표현은 쓰지 않는다.",
    "- '365일 중 19일 동안'처럼 중/동안을 겹쳐 쓰지 않는다.",
    "- 미완료 날짜 수는 '기록된 날이 12일'처럼 쓴다.",
    "- weakPoint에서 '아쉬움'이라는 감정 표현을 반복하지 않는다.",
    "- 작업명은 반복 횟수 이상의 원인으로 해석하지 않는다.",
    "- 어색한 합성어보다 일상적인 표현을 쓴다.",
    "",
    "금지 표현:",
    "- 작업 완결",
    "- 시간을 투자",
    "- 주요 작업",
    "- 반복되어",
    "- 확인했어요",
    "- 작게라도",
    "- 누적됐어요",
    "- N일에 발생",
    "- 아쉬움이 있었어요",
    "",
    "기준 초안:",
    ...draftFormat,
    "",
    "참고 데이터(읽기 전용, 새 분석 금지):",
    `기간: ${payload.period.start} ~ ${payload.period.end} (${payload.period.days}일, preset=${payload.period.preset})`,
    `활동 기록일: ${payload.meta.activeDays}일 (coverage ${payload.meta.dataCoverageRate.toFixed(1)}%)`,
    `활동 기록 범위: ${payload.meta.firstActiveDate ?? "없음"} ~ ${payload.meta.lastActiveDate ?? "없음"}`,
    `할 일 기록일: ${payload.meta.daysWithTodos}일 / 집중 기록일: ${payload.meta.daysWithFocus}일 / 미완료가 기록된 날짜 수: ${payload.meta.daysWithIncomplete}일`,
    `완료: ${payload.totals.doneCount}개`,
    `미완료: ${payload.totals.incompleteCount}개`,
    `완료율: ${payload.rates.completionRate.toFixed(1)}%`,
    `미완료율: ${payload.rates.incompleteRate.toFixed(1)}%`,
    `집중: ${payload.totals.focusMinutes}분`,
    `재개: ${payload.totals.resumeCount}회`,
    `할 일당 재개: ${resumePerTodo.toFixed(2)}회`,
    `휴식: ${payload.totals.restMinutes}분`,
    `활동일 평균 완료: ${payload.meta.avgDonePerActiveDay.toFixed(2)}개`,
    `활동일 평균 미완료: ${payload.meta.avgIncompletePerActiveDay.toFixed(2)}개`,
    `자주 미완료된 작업: ${frequentIncompleteTaskLine}`,
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
      temperature: 0.25,
      max_output_tokens: 360,
      text: {
        format: COMMENTARY_RESPONSE_FORMAT,
      },
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

  const text = (result.output_text ?? fallbackText ?? "").trim();
  if (!text) {
    const error = new Error("Empty commentary from OpenAI");
    (error as Error & { code?: ServiceErrorCode }).code = "OPENAI_EMPTY_RESPONSE";
    throw error;
  }
  const structured = parseStructuredCommentary(text);
  return structured ? finalizeStructuredCommentary(structured, payload) : finalizeCommentary(text, payload);
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
      const route = request.url.split("?")[0] ?? request.url;
      if (code === "OPENAI_KEY_MISSING") {
        captureServerError(error, {
          requestId: request.id,
          method: request.method,
          route,
          userId: null,
          statusCode: 503,
          errorCode: resolveErrorCode(error),
          requestInput: parsed.data,
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
          requestInput: parsed.data,
        });
        return reply.code(502).send({
          message: "통계 코멘트 생성 요청에 실패했어요.",
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
          requestInput: parsed.data,
        });
        return reply.code(502).send({
          message: "통계 코멘트 응답이 비어 있어요.",
        });
      }
      captureServerError(error, {
        requestId: request.id,
        method: request.method,
        route,
        userId: null,
        statusCode: 500,
        errorCode: resolveErrorCode(error),
        requestInput: parsed.data,
      });
      return reply.code(500).send({
        message: "통계 코멘트 생성 중 오류가 발생했어요.",
      });
    }
  });
}
