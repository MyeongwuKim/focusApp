const EMPTY_PLAN_REST_PATTERNS = [
  /쉬어/,
  /쉬는\s*(?:날|시간)/,
  /쉬고\s*(?:가|싶)/,
  /휴식/,
  /푹\s*쉬/,
  /아무것도\s*(?:안|하지)/,
];

export const EMPTY_PLAN_FALLBACK_MESSAGES = [
  "오늘 계획이 비어 있다면 꼭 필요한 일 하나만 먼저 골라봐요.",
  "지금 떠오르는 일 하나만 적어두면 오늘 흐름이 선명해져요.",
  "일정을 가볍게 훑고 가장 가까운 일 하나만 적어봐요.",
  "아직 계획 전이라면 놓치면 안 될 일부터 하나 골라봐요.",
] as const;

export function hasEmptyPlanRestSuggestion(text: string) {
  return EMPTY_PLAN_REST_PATTERNS.some((pattern) => pattern.test(text));
}

export function pickEmptyPlanFallback(dateKey: string) {
  const hash = [...dateKey].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return EMPTY_PLAN_FALLBACK_MESSAGES[hash % EMPTY_PLAN_FALLBACK_MESSAGES.length];
}
