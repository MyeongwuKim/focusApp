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

export type StatsDailyActivityDatum = {
  key: string;
  done: number;
  incomplete: number;
  resumeCount: number;
  focusMin: number;
  restMin: number;
};
