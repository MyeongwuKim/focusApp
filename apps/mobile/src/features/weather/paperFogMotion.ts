import { PAPER_FOG_HEIGHT_RATIO } from './paperWeatherArtwork';

/** 안개 그림이 화면 밖에서 진입·퇴장하게 하는 여유 거리(화면 포인트). */
export const PAPER_FOG_TRAVEL_MARGIN = 48;

/** 안개가 화면 밖에서 다시 들어올 때 baseRatio 주변의 새 높이를 정한다. 같은 seed·pass는 같은 높이를 반환한다. */
export function getPaperFogYRatio(baseRatio: number, pass: number, seed: number) {
  const noise = Math.sin(seed * 12.9898 + pass * 17.71) * 43758.5453;
  const variation = (noise - Math.floor(noise) - 0.5) * 0.14;
  return Math.min(0.97, Math.max(0.04, baseRatio + variation));
}

/**
 * elapsedSeconds와 화면 크기로 안개의 왼쪽→오른쪽 위치를 계산한다. speed는 초당 화면 포인트다.
 * 그림이 모두 화면 밖에 나간 뒤 시작점으로 돌아가며, 다음 통과에서는 높이를 바꾼다.
 * 재진입 경계에서 투명도를 줄인다. 호출자가 반환한 x·y·opacity를 실제 도형에 적용한다.
 */
export function getPaperFogFrame({
  elapsedSeconds,
  width,
  viewportWidth,
  viewportHeight,
  initialPhase,
  speed,
  yRatio,
  seed,
  alpha,
}: {
  elapsedSeconds: number;
  width: number;
  viewportWidth: number;
  viewportHeight: number;
  /** 첫 통과의 시작 위치(0~1). 서로 다른 띠가 동시에 진입하지 않도록 한다. */
  initialPhase: number;
  speed: number;
  yRatio: number;
  seed: number;
  alpha: number;
}) {
  const margin = PAPER_FOG_TRAVEL_MARGIN;
  const distance = viewportWidth + width + margin * 2;
  const phase = elapsedSeconds * speed / distance + initialPhase;
  const pass = Math.floor(phase);
  const progress = phase - pass;
  const edgeFade = Math.min(1, progress / 0.06, (1 - progress) / 0.06);

  return {
    x: -width - margin + progress * distance,
    y: viewportHeight * getPaperFogYRatio(yRatio, pass, seed) - width * PAPER_FOG_HEIGHT_RATIO * 0.5 +
      Math.sin(elapsedSeconds * 0.16 + seed) * 4,
    opacity: alpha * edgeFade,
  };
}
