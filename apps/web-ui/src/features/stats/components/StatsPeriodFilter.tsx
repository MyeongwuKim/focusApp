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
  const matchedPreset = useMemo(() => {
    const presets: Preset[] = ["7d", "30d", "1y"];
    for (const preset of presets) {
      const range = getPresetRange(preset);
      const start = formatDateInput(range.start);
      const end = formatDateInput(range.end);
      if (start === normalized.startInput && end === normalized.endInput) {
        return preset;
      }
    }
    return null;
  }, [normalized.endInput, normalized.startInput]);
  const isCustomRange = matchedPreset === null;
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
    <div className="stats-period-filter">
      <div className="stats-period-filter__tabs">
        <Button size="sm" variant={matchedPreset === "7d" ? "primary" : "default"} onClick={() => applyPreset("7d")}>
          7일
        </Button>
        <Button
          size="sm"
          variant={matchedPreset === "30d" ? "primary" : "default"}
          onClick={() => applyPreset("30d")}
        >
          30일
        </Button>
        <Button size="sm" variant={matchedPreset === "1y" ? "primary" : "default"} onClick={() => applyPreset("1y")}>
          12개월
        </Button>
      </div>

      <p className="stats-period-filter__caption">
        {isCustomRange ? <b>직접 선택 · </b> : null}
        {guideText}
      </p>
    </div>
  );
}
