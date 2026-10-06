const PAGE_TURN_DISTANCE_THRESHOLD = 56;
const PAGE_TURN_FLICK_DISTANCE_THRESHOLD = 20;
const PAGE_TURN_VELOCITY_THRESHOLD = 0.48;
const PAGE_TURN_MIN_DURATION_MS = 300;
const PAGE_TURN_MAX_DURATION_MS = 480;

/**
 * 드래그 거리가 충분하거나 짧은 이동이라도 같은 방향으로 빠르게 놓았을 때 페이지 넘김을 확정한다.
 * 작은 터치 흔들림은 빠른 동작이어도 넘김으로 처리하지 않는다.
 */
export function shouldCompletePageTurn(deltaX: number, velocityX: number) {
  const distance = Math.abs(deltaX);
  if (distance >= PAGE_TURN_DISTANCE_THRESHOLD) {
    return true;
  }

  return (
    distance >= PAGE_TURN_FLICK_DISTANCE_THRESHOLD &&
    Math.abs(velocityX) >= PAGE_TURN_VELOCITY_THRESHOLD &&
    Math.sign(deltaX) === Math.sign(velocityX)
  );
}

/**
 * 손을 빠르게 놓을수록 남은 전환 시간을 줄여 손가락 움직임이 종이에 이어지는 느낌을 만든다.
 * 반환값은 CSS 전환과 누락 방지 타이머에 함께 사용하는 밀리초 단위 시간이다.
 */
export function resolvePageTurnDurationMs(velocityX: number) {
  const speed = Math.min(Math.abs(velocityX), 1.4);
  const duration = PAGE_TURN_MAX_DURATION_MS - speed * 120;
  return Math.round(Math.max(PAGE_TURN_MIN_DURATION_MS, duration));
}
