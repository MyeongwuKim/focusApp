import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import {
  formatDateInput,
  getPresetRange,
  getRangeDays,
  normalizeStatsSearchParams,
  type Preset,
} from "../statsDate";

export function StatsPeriodFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const normalized = useMemo(() => normalizeStatsSearchParams(searchParams), [searchParams]);
  const guideText = `현재 기간: ${normalized.startInput} ~ ${normalized.endInput} (${getRangeDays(
    normalized.start,
    normalized.end
  )}일)`;

  const applyPreset = (preset: Preset) => {
    const next = getPresetRange(preset);
    const params = new URLSearchParams(searchParams);
    params.set("preset", preset);
    params.set("start", formatDateInput(next.start));
    params.set("end", formatDateInput(next.end));
    setSearchParams(params, { replace: true });
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant={normalized.preset === "7d" ? "primary" : "default"} onClick={() => applyPreset("7d")}>
          7일
        </Button>
        <Button
          size="sm"
          variant={normalized.preset === "30d" ? "primary" : "default"}
          onClick={() => applyPreset("30d")}
        >
          30일
        </Button>
        <Button size="sm" variant={normalized.preset === "1y" ? "primary" : "default"} onClick={() => applyPreset("1y")}>
          1년
        </Button>
      </div>

      <div className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
        <p className="mt-2 text-xs text-base-content/65">{guideText}</p>
      </div>
    </>
  );
}
