import { create } from "zustand";

export type ConfirmValue = string;
export type ConfirmButtonTone = "primary" | "neutral" | "danger";

export type ConfirmButton = {
  label: string;
  value?: ConfirmValue;
  tone?: ConfirmButtonTone;
};

export type ConfirmOptions = {
  title: string;
  message?: string;
  buttons: ConfirmButton[];
  closeOnBackdrop?: boolean;
};

type ConfirmRequest = {
  id: string;
  options: Required<
    Pick<ConfirmOptions, "title" | "message" | "buttons" | "closeOnBackdrop">
  >;
  resolve: (value: ConfirmValue | null) => void;
};

type ActiveConfirm = ConfirmRequest["options"] & {
  id: string;
  closing: boolean;
  result: ConfirmValue | null;
};

type ConfirmStore = {
  active: ActiveConfirm | null;
  openConfirm: (options: ConfirmOptions) => Promise<ConfirmValue | null>;
  closeWithResult: (value: ConfirmValue | null) => void;
  completeClose: () => void;
};

const requestQueue: ConfirmRequest[] = [];

const createId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const normalizeOptions = (
  options: ConfirmOptions
): Required<
  Pick<ConfirmOptions, "title" | "message" | "buttons" | "closeOnBackdrop">
> => {
  const buttons =
    options.buttons.length > 0
      ? options.buttons
      : [{ label: "확인", value: "ok" }];
  return {
    title: options.title,
    message: options.message ?? "",
    buttons,
    closeOnBackdrop: options.closeOnBackdrop ?? true,
  };
};

const pumpQueue = (
  set: (partial: Partial<ConfirmStore>) => void,
  get: () => ConfirmStore
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

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  active: null,
  openConfirm: (options) =>
    new Promise((resolve) => {
      const id = createId();
      requestQueue.push({
        id,
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

export const confirm = (options: ConfirmOptions) =>
  useConfirmStore.getState().openConfirm(options);
