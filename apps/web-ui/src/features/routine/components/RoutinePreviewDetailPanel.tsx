import type { RefObject } from "react";
import { type RoutineTemplate } from "../../../api/routineTemplateApi";

type RoutinePreviewDetailPanelProps = {
  previewTemplate: RoutineTemplate | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
};

export function RoutinePreviewDetailPanel({ previewTemplate, scrollContainerRef }: RoutinePreviewDetailPanelProps) {
  return (
    <section className="flex h-[13rem] min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-base-300/80 bg-base-100/75 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-base-content">루틴 상세</p>
        <span className="rounded-md border border-base-300/80 bg-base-200/45 px-2 py-0.5 text-[11px] text-base-content/70">
          {previewTemplate ? `${previewTemplate.items.length}개` : "0개"}
        </span>
      </div>

      {previewTemplate ? (
        <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-base-300/70 bg-base-200/35 p-2.5">
          <div ref={scrollContainerRef} className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
            {previewTemplate.items
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <div key={`preview-item-${item.id}`} className="rounded-md border border-base-300/60 bg-base-100 px-2 py-1.5">
                  <p className="m-0 truncate text-xs font-medium text-base-content/85">{item.content}</p>
                  <p className="m-0 mt-0.5 text-[11px] text-base-content/55">
                    {item.scheduledTimeHHmm ? `시작 ${item.scheduledTimeHHmm}` : "시작시간 미설정"}
                  </p>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-lg border border-dashed border-base-300/80 bg-base-200/35 px-3 text-center text-xs text-base-content/60">
          루틴을 선택하면 할 일 목록이 보여요.
        </div>
      )}
    </section>
  );
}
