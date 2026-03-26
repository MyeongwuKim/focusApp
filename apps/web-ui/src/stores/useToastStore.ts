import { create } from "zustand";

export type ToastType = "positive" | "error";

export type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
  dismissing: boolean;
};

export type ShowToastInput = {
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

type ToastStore = {
  toasts: ToastItem[];
  showToast: (input: ShowToastInput) => string;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
};

const DEFAULT_DURATION = 3200;

const createToastId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: ({ type, title, message, duration = DEFAULT_DURATION }) => {
    const id = createToastId();
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id,
          type,
          title: title?.trim() ?? "",
          message,
          duration,
          dismissing: false,
        },
      ],
    }));
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((toast) =>
        toast.id === id ? { ...toast, dismissing: true } : toast
      ),
    }));
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));

export const toast = {
  show: (input: ShowToastInput) => useToastStore.getState().showToast(input),
  positive: (message: string, title = "성공", duration?: number) =>
    useToastStore.getState().showToast({ type: "positive", title, message, duration }),
  error: (message: string, title = "에러", duration?: number) =>
    useToastStore.getState().showToast({ type: "error", title, message, duration }),
};
