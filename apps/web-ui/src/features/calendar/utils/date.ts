import { formatDateKey } from "../../../utils/holidays";

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const nextDate = parseDateKey(dateKey);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateKey(nextDate);
}

export function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseDateKey(dateKey));
}

export function getDateTextClass(date: Date, isCurrentMonth: boolean, isHoliday: boolean) {
  if (isHoliday) {
    return isCurrentMonth ? "text-error" : "text-error/50";
  }

  const day = date.getDay();
  if (day === 0) {
    return isCurrentMonth ? "text-error" : "text-error/50";
  }
  if (day === 6) {
    return isCurrentMonth ? "text-info" : "text-info/50";
  }
  return isCurrentMonth ? "text-base-content" : "text-base-content/35";
}
