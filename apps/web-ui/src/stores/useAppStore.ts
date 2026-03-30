import { create } from "zustand";

export type AppStoreState = {
  selectedDateKey: string | null;
  viewMonth: Date;
};

export type AppStoreActions = {
  setSelectedDateKey: (dateKey: string | null) => void;
  setViewMonth: (nextMonth: Date) => void;
  resetAppStore: () => void;
};

export type AppStore = AppStoreState & AppStoreActions;

function getInitialViewMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const initialState: AppStoreState = {
  selectedDateKey: null,
  viewMonth: getInitialViewMonth(),
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  setSelectedDateKey: (dateKey) => {
    set({ selectedDateKey: dateKey });
  },
  setViewMonth: (nextMonth) => {
    set({ viewMonth: nextMonth });
  },
  resetAppStore: () => {
    set({
      selectedDateKey: null,
      viewMonth: getInitialViewMonth(),
    });
  },
}));
