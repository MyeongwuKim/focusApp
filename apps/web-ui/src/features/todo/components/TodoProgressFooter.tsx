import { useEffect, useMemo, useState } from "react";
import { FiCoffee, FiPause, FiPlay } from "react-icons/fi";
import { RestDurationBottomSheet } from "./RestDurationBottomSheet";

type TodoProgressFooterProps = {
  summary: {
    completedCount: number;
    totalCount: number;
    totalMinutes: number;
    progressPercent: number;
  };
  session: {
    focusMinutes: number;
    restMinutes: number;
    active: "focus" | "rest" | null;
    restDurationPreviewMin: number | null;
    restDurationDefaultMin: number | null;
  };
  onToggleFocus: () => void;
  onToggleRest: () => void;
  onApplyRestDurationOnce: (nextDurationMin: number | null) => void;
  onSaveRestDurationDefault: (nextDurationMin: number | null) => void;
  openRestSettingsRequestId: number;
};

function formatRestDurationLabel(durationMin: number | null) {
  if (durationMin === null) {
    return "무제한";
  }
  return `${durationMin}분`;
}

export function TodoProgressFooter({
  summary,
  session,
  onToggleFocus,
  onToggleRest,
  onApplyRestDurationOnce,
  onSaveRestDurationDefault,
  openRestSettingsRequestId,
}: TodoProgressFooterProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (openRestSettingsRequestId <= 0) {
      return;
    }
    setIsSheetOpen(true);
  }, [openRestSettingsRequestId]);

  const restDurationDescription = useMemo(() => {
    if (session.active === "rest") {
      return `휴식 제한: ${formatRestDurationLabel(session.restDurationPreviewMin)}`;
    }
    return `다음 휴식: ${formatRestDurationLabel(session.restDurationPreviewMin)}`;
  }, [session.active, session.restDurationPreviewMin]);

  return (
    <footer
      className={[
        "session-progress-card rounded-xl border border-base-300/80 bg-base-100/85 px-3 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]",
        session.active === "focus"
          ? "session-progress-card--focus"
          : session.active === "rest"
            ? "session-progress-card--rest"
            : "",
      ].join(" ")}
    >
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-base-content/80">
          진행률 {summary.completedCount}/{summary.totalCount}
        </span>
        <span className="font-semibold text-base-content/70">총 {summary.totalMinutes}분</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-base-300/75">
        <div
          className="h-full rounded-full bg-success transition-all duration-300 ease-out"
          style={{ width: `${summary.progressPercent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-base-300/70 bg-base-200/50 px-2.5 py-2">
        <div className="text-xs text-base-content/80">
          <div className="font-semibold">
            집중 {session.focusMinutes}분 · 휴식 {session.restMinutes}분
          </div>
          <div className="mt-0.5 text-[11px] text-base-content/60">
            {session.active === "focus"
              ? "집중 중"
              : session.active === "rest"
                ? "휴식 중"
                : "대기 중"}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-base-content/55">
            {restDurationDescription}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={[
              "btn btn-xs h-7 min-h-7 rounded-full px-2.5",
              session.active === "focus"
                ? "border-info/30 bg-info/20 text-info"
                : "border-base-300 bg-base-100 text-base-content/75",
            ].join(" ")}
            onClick={onToggleFocus}
          >
            {session.active === "focus" ? <FiPause size={12} /> : <FiPlay size={12} />}
            {session.active === "focus" ? "집중 중지" : "집중 시작"}
          </button>
          <button
            type="button"
            className={[
              "btn btn-xs h-7 min-h-7 rounded-full px-2.5",
              session.active === "rest"
                ? "border-warning/30 bg-warning/20 text-warning"
                : "border-base-300 bg-base-100 text-base-content/75",
            ].join(" ")}
            onClick={onToggleRest}
          >
            {session.active === "rest" ? <FiPause size={12} /> : <FiCoffee size={12} />}
            {session.active === "rest" ? "휴식 중지" : "휴식 시작"}
          </button>
        </div>
      </div>

      <RestDurationBottomSheet
        isOpen={isSheetOpen}
        currentDurationMin={session.restDurationPreviewMin}
        defaultDurationMin={session.restDurationDefaultMin}
        onClose={() => setIsSheetOpen(false)}
        onApplyOnce={onApplyRestDurationOnce}
        onSaveDefault={onSaveRestDurationDefault}
      />
    </footer>
  );
}
