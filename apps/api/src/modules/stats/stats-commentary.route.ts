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

function pickCoachVoice(payload: StatsCommentaryRequest) {
  const daySeed = Number(payload.period.end.replaceAll("-", "")) || payload.period.days;
  const variants = ["담백한 코치", "전략형 플래너", "차분한 파트너"] as const;
  return variants[daySeed % variants.length];
}

function normalizeCommentaryTone(text: string) {
  return text
    .replaceAll("해봅시다", "해볼까요?")
    .replaceAll("해보시죠", "해볼까요?")
    .replaceAll("합시다", "해볼까요?")
    .replaceAll("하세요.", "해요.")
    .replaceAll("하세요!", "해요!")
    .replaceAll("흐름이에요.", "흐름이었어요.")
    .replaceAll("흐름이에요", "흐름이었어요")
    .replaceAll("살펴봐요.", "살펴봤어요.")
    .replaceAll("정리해요.", "정리했어요.")
    .replace(/(\d+)분간/g, "$1분 동안")
    .replaceAll("작업 중", "작업할 때");
}

const COMMENTARY_LABELS = ["요약", "잘한점", "아쉬운점", "플래너조언"] as const;
type CommentaryLabel = (typeof COMMENTARY_LABELS)[number];

function resolvePeriodLabel(period: StatsCommentaryRequest["period"]) {
  const preset = period.preset.toLowerCase();
  if (preset.includes("week")) {
    return "일주일";
  }
  if (preset.includes("month")) {
    return "한달";
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

  const summary =
    totalTodos === 0 && focusMinutes === 0
      ? `${activePhrase} 할일과 집중 기록은 거의 없었어요.`
      : totalTodos === 0
      ? `${activePhrase} 할일 완료는 0개였고 집중은 ${focusMinutes}분이었어요.`
      : `${activePhrase} 완료 ${doneCount}개, 미완료 ${incompleteCount}개로 완료율 ${completionRate}%였고 집중은 ${focusMinutes}분이었어요.`;

  const goodPoint =
    Number(payload.rates.completionRate) >= 70
      ? `완료율이 ${completionRate}%로 유지돼서 할일 마무리 흐름이 안정적이었어요.`
      : payload.meta.daysWithFocus > 0
      ? `집중 기록일이 ${payload.meta.daysWithFocus}일이라 최소한의 실행 리듬은 이어졌어요.`
      : `활동 기록일이 ${activeDays}일이라 기록 흐름이 끊기지 않았어요.`;

  const weakPoint =
    incompleteCount > 0
      ? `미완료가 ${incompleteCount}개라 완료 전에 멈춘 작업이 누적됐어요.`
      : resumePerTodo >= 1
      ? `할일당 재개가 ${resumePerTodo.toFixed(2)}회라 한 번에 끝내기 어려운 구간이 있었어요.`
      : `기록일 대비 완료량 편차가 있어 일정한 마무리 흐름은 조금 아쉬웠어요.`;

  const advice =
    incompleteCount > 0
      ? "미완료가 많은 항목부터 오늘 완료 기준을 한 줄로 정하고 같은 유형을 묶어서 처리해보면 좋아요."
      : "하루 시작할 때 가장 오래 걸리는 할일 1개를 먼저 고정해서 완료 흐름을 만들어보면 좋아요.";

  return {
    요약: summary,
    잘한점: goodPoint,
    아쉬운점: weakPoint,
    플래너조언: advice,
  };
}

function extractCommentarySections(text: string): Partial<Record<CommentaryLabel, string>> {
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

  for (const label of COMMENTARY_LABELS) {
    if (!sections[label] && unlabeledBodies.length > 0) {
      sections[label] = unlabeledBodies.shift();
    }
  }

  return sections;
}

function finalizeCommentary(text: string, payload: StatsCommentaryRequest) {
  const normalized = normalizeCommentaryTone(text);
  const parsed = extractCommentarySections(normalized);
  const fallback = buildDeterministicCommentary(payload);

  const shouldReject = (body: string, requireMetric: boolean) => {
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
    return body.length < 6;
  };

  const lines = COMMENTARY_LABELS.map((label) => {
    const candidate = parsed[label]?.trim();
    const requireMetric = label === "요약" || label === "잘한점";
    const body = candidate && !shouldReject(candidate, requireMetric) ? candidate : fallback[label];
    return `${label}: ${body}`;
  });

  if (lines.length !== COMMENTARY_LABELS.length) {
    return COMMENTARY_LABELS.map((label) => `${label}: ${fallback[label]}`).join("\n");
  }

  return lines.join("\n");
}

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
  const sparseData = payload.meta.activeDays <= 3 || payload.meta.dataCoverageRate < 12;
  const lowData = payload.meta.activeDays <= 7 || payload.meta.dataCoverageRate < 25;
  const totalTodos = payload.totals.doneCount + payload.totals.incompleteCount;
  const resumePerTodo = totalTodos > 0 ? payload.totals.resumeCount / totalTodos : 0;
  const primaryLens =
    payload.rates.completionRate >= 75 && resumePerTodo <= 0.5
      ? "execution"
      : payload.rates.incompleteRate >= 45
      ? "unfinished"
      : resumePerTodo >= 1.5
      ? "rhythm"
      : payload.meta.dataCoverageRate >= 60
      ? "consistency"
      : "sampling";
  const periodToneHint =
    periodMode === "daily"
      ? "오늘 기준 관찰만 말하고 장기 판단은 금지"
      : periodMode === "weekly"
      ? "이번 주 반복 패턴 1개와 다음 주 유지 포인트 1개 제안"
      : periodMode === "monthly"
      ? "이번 달 흐름의 변화와 유지/정비 포인트 제안"
      : "넓은 기간이더라도 실제 기록된 활동일 기준으로만 판단";
  const coachVoice = pickCoachVoice(payload);
  const sparseToneHint = sparseData
    ? "기록이 적으면 판단 경고를 딱딱하게 쓰지 말고, 부드러운 관찰 문장으로 짧게 안내"
    : lowData
    ? "표본이 충분하지 않다면 결론 단정 대신 최근 관찰 중심으로 정리"
    : "기록 근거를 바탕으로 간결하게 요약";

  return [
    "너는 실무형 생산성 코치다.",
    "입력 데이터만 근거로 자연스럽고 짧은 요약을 작성한다.",
    `이번 응답의 말투 페르소나: ${coachVoice}`,
    "절대 규칙:",
    "- 반드시 한국어로 작성한다.",
    "- 반드시 아래 4줄 형식을 정확히 지킨다(순서/제목 고정).",
    "- 각 줄은 1문장으로 작성하고 전체는 4문장으로 끝낸다.",
    "- 비난, 훈계, 과장, 반말, 근거 없는 단정 금지.",
    "- 어색한 메타 표현 금지(예: '추세 판단은 조심해야 합니다').",
    "- 같은 표현 반복 금지.",
    "- 문체는 반드시 부드러운 해요체로 작성한다.",
    "- 종결 어미는 '~했어요', '~였어요' 중심으로 사용한다.",
    "- '~합시다', '~해봅시다', '~하십시오', '~할게요' 같은 말투는 금지한다.",
    "- '~흐름이에요', '~패턴이에요' 같은 명사형 종결 문장은 금지한다.",
    "- 문장은 짧고 직관적으로 작성한다.",
    "",
    "출력 형식(그대로):",
    "요약: 기간 핵심을 한 문장으로 정리",
    "잘한점: 데이터 근거 1개를 넣어 정리",
    "아쉬운점: 부족했던 지점을 한 문장으로 정리",
    "플래너조언: 바로 적용 가능한 조정 1개 제안",
    "",
    "작성 기준:",
    "- 요약과 잘한점에는 숫자 근거를 포함한다.",
    "- 요약은 기간 단위를 명시하고 활동일/완료/미완료를 함께 정리한다.",
    "- 예시: '일주일 중 하루만 진행했고 완료 2개, 미완료 1개였어요.'",
    "- 완료율/재개횟수/활동일 수를 함께 보고 핵심만 정리한다.",
    "- 데이터가 적으면 장기 판단을 하지 않는다.",
    "- 어색한 합성어를 피하고 일상적인 표현으로 작성한다.",
    "",
    "금지 어휘/문장 예시:",
    "- 추세 판단은 조심해야 합니다",
    "- 꾸준히 잘하고 있습니다(근거 없음)",
    "- 항상/절대/반드시",
    "",
    `이번 요청의 기간모드: ${periodMode}`,
    `이번 요청의 초점 렌즈: ${primaryLens}`,
    `기간 톤 힌트: ${periodToneHint}`,
    `저표본 문장 톤 힌트: ${sparseToneHint}`,
    "",
    `기간: ${payload.period.start} ~ ${payload.period.end} (${payload.period.days}일, preset=${payload.period.preset})`,
    `활동 기록일: ${payload.meta.activeDays}일 (coverage ${payload.meta.dataCoverageRate.toFixed(1)}%)`,
    `활동 기록 범위: ${payload.meta.firstActiveDate ?? "없음"} ~ ${payload.meta.lastActiveDate ?? "없음"}`,
    `할일 기록일: ${payload.meta.daysWithTodos}일 / 집중 기록일: ${payload.meta.daysWithFocus}일 / 미완료 발생일: ${payload.meta.daysWithIncomplete}일`,
    `완료: ${payload.totals.doneCount}개`,
    `미완료: ${payload.totals.incompleteCount}개`,
    `완료율: ${payload.rates.completionRate.toFixed(1)}%`,
    `미완료율: ${payload.rates.incompleteRate.toFixed(1)}%`,
    `집중: ${payload.totals.focusMinutes}분`,
    `재개: ${payload.totals.resumeCount}회`,
    `할일당 재개: ${resumePerTodo.toFixed(2)}회`,
    `휴식: ${payload.totals.restMinutes}분`,
    `활동일 평균 완료: ${payload.meta.avgDonePerActiveDay.toFixed(2)}개`,
    `활동일 평균 미완료: ${payload.meta.avgIncompletePerActiveDay.toFixed(2)}개`,
    `자주 미완료된 작업: ${frequentIncompleteTaskLine}`,
    `저표본 여부: ${sparseData ? "매우 높음" : lowData ? "있음" : "낮음"}`,
    "작성 전 체크:",
    "- 4줄 제목이 정확한가?",
    "- 각 줄이 자연스럽고 짧은가?",
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
      temperature: 0.6,
      max_output_tokens: 240,
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
  return finalizeCommentary(text, payload);
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
