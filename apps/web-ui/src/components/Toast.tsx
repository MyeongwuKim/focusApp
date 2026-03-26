import { useEffect } from "react";
import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";
import { useToastStore, type ToastItem, type ToastType } from "../stores";

const TOAST_META: Record<
  ToastType,
  { icon: typeof FiCheckCircle; defaultTitle: string; ariaRole: "status" | "alert" }
> = {
  positive: {
    icon: FiCheckCircle,
    defaultTitle: "성공",
    ariaRole: "status",
  },
  error: {
    icon: FiAlertCircle,
    defaultTitle: "에러",
    ariaRole: "alert",
  },
};

function ToastCard({ id, type, title, message, duration, dismissing }: ToastItem) {
  const dismissToast = useToastStore((state) => state.dismissToast);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    if (dismissing) {
      return;
    }

    const timer = window.setTimeout(() => dismissToast(id), duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [dismissing, dismissToast, duration, id]);

  const meta = TOAST_META[type];
  const Icon = meta.icon;

  return (
    <div
      className={["toast-card", `toast-card--${type}`, dismissing ? "toast-card--leaving" : ""].join(" ")}
      role={meta.ariaRole}
      onAnimationEnd={() => {
        if (dismissing) {
          removeToast(id);
        }
      }}
    >
      <div className="toast-card__icon-wrap" aria-hidden="true">
        <Icon size={17} />
      </div>
      <div className="toast-card__text">
        <p className="toast-card__title">{title || meta.defaultTitle}</p>
        <p className="toast-card__message">{message}</p>
      </div>
      <button
        type="button"
        className="toast-card__close"
        onClick={() => dismissToast(id)}
        aria-label="토스트 닫기"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}

export function Toast() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-layer">
      <div className="toast-stack">
        {toasts.map((toastItem) => (
          <ToastCard key={toastItem.id} {...toastItem} />
        ))}
      </div>
    </div>
  );
}
