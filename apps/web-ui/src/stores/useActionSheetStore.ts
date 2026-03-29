import type { ReactNode } from "react";
import { create } from "zustand";

export type ActionSheetValue = string;
export type ActionSheetItemTone = "default" | "primary" | "danger" | "muted";

export type ActionSheetItem = {
  label: string;
  value?: ActionSheetValue;
  tone?: ActionSheetItemTone;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type ActionSheetOptions = {
  title?: string;
  message?: string;
  items: ActionSheetItem[];
  closeOnBackdrop?: boolean;
};

type ActionSheetRequest = {
  id: string;
  options: Required<
    Pick<ActionSheetOptions, "title" | "message" | "items" | "closeOnBackdrop">
  >;
  resolve: (value: ActionSheetValue | null) => void;
};

type ActiveActionSheet = ActionSheetRequest["options"] & {
  id: string;
  closing: boolean;
  result: ActionSheetValue | null;
};

type ActionSheetStore = {
  active: ActiveActionSheet | null;
  openActionSheet: (options: ActionSheetOptions) => Promise<ActionSheetValue | null>;
  closeWithResult: (value: ActionSheetValue | null) => void;
  completeClose: () => void;
};

const requestQueue: ActionSheetRequest[] = [];

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `action-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const normalizeOptions = (
  options: ActionSheetOptions
): Required<Pick<ActionSheetOptions, "title" | "message" | "items" | "closeOnBackdrop">> => {
  const fallbackItems: ActionSheetItem[] = [{ label: "닫기", value: "close", tone: "muted" }];
  const items = options.items.length > 0 ? options.items : fallbackItems;
  return {
    title: options.title ?? "",
    message: options.message ?? "",
    items,
    closeOnBackdrop: options.closeOnBackdrop ?? true,
  };
};

const pumpQueue = (
  set: (partial: Partial<ActionSheetStore>) => void,
  get: () => ActionSheetStore
) => {
  if (get().active || requestQueue.length === 0) {
    return;
  }
  const next = requestQueue[0];
  set({
    active: {
      id: next.id,
      ...next.options,
      closing: false,
      result: null,
    },
  });
};

export const useActionSheetStore = create<ActionSheetStore>((set, get) => ({
  active: null,
  openActionSheet: (options) =>
    new Promise((resolve) => {
      requestQueue.push({
        id: createId(),
        options: normalizeOptions(options),
        resolve,
      });
      pumpQueue(set, get);
    }),
  closeWithResult: (value) => {
    const active = get().active;
    if (!active || active.closing) {
      return;
    }
    set({ active: { ...active, closing: true, result: value } });
  },
  completeClose: () => {
    const active = get().active;
    if (!active || !active.closing) {
      return;
    }
    const index = requestQueue.findIndex((request) => request.id === active.id);
    if (index !== -1) {
      const [request] = requestQueue.splice(index, 1);
      request.resolve(active.result);
    }
    set({ active: null });
    pumpQueue(set, get);
  },
}));

export const actionSheet = (options: ActionSheetOptions) =>
  useActionSheetStore.getState().openActionSheet(options);
