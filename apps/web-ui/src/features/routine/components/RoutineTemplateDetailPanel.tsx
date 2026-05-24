import type { ReactNode, RefObject } from "react";

type RoutineTemplateDetailPanelProps = {
  hasSelectedTemplate: boolean;
  itemCount: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

export function RoutineTemplateDetailPanel({
  hasSelectedTemplate,
  itemCount,
  scrollContainerRef,
  children,
}: RoutineTemplateDetailPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-base-300/80 bg-base-100/75 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-base-content">루틴 상세</p>
        <span className="rounded-md border border-base-300/80 bg-base-200/45 px-2 py-0.5 text-[11px] text-base-content/70">
          {hasSelectedTemplate ? `${itemCount}개` : "0개"}
        </span>
      </div>

      {hasSelectedTemplate ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          <div ref={scrollContainerRef} className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
            {children}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-base-300/70 bg-base-200/35 p-3 text-sm text-base-content/60">
          템플릿을 선택하세요.
        </div>
      )}
    </section>
  );
}
