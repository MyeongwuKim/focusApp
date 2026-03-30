import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CreateCollectionModal } from "../components/CreateCollectionModal";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { RenameItemModal } from "../components/RenameItemModal";
import type { ManagedCollection } from "../components/TaskManagementBody";

type CreateTaskInput = { label: string; collectionId: string };

type TaskManagementModalContextValue = {
  openCreateCollection: () => Promise<string | null>;
  openCreateTask: (collections: ManagedCollection[]) => Promise<CreateTaskInput | null>;
  openRename: (input: {
    title: string;
    initialValue: string;
    placeholder: string;
  }) => Promise<string | null>;
};

type ModalState =
  | { type: "idle" }
  | { type: "createCollection"; resolve: (value: string | null) => void }
  | {
      type: "createTask";
      collections: ManagedCollection[];
      resolve: (value: CreateTaskInput | null) => void;
    }
  | {
      type: "rename";
      title: string;
      initialValue: string;
      placeholder: string;
      resolve: (value: string | null) => void;
    };

const TaskManagementModalContext = createContext<TaskManagementModalContextValue | null>(null);

export function TaskManagementModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ type: "idle" });

  const closeWithNull = () => {
    setModal((prev) => {
      if (prev.type === "idle") {
        return prev;
      }
      prev.resolve(null);
      return { type: "idle" };
    });
  };

  const value = useMemo<TaskManagementModalContextValue>(
    () => ({
      openCreateCollection: () =>
        new Promise((resolve) => {
          setModal({ type: "createCollection", resolve });
        }),
      openCreateTask: (collections) =>
        new Promise((resolve) => {
          setModal({ type: "createTask", collections, resolve });
        }),
      openRename: ({ title, initialValue, placeholder }) =>
        new Promise((resolve) => {
          setModal({ type: "rename", title, initialValue, placeholder, resolve });
        }),
    }),
    []
  );

  return (
    <TaskManagementModalContext.Provider value={value}>
      {children}

      <CreateCollectionModal
        isOpen={modal.type === "createCollection"}
        onClose={closeWithNull}
        onCreate={(name) => {
          if (modal.type !== "createCollection") {
            return;
          }
          modal.resolve(name);
          setModal({ type: "idle" });
        }}
      />

      <CreateTaskModal
        isOpen={modal.type === "createTask"}
        collections={modal.type === "createTask" ? modal.collections : []}
        onClose={closeWithNull}
        onCreate={(input) => {
          if (modal.type !== "createTask") {
            return;
          }
          modal.resolve(input);
          setModal({ type: "idle" });
        }}
      />

      <RenameItemModal
        isOpen={modal.type === "rename"}
        title={modal.type === "rename" ? modal.title : ""}
        initialValue={modal.type === "rename" ? modal.initialValue : ""}
        placeholder={modal.type === "rename" ? modal.placeholder : ""}
        onClose={closeWithNull}
        onRename={(name) => {
          if (modal.type !== "rename") {
            return;
          }
          modal.resolve(name);
          setModal({ type: "idle" });
        }}
      />
    </TaskManagementModalContext.Provider>
  );
}

export function useTaskManagementModals() {
  const context = useContext(TaskManagementModalContext);
  if (!context) {
    throw new Error("useTaskManagementModals must be used within TaskManagementModalProvider");
  }
  return context;
}
