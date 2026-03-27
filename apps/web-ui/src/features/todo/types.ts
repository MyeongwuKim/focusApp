export type TaskStatus = "todo" | "in_progress" | "paused" | "done";

export type TaskItem = {
  id: string;
  label: string;
  status: TaskStatus;
  accumulatedMs: number;
  startedAt: number | null;
  completedAt: number | null;
  completedDurationMs: number | null;
};
