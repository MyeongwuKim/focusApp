export type CountBarDatum = {
  label: string;
  tooltipLabel: string;
  done: number;
  incomplete: number;
  resumeCount: number;
  doneLabels: string[];
  incompleteLabels: string[];
};

export type TimeBarDatum = {
  label: string;
  tooltipLabel: string;
  focusMin: number;
  restMin: number;
};

export type FocusResumeDatum = {
  id: string;
  dateKey: string;
  taskLabel: string;
  focusMin: number;
  resumeCount: number;
  done: boolean;
};

export type StatsDailyActivityDatum = {
  key: string;
  done: number;
  incomplete: number;
  resumeCount: number;
  focusMin: number;
  restMin: number;
};
