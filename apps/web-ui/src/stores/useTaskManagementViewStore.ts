import { create } from "zustand";

type TaskManagementViewState = {
  selectedCollectionId: "all" | string;
  selectedTaskId: string | null;
};

type TaskManagementViewActions = {
  setSelectedCollectionId: (collectionId: "all" | string) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  resetTaskManagementViewState: () => void;
};

type TaskManagementViewStore = TaskManagementViewState & TaskManagementViewActions;

const initialState: TaskManagementViewState = {
  selectedCollectionId: "all",
  selectedTaskId: null,
};

export const useTaskManagementViewStore = create<TaskManagementViewStore>((set) => ({
  ...initialState,
  setSelectedCollectionId: (selectedCollectionId) => {
    set({ selectedCollectionId });
  },
  setSelectedTaskId: (selectedTaskId) => {
    set({ selectedTaskId });
  },
  resetTaskManagementViewState: () => {
    set(initialState);
  },
}));
