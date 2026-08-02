import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CalendarDateCell, type CalendarPreviewBar } from "./CalendarDateCell";

afterEach(() => {
  cleanup();
});

const previewBars: CalendarPreviewBar[] = [
  { id: "todo-1", label: "첫 번째 할 일" },
  { id: "todo-2", label: "두 번째 할 일" },
  { id: "todo-3", label: "세 번째 할 일" },
  { id: "todo-4", label: "네 번째 할 일" },
  { id: "todo-5", label: "다섯 번째 할 일" },
  { id: "todo-6", label: "여섯 번째 할 일" },
  { id: "todo-7", label: "일곱 번째 할 일" },
];

function renderCell(isSelected: boolean, options?: { isRowExpanded?: boolean; holidayName?: string }) {
  return render(
    <CalendarDateCell
      dateKey="2026-08-01"
      date={new Date(2026, 7, 1)}
      inCurrentMonth
      isToday={false}
      isSelected={isSelected}
      isRowExpanded={options?.isRowExpanded}
      holidayName={options?.holidayName}
      previewBars={previewBars}
      isAllDone={false}
      hasMemo={false}
      onClick={() => undefined}
    />
  );
}

describe("CalendarDateCell", () => {
  it("접힌 셀은 두 항목과 더보기 항목을 표시한다", () => {
    renderCell(false, { isRowExpanded: false });

    expect(screen.getByText("첫 번째 할 일")).toBeInTheDocument();
    expect(screen.getByText("두 번째 할 일")).toBeInTheDocument();
    expect(screen.queryByText("세 번째 할 일")).not.toBeInTheDocument();
    expect(screen.queryByText("네 번째 할 일")).not.toBeInTheDocument();
    expect(screen.getByLabelText("할 일 5개 더 있음")).toHaveTextContent("+5");
  });

  it("펼쳐진 행은 세 항목과 더보기 항목을 표시한다", () => {
    renderCell(true, { isRowExpanded: true });

    expect(screen.getByText("첫 번째 할 일")).toBeInTheDocument();
    expect(screen.getByText("두 번째 할 일")).toBeInTheDocument();
    expect(screen.getByText("세 번째 할 일")).toBeInTheDocument();
    expect(screen.queryByText("네 번째 할 일")).not.toBeInTheDocument();
    expect(screen.getByLabelText("할 일 4개 더 있음")).toHaveTextContent("+4");
  });

  it("공휴일이 있는 접힌 셀은 한 항목과 더보기 항목을 표시한다", () => {
    renderCell(false, { isRowExpanded: false, holidayName: "광복절" });

    expect(screen.getByText("첫 번째 할 일")).toBeInTheDocument();
    expect(screen.queryByText("두 번째 할 일")).not.toBeInTheDocument();
    expect(screen.getByLabelText("할 일 6개 더 있음")).toHaveTextContent("+6");
  });
});
