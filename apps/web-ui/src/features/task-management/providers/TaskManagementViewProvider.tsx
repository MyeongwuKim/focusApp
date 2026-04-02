import { createContext, useContext, type ReactNode } from "react";
import type { ManagedCollection, ManagedTaskItem } from "../components/TaskManagementBody";

type TaskManagementViewContextValue = {
  tasks: ManagedTaskItem[];
  collections: ManagedCollection[];
  selectedCollectionId: "all" | string;
  selectedTaskId: string | null;
  selectedTaskLabel: string | null;
  selectedTaskLastUsedAt: string | null;
  recentUsedAt: string | null;
  onSelectCollection: (collectionId: "all" | string) => void;
  onSelectTask: (taskId: string) => void;
  onRequestRenameTask: (taskId: string) => void;
  onRequestDeleteTask: (taskId: string) => void;
  onRequestRenameCollection: (collectionId: string) => void;
  onRequestDeleteCollection: (collectionId: string) => void;
  onOpenCollection: () => void;
  onOpenTaskPicker: () => void;
};

const TaskManagementViewContext = createContext<TaskManagementViewContextValue | null>(null);

export function TaskManagementViewProvider({
  value,
  children,
}: {
  value: TaskManagementViewContextValue;
  children: ReactNode;
}) {
  return (
    <TaskManagementViewContext.Provider value={value}>
      {children}
    </TaskManagementViewContext.Provider>
  );
}

export function useTaskManagementView() {
  const context = useContext(TaskManagementViewContext);
  if (!context) {
    throw new Error("useTaskManagementView must be used within TaskManagementViewProvider");
  }
  return context;
}
