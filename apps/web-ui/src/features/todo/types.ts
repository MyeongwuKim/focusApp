export type TaskStatus = "todo" | "overdue" | "in_progress" | "paused" | "done";

export type TaskItem = {
  id: string;
  label: string;
  status: TaskStatus;
  accumulatedMs: number;
  startedAt: number | null;
  deviationSeconds?: number;
  targetFocusBaselineSeconds?: number;
  scheduledStartAt: number | null;
  targetFocusMinutes: number | null;
  muteReminderDateKey?: string | null;
  completedAt: number | null;
  completedDurationMs: number | null;
};
