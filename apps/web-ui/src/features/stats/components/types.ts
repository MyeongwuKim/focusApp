export type CountBarDatum = {
  label: string;
  tooltipLabel: string;
  done: number;
  incomplete: number;
  deviationMin: number;
  doneLabels: string[];
  incompleteLabels: string[];
};

export type TimeBarDatum = {
  label: string;
  tooltipLabel: string;
  focusMin: number;
  deviationMin: number;
  restMin: number;
};
