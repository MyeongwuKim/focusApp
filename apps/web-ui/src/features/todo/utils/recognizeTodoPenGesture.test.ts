import { describe, expect, it } from "vitest";
import { areOpposingTodoDiagonals, recognizeTodoPenStroke } from "./recognizeTodoPenGesture";

describe("recognizeTodoPenStroke", () => {
  it("긴 가로선을 삭제용 취소선으로 인식한다", () => {
    expect(
      recognizeTodoPenStroke(
        [
          { x: 45, y: 32 },
          { x: 95, y: 34 },
          { x: 155, y: 33 },
          { x: 215, y: 35 },
        ],
        280
      )
    ).toBe("strike");
  });

  it("삭제 가이드 길이에 못 미치는 짧은 가로선은 취소선으로 인식하지 않는다", () => {
    expect(
      recognizeTodoPenStroke(
        [
          { x: 5, y: 18 },
          { x: 13, y: 19 },
          { x: 21, y: 18 },
          { x: 29, y: 19 },
        ],
        55
      )
    ).toBe(null);
  });

  it("오른쪽 여백을 벗어나도 항목 절반을 못 넘으면 취소선으로 인식하지 않는다", () => {
    expect(
      recognizeTodoPenStroke(
        [
          { x: 4, y: 18 },
          { x: 18, y: 19 },
          { x: 34, y: 18 },
          { x: 50, y: 19 },
        ],
        280
      )
    ).toBe(null);
  });

  it("오른쪽 여백에서 시작해 항목 절반 이상 가로로 그으면 취소선으로 인식한다", () => {
    expect(
      recognizeTodoPenStroke(
        [
          { x: 50, y: 18 },
          { x: 0, y: 19 },
          { x: -55, y: 18 },
          { x: -110, y: 19 },
        ],
        280
      )
    ).toBe("strike");
  });

  it("V 모양 궤적을 체크로 인식한다", () => {
    expect(
      recognizeTodoPenStroke(
        [
          { x: 18, y: 22 },
          { x: 27, y: 34 },
          { x: 35, y: 43 },
          { x: 48, y: 28 },
          { x: 61, y: 14 },
        ],
        280
      )
    ).toBe("check");
  });

  it("좌우로 반복해서 끄적인 궤적을 삭제로 인식한다", () => {
    expect(
      recognizeTodoPenStroke(
        [
          { x: 70, y: 22 },
          { x: 155, y: 36 },
          { x: 82, y: 45 },
          { x: 170, y: 55 },
          { x: 75, y: 62 },
        ],
        280
      )
    ).toBe("delete");
  });
});

describe("areOpposingTodoDiagonals", () => {
  it("교차하는 두 대각선을 X로 인식한다", () => {
    expect(
      areOpposingTodoDiagonals(
        [
          { x: 70, y: 18 },
          { x: 155, y: 60 },
        ],
        [
          { x: 70, y: 60 },
          { x: 155, y: 18 },
        ]
      )
    ).toBe(true);
  });
});
