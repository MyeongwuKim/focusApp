import { useState } from "react";
import { FiHelpCircle } from "react-icons/fi";
import { FocusRhythmHelpModal } from "../../../components/page-help/FocusRhythmHelpModal";
import { Button } from "../../../components/ui/Button";
import { FocusRhythmTrendChart } from "./FocusRhythmTrendChart";
import type { FocusResumeDatum } from "./types";

type FocusResumeRelationCardProps = {
  scope: "all" | "task";
  taskLabel?: string | null;
  focusMinutes: number;
  resumeCount: number;
  averageResumesPerTask: number | null;
  averageFocusSegmentMinutes: number | null;
  useMonthlyBar: boolean;
  data: FocusResumeDatum[];
};

function formatMinutes(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${Math.round(value)}분`;
}

function compactTaskLabel(value: string | null | undefined) {
  const normalized = value?.trim() || "선택한 할 일";
  return normalized.length > 16 ? `${normalized.slice(0, 16)}...` : normalized;
}

function buildInsight(
  resumeCount: number,
  averageResumesPerTask: number | null,
  averageFocusSegmentMinutes: number | null
) {
  if (averageResumesPerTask === null || averageFocusSegmentMinutes === null) {
    return "집중 기록이 쌓이면 집중시간 대비 재개 빈도를 확인할 수 있어요.";
  }
  if (resumeCount === 0) {
    return `재개 없이 집중을 이어갔고, 한 집중 구간은 평균 ${formatMinutes(averageFocusSegmentMinutes)}이었어요.`;
  }
  return `작업 1회당 평균 ${averageResumesPerTask.toFixed(
    1
  )}회 다시 시작했어요. 한 집중 구간은 평균 ${formatMinutes(averageFocusSegmentMinutes)}이었어요.`;
}

export function FocusResumeRelationCard({
  scope,
  taskLabel,
  focusMinutes,
  resumeCount,
  averageResumesPerTask,
  averageFocusSegmentMinutes,
  useMonthlyBar,
  data,
}: FocusResumeRelationCardProps) {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  return (
    <>
      <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-base-content/85">
              {scope === "all" ? "전체 집중 리듬" : "이 할 일의 집중 리듬"}
            </h3>
            <p className="m-0 mt-0.5 text-[11px] text-base-content/55">
              {scope === "all"
                ? `선택 기간 집중 기록 ${data.length}개`
                : `‘${compactTaskLabel(taskLabel)}’ 집중 기록 ${data.length}개`}
              {" · "}집중 {focusMinutes}분 · 재개 {resumeCount}회
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            circle
            className="-mr-1 -mt-1 shrink-0 text-base-content/55"
            aria-label="집중 리듬 설명 보기"
            title="집중 리듬 설명"
            onClick={() => setIsHelpModalOpen(true)}
          >
            <FiHelpCircle size={16} />
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2">
            <p className="m-0 text-xs text-primary/80">작업당 평균 재개</p>
            <p className="m-0 mt-0.5 text-lg font-semibold text-primary">
              {averageResumesPerTask === null ? "-" : `${averageResumesPerTask.toFixed(1)}회`}
            </p>
          </div>
          <div className="rounded-lg border border-success/25 bg-success/10 px-3 py-2">
            <p className="m-0 text-xs text-success/80">평균 집중 구간</p>
            <p className="m-0 mt-0.5 text-lg font-semibold text-success">
              {formatMinutes(averageFocusSegmentMinutes)}
            </p>
          </div>
        </div>

        <p className="m-0 mt-2 text-xs leading-5 text-base-content/70">
          {buildInsight(resumeCount, averageResumesPerTask, averageFocusSegmentMinutes)}
        </p>

        <FocusRhythmTrendChart
          data={data}
          granularity={useMonthlyBar ? "month" : "day"}
        />

        <p className="m-0 mt-2 text-[11px] leading-4 text-base-content/55">
          날짜별 기록은 선택 기간 안에서 서로 비교해 보세요. 집중시간과 재개 횟수만으로
          집중이 좋거나 나빴다고 판단하지 않아요.
        </p>
      </article>
      <FocusRhythmHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </>
  );
}
