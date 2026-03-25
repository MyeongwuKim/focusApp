const BASE_WIDTH = 390;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateUiScale(viewportWidth: number): number {
  const rawScale = viewportWidth / BASE_WIDTH;
  return clamp(rawScale, MIN_SCALE, MAX_SCALE);
}
