export type Preset = "7d" | "30d" | "1y";

export const STATS_MAX_RANGE_DAYS = 730;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseInputDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function getTodayDate() {
  return parseInputDate(formatDateInput(new Date()));
}

export function getPresetRange(preset: Preset) {
  const end = getTodayDate();
  if (preset === "7d") {
    return { start: addDays(end, -6), end };
  }
  if (preset === "30d") {
    return { start: addDays(end, -29), end };
  }
  return { start: addDays(end, -364), end };
}

function isPreset(value: string | null): value is Preset {
  return value === "7d" || value === "30d" || value === "1y";
}

export function normalizeStatsSearchParams(source: URLSearchParams) {
  const today = getTodayDate();
  const todayKey = formatDateInput(today);

  const preset = isPreset(source.get("preset")) ? (source.get("preset") as Preset) : "7d";
  const fallback = getPresetRange(preset);

  const rawStart = source.get("start");
  const rawEnd = source.get("end");
  let start = rawStart ? parseInputDate(rawStart) : fallback.start;
  let end = rawEnd ? parseInputDate(rawEnd) : fallback.end;

  if (Number.isNaN(start.getTime())) {
    start = fallback.start;
  }
  if (Number.isNaN(end.getTime())) {
    end = fallback.end;
  }

  if (end > today) {
    end = today;
  }
  if (start > end) {
    start = end;
  }

  const rangeDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (rangeDays > STATS_MAX_RANGE_DAYS) {
    start = addDays(end, -(STATS_MAX_RANGE_DAYS - 1));
  }

  const normalized = new URLSearchParams();
  normalized.set("preset", preset);
  normalized.set("start", formatDateInput(start));
  normalized.set("end", formatDateInput(end));

  return {
    preset,
    start,
    end,
    startInput: formatDateInput(start),
    endInput: formatDateInput(end),
    todayKey,
    normalized,
  };
}

export function getMonthKeysBetween(start: Date, end: Date) {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

export function getRangeDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}
