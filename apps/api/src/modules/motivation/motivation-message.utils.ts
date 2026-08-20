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
  "먼저 할 일 하나만 정해봐요, 오늘 계획은 거기서 시작하면 돼요.",
  "지금 생각나는 일 하나만 적어봐요, 나머지는 그다음에 정해도 돼요.",
  "가장 중요한 일 하나만 먼저 골라볼까요, 계획은 천천히 채워도 돼요.",
  "할 일이 아직 없다면 놓치면 안 될 것 하나부터 적어봐요.",
] as const;

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
  const hash = [...dateKey].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return EMPTY_PLAN_FALLBACK_MESSAGES[hash % EMPTY_PLAN_FALLBACK_MESSAGES.length];
}
