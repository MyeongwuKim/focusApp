import { useEffect, useMemo, useState } from "react";
import { FiCoffee, FiPause } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";

const REST_DURATION_DEFAULT_STORAGE_KEY = "date-tasks:rest-duration-default-min";
const REST_DURATION_ONCE_STORAGE_KEY = "date-tasks:rest-duration-once-min";

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
  };
  onToggleRest: (startDurationMin?: number | null) => void;
};

function formatRestDurationLabel(durationMin: number | null) {
  if (durationMin === null) {
    return "무제한";
  }
  return `${durationMin}분`;
}

function readRestDurationFromLocalStorage(
  key: string,
  fallback: number | null | undefined
): number | null | undefined {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);
  if (rawValue === null) {
    return fallback;
  }
  if (rawValue === "null") {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function writeRestDurationToLocalStorage(key: string, value: number | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  if (value === undefined) {
    window.localStorage.removeItem(key);
    return;
  }

  if (value === null) {
    window.localStorage.setItem(key, "null");
    return;
  }

  window.localStorage.setItem(key, String(value));
}

export function TodoProgressFooter({
  summary,
  session,
  onToggleRest,
}: TodoProgressFooterProps) {
  const [restDurationDefaultMin] = useState<number | null>(
    () => readRestDurationFromLocalStorage(REST_DURATION_DEFAULT_STORAGE_KEY, null) ?? null
  );
  const [restDurationOnceMin, setRestDurationOnceMin] = useState<number | null | undefined>(() =>
    readRestDurationFromLocalStorage(REST_DURATION_ONCE_STORAGE_KEY, undefined)
  );

  useEffect(() => {
    writeRestDurationToLocalStorage(REST_DURATION_DEFAULT_STORAGE_KEY, restDurationDefaultMin);
  }, [restDurationDefaultMin]);

  useEffect(() => {
    writeRestDurationToLocalStorage(REST_DURATION_ONCE_STORAGE_KEY, restDurationOnceMin);
  }, [restDurationOnceMin]);

  const nextRestDurationMin =
    restDurationOnceMin === undefined ? restDurationDefaultMin : restDurationOnceMin;

  const restDurationDescription = useMemo(() => {
    if (session.active === "rest") {
      return `휴식 제한: ${formatRestDurationLabel(session.restDurationPreviewMin)}`;
    }
    return `다음 휴식: ${formatRestDurationLabel(nextRestDurationMin)}`;
  }, [nextRestDurationMin, session.active, session.restDurationPreviewMin]);

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
      <div
        className={[
          "session-progress-card__metrics mb-2 grid gap-1.5",
          session.active === null ? "grid-cols-2" : "grid-cols-3",
        ].join(" ")}
      >
        <div className="session-progress-card__metric rounded-lg border border-base-300/70 bg-base-100/70 px-2 py-1.5 text-center">
          <p className="m-0 text-[10px] text-base-content/60">오늘 한 일</p>
          <p className="m-0 mt-0.5 text-sm font-semibold text-base-content/90">{summary.completedCount}개</p>
        </div>
        <div className="session-progress-card__metric rounded-lg border border-base-300/70 bg-base-100/70 px-2 py-1.5 text-center">
          <p className="m-0 text-[10px] text-base-content/60">집중</p>
          <p className="m-0 mt-0.5 text-sm font-semibold text-base-content/90">{session.focusMinutes}분</p>
        </div>
        {session.active !== null ? (
          <div className="session-progress-card__metric rounded-lg border border-base-300/70 bg-base-100/70 px-2 py-1.5 text-center">
            <p className="m-0 text-[10px] text-base-content/60">휴식</p>
            <p className="m-0 mt-0.5 text-sm font-semibold text-base-content/90">{session.restMinutes}분</p>
          </div>
        ) : null}
      </div>
      <div className="session-progress-card__track h-2 overflow-hidden rounded-full bg-base-300/75">
        <div
          className="session-progress-card__fill h-full rounded-full bg-success transition-all duration-300 ease-out"
          style={{ width: `${summary.progressPercent}%` }}
        />
      </div>
      <div className="session-progress-card__detail mt-2 flex items-center justify-between gap-2 rounded-lg border border-base-300/70 bg-base-200/50 px-2.5 py-2">
        <div className="text-xs text-base-content/80">
          <div className="font-semibold">
            진행률 {summary.completedCount}/{summary.totalCount}
          </div>
          <div className="mt-0.5 text-[11px] text-base-content/60">
            {session.active === "focus"
              ? "집중 중"
              : session.active === "rest"
                ? "휴식 중"
                : "대기 중"}
          </div>
          {session.active !== null ? (
            <div className="mt-0.5 text-[11px] font-medium text-base-content/55">
              {restDurationDescription}
            </div>
          ) : null}
        </div>
        {session.active === "focus" || session.active === "rest" ? (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="xs"
              className={[
                "session-progress-card__rest-button h-7 min-h-7 px-2.5",
                session.active === "rest"
                  ? "border-warning/30 bg-warning/20 text-warning"
                  : "border-base-300 bg-base-100 text-base-content/75",
              ].join(" ")}
              onClick={() => {
                if (session.active === "rest") {
                  onToggleRest();
                  return;
                }

                onToggleRest(nextRestDurationMin);
                if (restDurationOnceMin !== undefined) {
                  setRestDurationOnceMin(undefined);
                }
              }}
            >
              {session.active === "rest" ? <FiPause size={12} /> : <FiCoffee size={12} />}
              {session.active === "rest" ? "휴식 끝내기" : "잠깐 쉬기"}
            </Button>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
