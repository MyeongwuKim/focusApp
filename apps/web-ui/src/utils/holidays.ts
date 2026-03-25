type HolidayItem = {
  date: string;
  localName: string;
  name: string;
};

export type HolidaysByDate = Record<string, string>;

const holidayCache = new Map<number, HolidaysByDate>();

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function fetchKoreanHolidays(year: number): Promise<HolidaysByDate> {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
  if (!response.ok) {
    throw new Error(`Failed to fetch KR holidays: ${year}`);
  }

  const list = (await response.json()) as HolidayItem[];
  const mapped = list.reduce((acc, holiday) => {
    acc[holiday.date] = holiday.localName || holiday.name;
    return acc;
  }, {} as HolidaysByDate);

  holidayCache.set(year, mapped);
  return mapped;
}
