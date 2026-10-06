export type TodoPenPoint = {
  x: number;
  y: number;
};

export type TodoPenGesture = "check" | "strike" | "delete" | "diagonal" | null;

/** 가로 취소선이 삭제로 인정되기 위해 제스처 영역에서 지나야 하는 최소 너비 비율이다. */
export const TODO_DELETE_STRIKE_MIN_WIDTH_RATIO = 0.55;
/** 손가락·마우스가 오른쪽 여백을 벗어나 충분히 이동하도록 요구하는 최소 가로 거리다. */
export const TODO_DELETE_STRIKE_MIN_DISTANCE_PX = 88;

function getBounds(points: TodoPenPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function getPathLength(points: TodoPenPoint[]) {
  return points.slice(1).reduce((length, point, index) => {
    const previous = points[index];
    return length + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function countHorizontalDirectionChanges(points: TodoPenPoint[]) {
  let previousDirection = 0;
  let changes = 0;

  for (let index = 1; index < points.length; index += 1) {
    const deltaX = points[index].x - points[index - 1].x;
    if (Math.abs(deltaX) < 3) {
      continue;
    }
    const direction = Math.sign(deltaX);
    if (previousDirection !== 0 && direction !== previousDirection) {
      changes += 1;
    }
    previousDirection = direction;
  }
  return changes;
}

/**
 * 한 번에 그린 궤적을 체크·가로선·삭제·대각선 후보로 분류한다.
 * V 모양은 체크, 할 일 항목 너비의 55%와 88px 중 더 긴 기준을 지난 가로선은 취소선,
 * 좌우 방향이 여러 번 바뀌는 끄적임은 삭제로 판정한다.
 */
export function recognizeTodoPenStroke(points: TodoPenPoint[], cardWidth: number): TodoPenGesture {
  if (points.length < 3 || cardWidth <= 0) {
    return null;
  }

  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const pathLength = getPathLength(points);
  const first = points[0];
  const last = points[points.length - 1];

  const horizontalDirectionChanges = countHorizontalDirectionChanges(points);
  const isScribble =
    width >= Math.min(cardWidth * 0.24, 72) &&
    height >= 12 &&
    horizontalDirectionChanges >= 3 &&
    pathLength >= width * 2.15;
  if (isScribble) {
    return "delete";
  }

  const isHorizontalStrike =
    width >= Math.max(cardWidth * TODO_DELETE_STRIKE_MIN_WIDTH_RATIO, TODO_DELETE_STRIKE_MIN_DISTANCE_PX) &&
    height <= Math.max(18, width * 0.18) &&
    Math.abs(last.x - first.x) >= width * 0.72;
  if (isHorizontalStrike) {
    return "strike";
  }

  const valleyIndex = points.reduce(
    (maxIndex, point, index) => (point.y > points[maxIndex].y ? index : maxIndex),
    0
  );
  const valley = points[valleyIndex];
  const isCheck =
    width >= 16 &&
    height >= 10 &&
    valleyIndex >= 1 &&
    valleyIndex <= points.length - 2 &&
    first.x < valley.x &&
    last.x > valley.x &&
    first.y <= valley.y - 4 &&
    last.y <= valley.y - 6;
  if (isCheck) {
    return "check";
  }

  const deltaX = last.x - first.x;
  const deltaY = last.y - first.y;
  const isDiagonal = width >= 26 && height >= 18 && Math.abs(deltaX) >= 20 && Math.abs(deltaY) >= 14;
  return isDiagonal ? "diagonal" : null;
}

/** 서로 반대 방향의 두 대각선이 같은 영역을 가로지르면 X 삭제 제스처로 판정한다. */
export function areOpposingTodoDiagonals(first: TodoPenPoint[], second: TodoPenPoint[]) {
  if (first.length < 2 || second.length < 2) {
    return false;
  }

  const firstStart = first[0];
  const firstEnd = first[first.length - 1];
  const secondStart = second[0];
  const secondEnd = second[second.length - 1];
  const firstSlopeSign = Math.sign((firstEnd.y - firstStart.y) * (firstEnd.x - firstStart.x));
  const secondSlopeSign = Math.sign((secondEnd.y - secondStart.y) * (secondEnd.x - secondStart.x));
  if (firstSlopeSign === 0 || secondSlopeSign === 0 || firstSlopeSign === secondSlopeSign) {
    return false;
  }

  const firstBounds = getBounds(first);
  const secondBounds = getBounds(second);
  const overlapX = Math.min(firstBounds.maxX, secondBounds.maxX) - Math.max(firstBounds.minX, secondBounds.minX);
  const overlapY = Math.min(firstBounds.maxY, secondBounds.maxY) - Math.max(firstBounds.minY, secondBounds.minY);
  return overlapX >= 10 && overlapY >= 8;
}
