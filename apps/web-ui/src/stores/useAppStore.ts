import { create } from "zustand";

export type AppStoreState = {
  selectedDateKey: string | null;
};

export type AppStoreActions = {
  setSelectedDateKey: (dateKey: string | null) => void;
  resetAppStore: () => void;
};

export type AppStore = AppStoreState & AppStoreActions;

const initialState: AppStoreState = {
  selectedDateKey: null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  setSelectedDateKey: (dateKey) => {
    set({ selectedDateKey: dateKey });
  },
  resetAppStore: () => {
    set(initialState);
  },
}));
