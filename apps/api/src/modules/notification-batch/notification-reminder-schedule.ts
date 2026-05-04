import type { PrismaClient } from "@prisma/client";

const WEEKDAY_SET = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderScheduleSettings = {
  userId: string;
  pushEnabled: boolean;
  intervalMinutes: number;
  activeStartTime: string;
  activeEndTime: string;
  dayMode: string;
  typeIncomplete: boolean;
  typeFocusStart: boolean;
  systemPermission: string | null;
};

export async function refreshReminderScheduleForUser(input: {
  prisma: PrismaClient;
  userId: string;
  now?: Date;
  timezone: string;
}) {
  const now = input.now ?? new Date();
  const settings = await input.prisma.notificationSettings.findUnique({
    where: { userId: input.userId },
    select: {
      userId: true,
      pushEnabled: true,
      intervalMinutes: true,
      activeStartTime: true,
      activeEndTime: true,
      dayMode: true,
      typeIncomplete: true,
      typeFocusStart: true,
      systemPermission: true,
    },
  });

  if (!settings) {
    return;
  }

  const nextReminderAt = computeNextReminderAtFromSettings({
    settings,
    now,
    timezone: input.timezone,
    immediateIfAllowed: true,
  });

  await input.prisma.notificationSettings.update({
    where: { userId: input.userId },
    data: { nextReminderAt },
  });
}

export function computeNextReminderAtAfterRun(input: {
  settings: ReminderScheduleSettings;
  now: Date;
  timezone: string;
}) {
  return computeNextReminderAtFromSettings({
    settings: input.settings,
    now: new Date(input.now.getTime() + Math.max(input.settings.intervalMinutes, 1) * 60 * 1000),
    timezone: input.timezone,
    immediateIfAllowed: false,
  });
}

function computeNextReminderAtFromSettings(input: {
  settings: ReminderScheduleSettings;
  now: Date;
  timezone: string;
  immediateIfAllowed: boolean;
}) {
  const { settings, now, timezone, immediateIfAllowed } = input;

  if (!settings.pushEnabled || settings.systemPermission !== "granted") {
    return null;
  }
  if (!settings.typeIncomplete && !settings.typeFocusStart) {
    return null;
  }
  if (!Number.isFinite(settings.intervalMinutes) || settings.intervalMinutes <= 0) {
    return null;
  }

  const startMinutes = parseHHmmToMinutes(settings.activeStartTime);
  const endMinutes = parseHHmmToMinutes(settings.activeEndTime);
  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  const zonedNow = getZonedNow(now, timezone);
  const nowMinutes = zonedNow.hour * 60 + zonedNow.minute;
  const allowedNow = isDayAllowed(settings.dayMode, zonedNow.weekdayShort) &&
    isWithinWindow(nowMinutes, startMinutes, endMinutes);

  if (immediateIfAllowed && allowedNow) {
    return now;
  }
  if (!immediateIfAllowed && allowedNow) {
    return now;
  }

  for (let i = 0; i < 14; i += 1) {
    const probe = new Date(now.getTime() + i * DAY_MS);
    const zoned = getZonedNow(probe, timezone);
    if (!isDayAllowed(settings.dayMode, zoned.weekdayShort)) {
      continue;
    }

    const candidate = makeZonedDateFromDateKeyAndMinutes({
      dateKey: zoned.dateKey,
      minutes: startMinutes,
      timezone,
    });

    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return new Date(now.getTime() + settings.intervalMinutes * 60 * 1000);
}

function parseHHmmToMinutes(value: string): number | null {
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!matched) {
    return null;
  }
  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  return hours * 60 + minutes;
}

function isWithinWindow(nowMinutes: number, startMinutes: number, endMinutes: number) {
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function isDayAllowed(dayMode: string, weekdayShort: string) {
  if (dayMode === "everyday") {
    return true;
  }
  return WEEKDAY_SET.has(weekdayShort);
}

function getZonedNow(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  const year = partValue("year");
  const month = partValue("month");
  const day = partValue("day");
  const hour = Number(partValue("hour"));
  const minute = Number(partValue("minute"));
  const weekdayShort = partValue("weekday");

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    weekdayShort,
  };
}

function makeZonedDateFromDateKeyAndMinutes(input: {
  dateKey: string;
  minutes: number;
  timezone: string;
}) {
  const [yearText, monthText, dayText] = input.dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Math.floor(input.minutes / 60);
  const minute = input.minutes % 60;

  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const rough = new Date(utcTimestamp);
  const offsetMinutes = getTimezoneOffsetMinutes(rough, input.timezone);
  return new Date(utcTimestamp - offsetMinutes * 60 * 1000);
}

function getTimezoneOffsetMinutes(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const zoneText = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const matched = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(zoneText);
  if (!matched) {
    return 0;
  }
  const sign = matched[1] === "-" ? -1 : 1;
  const hour = Number(matched[2] ?? "0");
  const minute = Number(matched[3] ?? "0");
  return sign * (hour * 60 + minute);
}
