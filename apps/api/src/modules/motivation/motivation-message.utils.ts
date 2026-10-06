const REST_SUGGESTION_PATTERNS = [
  /쉬어/,
  /쉬는\s*(?:날|시간)/,
  /쉬고\s*(?:가|싶)/,
  /휴식/,
  /푹\s*쉬/,
  /아무것도\s*(?:안|하지)/,
];

const INFORMAL_SPEECH_PATTERNS = [
  /(?:하자|해보자|가자|보자|괜찮아|좋아|힘내|시작해|이어가|열어봐|골라봐)(?:[,.!?]|$)/,
];

const FORMAL_OR_STIFF_SPEECH_PATTERNS = [
  /(?:습니다|십시오|하세요|해보세요|시작하세요|진행하세요)(?:[,.!?]|$)/,
];

export const EMPTY_PLAN_FALLBACK_MESSAGES = [
  "오늘은 지금부터 시작이에요, 하나씩 해나가면 돼요.",
  "일단 하나만 시작해도 오늘은 충분히 달라질 수 있어요.",
  "거창한 계획보다 지금 시작하는 하나가 더 중요해요.",
  "서두르지 말고 지금 할 수 있는 것부터 하나씩 보면 돼요.",
] as const;

export const NOT_STARTED_FALLBACK_MESSAGES = [
  "할 일은 정해졌어요, 이제 가장 가까운 것부터 시작하면 돼요.",
  "처음부터 다 보지 말고 지금 할 일 하나에만 집중해봐요.",
  "가장 가까운 일부터 시작하면 오늘이 한결 단순해져요.",
  "지금 손댈 수 있는 일 하나부터 차분히 시작하면 돼요.",
] as const;

export const IN_PROGRESS_FALLBACK_MESSAGES = [
  "이미 시작했어요, 지금 하던 일부터 차분히 마무리하면 돼요.",
  "지금 하던 일에만 집중해봐요, 다음 일은 끝난 뒤에 보면 돼요.",
  "하던 일을 이어가고 있어요, 우선 이 일부터 마무리하면 돼요.",
  "지금 집중하는 일부터 끝내고 다음을 보면 돼요.",
] as const;

export const PARTIAL_DONE_FALLBACK_MESSAGES = [
  "이미 하나 끝냈네요, 남은 일도 가까운 순서대로 이어가면 돼요.",
  "끝낸 일이 생겼어요, 다음은 가장 가까운 일부터 보면 돼요.",
  "할 일이 하나씩 정리되고 있어요, 남은 일도 이어가면 돼요.",
  "여기까지 잘 정리했어요, 다음 할 일도 하나씩 보면 돼요.",
] as const;

export const ALL_DONE_FALLBACK_MESSAGES = [
  "오늘 할 일은 모두 마쳤어요, 깔끔하게 마무리됐네요.",
  "정해둔 일은 전부 끝났어요, 오늘 계획을 잘 마쳤네요.",
  "오늘 계획한 일은 모두 끝났어요, 차분하게 마무리했네요.",
  "남은 할 일 없이 오늘 계획을 모두 마쳤어요.",
] as const;

export type MotivationMessageState =
  | "EMPTY"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PARTIAL_DONE"
  | "ALL_DONE";

const FALLBACK_MESSAGES_BY_STATE = {
  EMPTY: EMPTY_PLAN_FALLBACK_MESSAGES,
  NOT_STARTED: NOT_STARTED_FALLBACK_MESSAGES,
  IN_PROGRESS: IN_PROGRESS_FALLBACK_MESSAGES,
  PARTIAL_DONE: PARTIAL_DONE_FALLBACK_MESSAGES,
  ALL_DONE: ALL_DONE_FALLBACK_MESSAGES,
} as const satisfies Record<MotivationMessageState, readonly string[]>;

export function hasRestSuggestion(text: string) {
  return REST_SUGGESTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasConsistentHaeyoSpeechLevel(text: string) {
  const normalized = text.trim();
  if (!/요[.!?]?$/.test(normalized)) {
    return false;
  }

  return ![...INFORMAL_SPEECH_PATTERNS, ...FORMAL_OR_STIFF_SPEECH_PATTERNS].some((pattern) =>
    pattern.test(normalized)
  );
}

export function pickEmptyPlanFallback(dateKey: string) {
  return pickMotivationFallback("EMPTY", dateKey);
}

/**
 * 오늘의 할 일 개수와 진행 상태를 시작 메시지에서 사용하는 다섯 가지 상태로 분류한다.
 * 진행 중인 항목이 있으면 일부 완료 여부보다 IN_PROGRESS를 우선하며, 할 일이 모두 끝났을 때만 ALL_DONE을 반환한다.
 */
export function resolveMotivationMessageState(input: {
  todoCount: number;
  doneCount: number;
  openCount: number;
  hasInProgressTodo: boolean;
}): MotivationMessageState {
  if (input.todoCount === 0) {
    return "EMPTY";
  }
  if (input.openCount === 0) {
    return "ALL_DONE";
  }
  if (input.hasInProgressTodo) {
    return "IN_PROGRESS";
  }
  if (input.doneCount > 0) {
    return "PARTIAL_DONE";
  }
  return "NOT_STARTED";
}

/** 날짜와 상태가 같으면 같은 문구를 골라 앱을 다시 열 때 문장이 불필요하게 바뀌지 않도록 한다. */
export function pickMotivationFallback(state: MotivationMessageState, dateKey: string) {
  const messages = FALLBACK_MESSAGES_BY_STATE[state];
  const hashSource = `${state}:${dateKey}`;
  const hash = [...hashSource].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return messages[hash % messages.length];
}
