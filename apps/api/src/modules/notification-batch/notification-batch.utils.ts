const WEEKDAY_SET = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

export type ReminderTone = "soft" | "balanced" | "firm";
export type TodoReminderStatus = "not_started" | "in_progress" | "paused" | "done";

export type TodoReminderEntry = {
  id?: string;
  done: boolean;
  startedAt?: Date | null;
  pausedAt?: Date | null;
  completedAt?: Date | null;
  scheduledStartAt?: Date | null;
  targetFocusMinutes?: number | null;
  deviationSeconds?: number | null;
  muteReminderDateKey?: string | null;
  content?: string | null;
  titleSnapshot?: string | null;
  order?: number;
};

export function isDayAllowed(dayMode: string, weekdayShort: string) {
  if (dayMode === "everyday") {
    return true;
  }
  return WEEKDAY_SET.has(weekdayShort);
}

export function parseHHmmToMinutes(value: string): number | null {
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!matched) {
    return null;
  }
  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  return hours * 60 + minutes;
}

export function isWithinWindow(nowMinutes: number, startMinutes: number, endMinutes: number) {
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

export function normalizeTone(value: string): ReminderTone {
  if (value === "balanced" || value === "firm") {
    return value;
  }
  return "soft";
}

export function getZonedNow(now: Date, timezone: string) {
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

export function getTodoReminderStatus(todo: TodoReminderEntry): TodoReminderStatus {
  if (todo.done || todo.completedAt) {
    return "done";
  }
  if (!todo.startedAt) {
    return "not_started";
  }
  if (todo.pausedAt) {
    return "paused";
  }
  return "in_progress";
}

function isTodoReminderMutedToday(todo: TodoReminderEntry, dateKey: string) {
  return typeof todo.muteReminderDateKey === "string" && todo.muteReminderDateKey === dateKey;
}

export function pickFirstOpenTodo(todos: TodoReminderEntry[], dateKey: string) {
  const sorted = [...todos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const todo of sorted) {
    const status = getTodoReminderStatus(todo);
    if (status === "done") {
      continue;
    }
    if (status === "in_progress") {
      return todo;
    }
    if (isTodoReminderMutedToday(todo, dateKey)) {
      continue;
    }
    return todo;
  }

  return null;
}

export function getTodoLabel(todo: TodoReminderEntry) {
  const snapshot = todo.titleSnapshot?.trim();
  if (snapshot) {
    return snapshot;
  }

  const content = todo.content?.trim();
  if (content) {
    return content;
  }

  return "미완료 작업";
}

export function pickDueScheduledTodos(input: {
  todos: TodoReminderEntry[];
  now: Date;
  scheduleWindowMs: number;
  dateKey: string;
}) {
  const sorted = [...input.todos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const matches: Array<{ label: string; todoId: string; scheduledAtMs: number }> = [];

  for (const todo of sorted) {
    if (todo.done || todo.completedAt || !todo.scheduledStartAt) {
      continue;
    }
    if (isTodoReminderMutedToday(todo, input.dateKey)) {
      continue;
    }

    const scheduledAt = new Date(todo.scheduledStartAt).getTime();
    if (!Number.isFinite(scheduledAt)) {
      continue;
    }

    const diffMs = input.now.getTime() - scheduledAt;
    if (diffMs < 0 || diffMs > input.scheduleWindowMs) {
      continue;
    }

    const label = todo.titleSnapshot?.trim() || todo.content?.trim() || "할일";
    matches.push({
      label,
      todoId: todo.id ?? label,
      scheduledAtMs: scheduledAt,
    });
  }

  return matches;
}

export function pickDueTargetFocusTodos(input: {
  todos: TodoReminderEntry[];
  now: Date;
  scheduleWindowMs: number;
}) {
  const sorted = [...input.todos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const matches: Array<{ label: string; todoId: string; reachedAtMs: number; targetFocusMinutes: number }> = [];

  for (const todo of sorted) {
    if (todo.done || todo.completedAt || !todo.startedAt || todo.pausedAt) {
      continue;
    }

    const targetFocusMinutes =
      typeof todo.targetFocusMinutes === "number" && Number.isFinite(todo.targetFocusMinutes)
        ? Math.floor(todo.targetFocusMinutes)
        : null;
    if (!targetFocusMinutes || targetFocusMinutes < 30) {
      continue;
    }

    const startedAtMs = new Date(todo.startedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      continue;
    }

    const deviationSeconds =
      typeof todo.deviationSeconds === "number" && Number.isFinite(todo.deviationSeconds)
        ? Math.max(Math.floor(todo.deviationSeconds), 0)
        : 0;
    const reachedAtMs = startedAtMs + (targetFocusMinutes * 60 + deviationSeconds) * 1000;
    const diffMs = input.now.getTime() - reachedAtMs;
    if (diffMs < 0 || diffMs > input.scheduleWindowMs) {
      continue;
    }

    matches.push({
      label: getTodoLabel(todo),
      todoId: todo.id ?? getTodoLabel(todo),
      reachedAtMs,
      targetFocusMinutes,
    });
  }

  return matches;
}
