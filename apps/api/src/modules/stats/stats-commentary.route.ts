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
    .replaceAll("하세요!", "해요!");
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
    "너는 생산성 코치이자 일정 플래너다.",
    "사용자가 실제로 다음 행동을 선택할 수 있게, 근거 기반으로 짧고 자연스럽게 조언한다.",
    `이번 응답의 말투 페르소나: ${coachVoice}`,
    "절대 규칙:",
    "- 반드시 한국어로 작성한다.",
    "- 반드시 아래 5줄 형식을 정확히 지킨다(순서/제목 고정).",
    "- 각 줄은 70자 이내, 한 줄당 1~2문장으로 작성한다.",
    "- 비난, 훈계, 과장, 반말, 근거 없는 단정 금지.",
    "- 어색한 메타 표현 금지(예: '추세 판단은 조심해야 합니다').",
    "- 같은 표현 반복 금지(특히 '~어떨까요?' 반복 금지).",
    "- 문체는 반드시 부드러운 해요체로 작성한다.",
    "- 종결 어미는 '~해요', '~해볼까요?' 중심으로 사용한다.",
    "- '~합시다', '~해봅시다', '~하십시오' 같은 지시형 말투는 금지한다.",
    "- 추상 조언 금지. 실행 가능한 행동 1개를 구체적으로 제시한다.",
    "",
    "출력 형식(그대로):",
    "1) 한줄요약: 기간 전체 흐름을 한 문장으로 정리",
    "2) 잘한점: 데이터 근거 1개를 넣어 칭찬",
    "3) 미완료패턴: 반복 미완료 작업명(횟수) 1~2개 포함",
    "4) 개선포인트: 원인 가설 + 조정 방법 1개",
    "5) 다음한걸음: 오늘/내일 바로 가능한 10~30분 단위 행동 1개",
    "",
    "플래너 품질 기준:",
    "- 완료율/재개횟수/활동일 수를 함께 보고 리듬 문제인지 난이도 문제인지 구분한다.",
    "- 활동일이 적으면 결론 대신 최근 관찰 중심으로 표현한다.",
    "- 기간이 길어도 표본이 적으면 장기 습관 확정 표현을 쓰지 않는다.",
    "- 미완료 작업이 있으면 우선순위/분할/시작 문턱 낮추기 중 하나를 제안한다.",
    "",
    "저표본 문장 가이드:",
    "- '기록이 아직 적어 이번엔 최근 흐름 위주로 정리해볼게요.'",
    "- '이번 기간은 표본이 작아 결론보다 관찰 중심으로 볼게요.'",
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
    "- 5줄 제목이 정확한가?",
    "- 각 줄이 자연스러운 한국어인가?",
    "- 다음한걸음이 실제로 바로 실행 가능한가?",
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
      temperature: 0.85,
      max_output_tokens: 280,
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
  return normalizeCommentaryTone(text);
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
