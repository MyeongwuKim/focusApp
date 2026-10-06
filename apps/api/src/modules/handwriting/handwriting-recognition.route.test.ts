import { describe, expect, it } from "vitest";
import {
  normalizeRecognizedTodoText,
  parseHandwritingImageDataUrl,
} from "./handwriting-recognition.route.js";

describe("handwriting recognition input", () => {
  it("지원하는 캔버스 이미지 data URL을 허용한다", () => {
    const imageDataUrl = "data:image/png;base64,aGVsbG8=";
    expect(parseHandwritingImageDataUrl(imageDataUrl)).toBe(imageDataUrl);
  });

  it("이미지가 아닌 data URL을 거부한다", () => {
    expect(() => parseHandwritingImageDataUrl("data:text/plain;base64,aGVsbG8=")).toThrow(
      "지원하지 않는 손글씨 이미지예요."
    );
  });
});

describe("handwriting recognition output", () => {
  it("응답 장식을 제거하고 한 줄 제목으로 정리한다", () => {
    expect(normalizeRecognizedTodoText('```text\n할 일: "운동 30분"\n```')).toBe("운동 30분");
  });

  it("글씨를 읽을 수 없다는 응답은 제목으로 사용하지 않는다", () => {
    expect(normalizeRecognizedTodoText("NO_TEXT")).toBeNull();
    expect(normalizeRecognizedTodoText("읽을 수 없음")).toBeNull();
  });
});
