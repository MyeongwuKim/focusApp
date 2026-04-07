import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  STATS_MAX_RANGE_DAYS,
  formatDateInput,
  getPresetRange,
  getRangeDays,
  getTodayDate,
  normalizeStatsSearchParams,
  parseInputDate,
  type Preset,
} from "../statsDate";

export function StatsPeriodFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const normalized = useMemo(() => normalizeStatsSearchParams(searchParams), [searchParams]);
  const [startInput, setStartInput] = useState(normalized.startInput);
  const [endInput, setEndInput] = useState(normalized.endInput);

  useEffect(() => {
    setStartInput(normalized.startInput);
    setEndInput(normalized.endInput);
  }, [normalized.endInput, normalized.startInput]);

  const today = getTodayDate();
  const parsedStart = parseInputDate(startInput);
  const parsedEnd = parseInputDate(endInput);
  const isDateInvalid = Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime());
  const isOrderInvalid = !isDateInvalid && parsedStart > parsedEnd;
  const isFutureInvalid = !isDateInvalid && parsedEnd > today;
  const rangeDays = !isDateInvalid && !isOrderInvalid ? getRangeDays(parsedStart, parsedEnd) : 0;
  const isLimitInvalid = !isDateInvalid && !isOrderInvalid && rangeDays > STATS_MAX_RANGE_DAYS;
  const canApply = !isDateInvalid && !isOrderInvalid && !isFutureInvalid && !isLimitInvalid;
  const guideText = isOrderInvalid
    ? "시작일이 종료일보다 늦을 수 없어요."
    : isFutureInvalid
      ? "종료일은 오늘을 넘길 수 없어요."
      : isLimitInvalid
        ? "사용자 지정 기간은 최대 2년(730일)까지 선택 가능해요."
        : `현재 기간: ${normalized.startInput} ~ ${normalized.endInput} (${getRangeDays(normalized.start, normalized.end)}일)`;

  const applyPreset = (preset: Exclude<Preset, "custom">) => {
    const next = getPresetRange(preset);
    const params = new URLSearchParams(searchParams);
    params.set("preset", preset);
    params.set("start", formatDateInput(next.start));
    params.set("end", formatDateInput(next.end));
    setSearchParams(params, { replace: true });
  };

  const applyCustomRange = () => {
    if (!canApply) {
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set("preset", "custom");
    params.set("start", startInput);
    params.set("end", endInput);
    setSearchParams(params, { replace: true });
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <button className={`btn btn-sm ${normalized.preset === "day" ? "btn-primary" : ""}`} onClick={() => applyPreset("day")}>하루</button>
        <button className={`btn btn-sm ${normalized.preset === "7d" ? "btn-primary" : ""}`} onClick={() => applyPreset("7d")}>7일</button>
        <button className={`btn btn-sm ${normalized.preset === "30d" ? "btn-primary" : ""}`} onClick={() => applyPreset("30d")}>30일</button>
        <button className={`btn btn-sm ${normalized.preset === "1y" ? "btn-primary" : ""}`} onClick={() => applyPreset("1y")}>1년</button>
      </div>

      <div className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input type="date" className="input input-bordered w-full" value={startInput} onChange={(event) => setStartInput(event.target.value)} />
          <input type="date" className="input input-bordered w-full" value={endInput} max={normalized.todayKey} onChange={(event) => setEndInput(event.target.value)} />
          <button className="btn btn-primary" disabled={!canApply} onClick={applyCustomRange}>기간 적용</button>
        </div>
        <p className="mt-2 text-xs text-base-content/65">{guideText}</p>
      </div>
    </>
  );
}
