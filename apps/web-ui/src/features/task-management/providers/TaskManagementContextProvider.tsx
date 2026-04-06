import { createContext, useContext, type ReactNode } from "react";
import type { ManagedCollection, ManagedTaskItem } from "../components/TaskManagementBody";

type TaskManagementDataContextValue = {
  tasks: ManagedTaskItem[];
  collections: ManagedCollection[];
  selectedCollectionId: "all" | string;
  selectedTaskId: string | null;
};

type TaskManagementMetaContextValue = {
  selectedTaskLabel: string | null;
  selectedTaskLastUsedAt: string | null;
  recentUsedAt: string | null;
};

type TaskManagementActionsContextValue = {
  onSelectCollection: (collectionId: "all" | string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, nextName: string) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onRenameCollection: (collectionId: string, nextName: string) => void;
  onDeleteCollection: (collectionId: string) => Promise<void>;
  onMoveTaskToCollection: (taskId: string, collectionId: string) => void;
  onReorderVisibleTasks: (activeTaskId: string, overTaskId: string) => void;
  onReorderCollections: (activeCollectionId: string, overCollectionId: string) => void;
  onCreateCollection: (name: string) => Promise<void>;
  onCreateTask: (input: { label: string; collectionId: string }) => Promise<void>;
};

const TaskManagementDataContext = createContext<TaskManagementDataContextValue | null>(null);
const TaskManagementMetaContext = createContext<TaskManagementMetaContextValue | null>(null);
const TaskManagementActionsContext = createContext<TaskManagementActionsContextValue | null>(null);

export function TaskManagementContextProvider({
  data,
  meta,
  actions,
  children,
}: {
  data: TaskManagementDataContextValue;
  meta: TaskManagementMetaContextValue;
  actions: TaskManagementActionsContextValue;
  children: ReactNode;
}) {
  return (
    <TaskManagementDataContext.Provider value={data}>
      <TaskManagementMetaContext.Provider value={meta}>
        <TaskManagementActionsContext.Provider value={actions}>
          {children}
        </TaskManagementActionsContext.Provider>
      </TaskManagementMetaContext.Provider>
    </TaskManagementDataContext.Provider>
  );
}

export function useTaskManagementData() {
  const context = useContext(TaskManagementDataContext);
  if (!context) {
    throw new Error("useTaskManagementData must be used within TaskManagementContextProvider");
  }
  return context;
}

export function useTaskManagementMeta() {
  const context = useContext(TaskManagementMetaContext);
  if (!context) {
    throw new Error("useTaskManagementMeta must be used within TaskManagementContextProvider");
  }
  return context;
}

export function useTaskManagementActions() {
  const context = useContext(TaskManagementActionsContext);
  if (!context) {
    throw new Error("useTaskManagementActions must be used within TaskManagementContextProvider");
  }
  return context;
}
